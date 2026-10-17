import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import { installInvitations } from '../server/invitations.js'

async function fixture(run, { room = null, friend = false } = {}) {
  const app = express(); app.use(express.json())
  const documents = []
  const Invitation = {
    find: () => Promise.resolve([]),
    create: async (data) => { const document = { ...data, id: 'invitation' }; documents.push(document); return document },
    findOne: async () => null,
  }
  class Schema { index() {} }
  installInvitations(app, {
    mongoose: { Schema, model: () => Invitation, isValidObjectId: (id) => /^[0-9a-f]{24}$/.test(id) },
    Room: { findOne: async () => room }, Friend: { exists: async () => friend }, Profile: {},
    GuestSession: { findOne: async () => ({ tokenHash: 'session' }) }, hashToken: (token) => token,
    requireDatabase: (req, res, next) => next(),
    requireClerk: (req, res, next) => { if (req.headers.authorization !== 'Bearer valid') return res.status(401).json({ error: 'Нэвтрэх шаардлагатай.' }); req.clerkId = 'alice'; next() },
    social: { to() { return this }, emit() {} },
  })
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try { await run(`http://127.0.0.1:${server.address().port}`, documents) } finally { await new Promise((resolve) => server.close(resolve)) }
}

test('invitation endpoints reject unauthenticated clients', async () => fixture(async (base) => {
  const response = await fetch(`${base}/api/invitations`)
  assert.equal(response.status, 401)
}))
test('invitation creation rejects missing rooms', async () => fixture(async (base) => {
  const response = await fetch(`${base}/api/invitations`, { method: 'POST', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json', 'X-Game-Token': 'session' }, body: JSON.stringify({ roomId: 'ABC123', recipientId: 'bob' }) })
  assert.equal(response.status, 403)
}))
test('invitation creation requires an accepted friendship', async () => fixture(async (base) => {
  const response = await fetch(`${base}/api/invitations`, { method: 'POST', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json', 'X-Game-Token': 'session' }, body: JSON.stringify({ roomId: 'ABC123', recipientId: 'bob' }) })
  assert.equal(response.status, 403)
}, { room: { players: [{ sessionHash: 'session' }], settings: { maxPlayers: 4 } } }))
test('valid invitation persists pending state and server-controlled expiration', async () => fixture(async (base, documents) => {
  const response = await fetch(`${base}/api/invitations`, { method: 'POST', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json', 'X-Game-Token': 'session' }, body: JSON.stringify({ roomId: 'ABC123', recipientId: 'bob', inviterId: 'attacker', expiresAt: 0 }) })
  assert.equal(response.status, 201)
  assert.equal(documents[0].inviterId, 'alice')
  assert.ok(documents[0].expiresAt.getTime() > Date.now())
}, { room: { players: [{ sessionHash: 'session' }], settings: { maxPlayers: 4 } }, friend: true }))
