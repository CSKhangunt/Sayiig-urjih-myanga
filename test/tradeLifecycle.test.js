import test from 'node:test'
import assert from 'node:assert/strict'
import { cancelTrade, counterTrade, createGame, createTrade, removeDisconnectedTransactions, respondToTrade, rollDice, skipExpiredTurn } from '../server/gameEngine.js'

const makeGame = () => {
  const game = createGame({ code: 'TEST', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'
  game.properties[1] = 'a'
  game.properties[3] = 'b'
  return game
}

test('trade cancellation removes the offer without changing assets', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 10000, 1)
  const id = game.trades[0].id
  assert.equal(game.events.at(-1).type, 'trade-offer')
  cancelTrade(game, 'a', id)
  assert.equal(game.trades.length, 0)
  assert.equal(game.events.at(-1).type, 'trade-cancelled')
  assert.equal(game.properties[1], 'a')
})

test('counteroffer invalidates the original offer and creates a fresh offer', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 10000, 1)
  const originalId = game.trades[0].id
  counterTrade(game, 'b', originalId, { cashOffer: 5000, properties: [3], requestedProperties: [1] })
  assert.equal(game.trades.length, 1)
  assert.notEqual(game.trades[0].id, originalId)
  assert.deepEqual(game.trades[0].properties, [3])
  assert.deepEqual(game.trades[0].requestedProperties, [1])
})

test('public-id addressed trade can be accepted by the real recipient session', () => {
  const game = makeGame()
  const recipientPublicId = game.players.find((player) => player.id === 'b').publicId
  createTrade(game, 'a', recipientPublicId, 10000, 1)
  const tradeId = game.trades[0].id
  respondToTrade(game, 'b', tradeId, true)
  assert.equal(game.properties[1], 'b')
  assert.equal(game.players.find((player) => player.id === 'a').balance, 990000)
  assert.equal(game.players.find((player) => player.id === 'b').balance, 1010000)
})

test('stale trade versions are rejected before any asset transfer', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 10000, 1)
  const tradeId = game.trades[0].id
  assert.throws(() => respondToTrade(game, 'b', tradeId, true, 0), /changed|version/i)
  assert.equal(game.properties[1], 'a')
  assert.equal(game.trades.length, 1)
})

test('mortgaged property trades charge the recipient transfer interest', () => {
  const game = makeGame()
  game.mortgaged[1] = true
  const before = game.players.find((player) => player.id === 'b').balance
  createTrade(game, 'a', 'b', 0, 1)
  respondToTrade(game, 'b', game.trades[0].id, true, 1)
  assert.equal(game.properties[1], 'b')
  assert.equal(game.players.find((player) => player.id === 'b').balance, before - 9000)
  assert.equal(game.mortgageInterestDue[1], 9000)
})

test('mortgaged property trades can be prohibited by the rules configuration', () => {
  const game = makeGame()
  game.mortgaged[1] = true
  game.rules.allowMortgagedTrade = false
  assert.throws(() => createTrade(game, 'a', 'b', 0, 1), /trade|Хөрөнгө/i)
})

test('invalid multi-asset trade is atomic and changes nothing', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 10000, 1, { properties: [1], requestedProperties: [3], requestedCash: 900000 })
  const tradeId = game.trades[0].id
  game.players.find((player) => player.id === 'b').balance = 1000
  const before = game.players.map((player) => ({ id: player.id, balance: player.balance }))
  assert.throws(() => respondToTrade(game, 'b', tradeId, true), /money|balance|cash|мөнгө|хүрэлцэхгүй/i)
  assert.deepEqual(game.players.map((player) => ({ id: player.id, balance: player.balance })), before)
  assert.equal(game.properties[1], 'a')
  assert.equal(game.properties[3], 'b')
  assert.equal(game.trades.length, 1)
})

test('duplicate assets cannot be submitted in a trade', () => {
  const game = makeGame()
  assert.throws(() => createTrade(game, 'a', 'b', 0, null, { properties: [1, 1] }), /once|duplicate/i)
  assert.equal(game.trades.length, 0)
})

test('invalid counteroffer preserves the original offer', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 10000, 1)
  const originalId = game.trades[0].id
  assert.throws(() => counterTrade(game, 'b', originalId, { properties: [2], requestedProperties: [1] }), /owned|trade|эзэмшигч/i)
  assert.equal(game.trades.length, 1)
  assert.equal(game.trades[0].id, originalId)
})

test('expired trade offers are removed by the authoritative server tick', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 10000, 1)
  game.trades[0].expiresAt = Date.now() - 1
  assert.equal(skipExpiredTurn(game), true)
  assert.equal(game.trades.length, 0)
  assert.equal(game.events.at(-1).type, 'trade-expired')
})

test('trade responses are rejected after the game has finished', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 10000, 1)
  const tradeId = game.trades[0].id
  game.status = 'finished'
  assert.throws(() => respondToTrade(game, 'b', tradeId, true), /closed/i)
  assert.equal(game.properties[1], 'a')
  assert.equal(game.trades.length, 1)
})

test('bankruptcy cancels open offers involving the bankrupt player', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 0, 1)
  game.players[0].position = 0; game.players[0].balance = 1000; game.cards.decks.chance.draw = [{ id: 'pay', type: 'pay', amount: 5000, text: 'Pay.' }]
  game.currentPlayerId = 'a'
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].bankrupt, true)
  assert.equal(game.trades.length, 0)
})

test('disconnecting a participant cancels their open offers', () => {
  const game = makeGame()
  createTrade(game, 'a', 'b', 0, 1)
  assert.equal(removeDisconnectedTransactions(game, 'b'), 1)
  assert.equal(game.trades.length, 0)
})
