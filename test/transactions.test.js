import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import express from 'express'
import { installInvitations } from '../server/invitations.js'
import { respondInvitation } from '../server/invitationService.js'
import { createDeletionService } from '../server/accountDeletion.js'
import { persistGameResults } from '../server/gameResults.js'

let replica, database, Room, Invitation
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  database = new mongoose.Mongoose()
  await database.connect(replica.getUri(), { dbName: 'hardening-tests' })
  Room = database.model('Room', new database.Schema({ code: String, status: String, inviteToken: String, settings: database.Schema.Types.Mixed, players: [database.Schema.Types.Mixed] }))
  installInvitations(express(), { mongoose: database, Room, Friend: {}, Profile: {}, GuestSession: {}, requireDatabase: (_req, _res, next) => next(), requireClerk: (_req, _res, next) => next(), social: { to() { return this }, emit() {} } })
  Invitation = database.model('GameInvitation')
  await Promise.all([Room.init(), Invitation.init()])
}, { timeout: 180000 })
after(async () => { await database?.disconnect(); await replica?.stop() })
beforeEach(async () => { await Promise.all([Room.deleteMany({}), Invitation.deleteMany({}), ...(database.models.AccountDeletion ? [database.models.AccountDeletion.deleteMany({})] : [])]) })
const session = (id) => ({ tokenHash: id, displayName: id, avatar: '🦅' })
async function room(maxPlayers = 2) { return Room.create({ code: 'ABC123', status: 'lobby', settings: { maxPlayers, startingCash: 1500000 }, players: [{ sessionHash: 'host' }] }) }
async function invite(recipientId) { return Invitation.create({ inviterId: 'host', recipientId, roomId: 'ABC123', expiresAt: new Date(Date.now() + 60000) }) }
const respond = (invitation, actorId, status = 'accepted', models = {}) => respondInvitation({ connection: database.connection, Invitation, Room, id: invitation._id, actorId, status, gameSession: session(actorId), ...models })

test('full room rolls back invitation acceptance', async () => {
  await room(1); const invitation = await invite('alice')
  await assert.rejects(respond(invitation, 'alice'))
  assert.equal((await Invitation.findById(invitation._id)).status, 'pending')
  assert.equal((await Room.findOne()).players.length, 1)
})
test('concurrent acceptance cannot overfill the last seat', async () => {
  await room(); const first = await invite('alice'), second = await invite('bob')
  const results = await Promise.allSettled([respond(first, 'alice'), respond(second, 'bob')])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(await Invitation.countDocuments({ status: 'accepted' }), 1)
  assert.equal((await Room.findOne()).players.length, 2)
})
test('replayed acceptance inserts the player exactly once', async () => {
  await room(); const invitation = await invite('alice')
  const results = await Promise.allSettled([respond(invitation, 'alice'), respond(invitation, 'alice')])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal((await Room.findOne()).players.filter((player) => player.sessionHash === 'alice').length, 1)
})
test('concurrent reject and accept have a single consistent outcome', async () => {
  await room(); const invitation = await invite('alice')
  const results = await Promise.allSettled([respond(invitation, 'alice'), respond(invitation, 'alice', 'rejected')])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const accepted = (await Invitation.findById(invitation._id)).status === 'accepted'
  assert.equal((await Room.findOne()).players.length, accepted ? 2 : 1)
})
test('partial room write failure aborts the invitation transaction', async () => {
  await room(); const invitation = await invite('alice')
  await assert.rejects(respond(invitation, 'alice', 'accepted', { Room: { findOne: (...args) => Room.findOne(...args), findOneAndUpdate: async () => { throw new Error('injected storage failure') } } }))
  assert.equal((await Invitation.findById(invitation._id)).status, 'pending')
  await respond(invitation, 'alice')
  assert.equal((await Invitation.findById(invitation._id)).status, 'accepted')
})
test('expired invitations cannot grant private room access', async () => {
  await room(); const invitation = await invite('alice')
  await Invitation.updateOne({ _id: invitation._id }, { $set: { expiresAt: new Date(0) } })
  await assert.rejects(respond(invitation, 'alice'))
  assert.equal((await Room.findOne()).players.length, 1)
})
test('unique pending invitation index rejects concurrent duplicates', async () => {
  const results = await Promise.allSettled([invite('alice'), invite('alice')])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
})
test('deletion blocks authentication before remote deletion and retries cleanup safely', async () => {
  let fail = true, deleted = false, cleanupCalls = 0
  const deletion = createDeletionService({ mongoose: database, deleteIdentity: async () => { if (deleted) throw Object.assign(new Error('already gone'), { status: 404 }); deleted = true }, disconnect: async () => {}, cleanup: async () => { cleanupCalls++; if (fail) throw new Error('database temporarily unavailable') } })
  await deletion.Job.init()
  await deletion.request('deleting-user')
  assert.equal(await deletion.blocked('deleting-user'), true)
  await deletion.runOne()
  assert.equal((await deletion.Job.findOne({ clerkId: 'deleting-user' })).status, 'pending')
  fail = false
  await deletion.Job.updateOne({ clerkId: 'deleting-user' }, { $set: { nextAttemptAt: new Date(0) } })
  await deletion.runOne()
  assert.equal((await deletion.Job.findOne({ clerkId: 'deleting-user' })).status, 'completed')
  assert.equal(cleanupCalls, 2)
  assert.equal(await deletion.blocked('deleting-user'), true)
  assert.equal(await deletion.blocked('unrelated-user'), false)
})

test('completed game statistics persist once across retries and preserve winner/loser outcomes', async () => {
  const schema = new database.Schema({ gameId: String, clerkId: String, won: Boolean, completedAt: Date })
  schema.index({ gameId: 1, clerkId: 1 }, { unique: true })
  const GameResult = database.model('TestGameResult', schema)
  await GameResult.init()
  const game = { persistenceId: 'game1', roomCode: 'ABC123', status: 'finished', winnerId: 'a', players: [{ id: 'a' }, { id: 'b' }] }
  const GuestSession = { find: () => ({ lean: async () => [{ tokenHash: 'a', clerkId: 'alice' }, { tokenHash: 'b', clerkId: 'bob' }] }) }
  await room()
  for (let count = 0; count < 3; count++) await persistGameResults({ game, GameResult, GuestSession, Room })
  assert.equal(await GameResult.countDocuments(), 2)
  assert.equal((await GameResult.findOne({ clerkId: 'alice' })).won, true)
  assert.equal((await GameResult.findOne({ clerkId: 'bob' })).won, false)
  assert.equal((await Room.findOne()).status, 'finished')
})

test('remote deletion failure leaves a blocked durable job and does not clean another identity', async () => {
  const affected = []
  let available = false
  const deletion = createDeletionService({ mongoose: database, deleteIdentity: async (id) => { assert.equal(id, 'alice'); if (!available) throw new Error('Clerk unavailable') }, disconnect: async () => {}, cleanup: async (id, hashes) => affected.push({ id, hashes }) })
  await deletion.request('alice', ['saved-game-hash'])
  await deletion.runOne()
  assert.deepEqual(affected, [])
  assert.equal(await deletion.blocked('alice'), true)
  available = true
  await deletion.Job.updateOne({ clerkId: 'alice' }, { $set: { nextAttemptAt: new Date(0) } })
  await deletion.runOne()
  assert.deepEqual(affected, [{ id: 'alice', hashes: ['saved-game-hash'] }])
})

test('concurrent deletion workers claim a job once and duplicate requests are idempotent', async () => {
  let cleaned = 0
  const deletion = createDeletionService({ mongoose: database, deleteIdentity: async () => {}, disconnect: async () => {}, cleanup: async () => { cleaned++ } })
  await deletion.Job.init()
  await Promise.all([deletion.request('alice'), deletion.request('alice')])
  await Promise.all([deletion.runOne(), deletion.runOne()])
  assert.equal(cleaned, 1)
  assert.equal(await deletion.Job.countDocuments({ clerkId: 'alice' }), 1)
})
