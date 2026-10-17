import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProperty, createGame, mortgageProperty, repayMortgage, sellBuilding } from '../server/gameEngine.js'

const buildTestGame = (room) => {
  const game = createGame(room)
  game.rules.propertyRentTables = { 1: [22000, 66000, 182000, 360000, 550000], 3: [28000, 84000, 230000, 420000, 620000], 26: [30000, 90000, 250000, 450000, 700000], 27: [28000, 84000, 230000, 420000, 620000], 29: [26000, 78000, 220000, 400000, 600000] }
  return game
}

test('building is rejected when a custom property has no developed-rent table', () => {
  const game = createGame({ code: 'NO-RENT-TABLE', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, evenBuild: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.properties[1] = 'a'; game.properties[3] = 'a'
  assert.throws(() => buildProperty(game, 'a', 1), /rent table/i)
})

test('selling a building returns half cost and restores bank supply', () => {
  const game = buildTestGame({ code: 'BUILD', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, evenBuild: true, mortgage: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'
  game.properties[1] = 'a'; game.properties[3] = 'a'
  game.houses[1] = 1
  const before = game.players[0].balance
  const bankBefore = game.bank.houses
  sellBuilding(game, 'a', 1)
  assert.equal(game.players[0].balance, before + 45000)
  assert.equal(game.bank.houses, bankBefore + 1)
  assert.equal(game.houses[1], undefined)
})

test('hotel purchase exchanges four houses and hotel sale restores them', () => {
  const game = buildTestGame({ code: 'HOTEL', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, evenBuild: true, mortgage: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'
  ;[1, 3, 26, 27, 29].forEach((id) => { game.properties[id] = 'a'; game.houses[id] = 4 })
  const housesBefore = game.bank.houses
  game.houses[1] = 4
  buildProperty(game, 'a', 1)
  assert.equal(game.houses[1], 5)
  assert.equal(game.bank.houses, housesBefore + 4)
  assert.equal(game.bank.hotels, 11)
  sellBuilding(game, 'a', 1)
  assert.equal(game.houses[1], 4)
  assert.equal(game.bank.houses, housesBefore)
  assert.equal(game.bank.hotels, 12)
})

test('jailed players cannot build and improved properties cannot be mortgaged', () => {
  const game = buildTestGame({ code: 'RESTRICT', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, evenBuild: true, mortgage: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'
  game.properties[1] = 'a'; game.properties[3] = 'a'; game.houses[1] = 1
  assert.throws(() => mortgageProperty(game, 'a', 1), /buildings/i)
  game.houses[1] = 0; game.players[0].jail = { turns: 1 }
  assert.throws(() => buildProperty(game, 'a', 1), /jail/i)
})

test('jailed players cannot sell buildings', () => {
  const game = buildTestGame({ code: 'JAIL-SELL', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, evenBuild: true, mortgage: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'
  game.properties[1] = 'a'; game.properties[3] = 'a'; game.houses[1] = 1
  game.players[0].jail = { turns: 1 }
  game.houses[1] = 1
  assert.throws(() => sellBuilding(game, 'a', 1), /cannot sell buildings/i)
})

test('bank inventory is enforced even when even-building is disabled', () => {
  const game = buildTestGame({ code: 'SHORTAGE', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, evenBuild: false, mortgage: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'; [1, 3, 26, 27, 29].forEach((id) => { game.properties[id] = 'a' }); game.bank.houses = 0
  assert.throws(() => buildProperty(game, 'a', 1), /houses remain/i)
  game.bank.houses = 32; game.houses[1] = 4; game.houses[3] = 4; game.houses[26] = 4; game.houses[27] = 4; game.houses[29] = 4; game.bank.hotels = 0
  assert.throws(() => buildProperty(game, 'a', 1), /hotels remain/i)
})

test('mortgage requires all buildings in the color group to be sold', () => {
  const game = buildTestGame({ code: 'GROUP-MORTGAGE', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, evenBuild: true, mortgage: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.properties[1] = 'a'; game.properties[3] = 'a'; game.houses[3] = 1
  assert.throws(() => mortgageProperty(game, 'a', 1), /color group/i)
})

test('mortgage repayment honors the recorded transfer interest obligation', () => {
  const game = buildTestGame({ code: 'MORTGAGE-DUE', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, mortgage: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.properties[1] = 'a'; game.mortgaged[1] = true; game.mortgageInterestDue[1] = 1234
  const before = game.players[0].balance
  repayMortgage(game, 'a', 1)
  assert.equal(game.players[0].balance, before - 90000 - 1234)
  assert.equal(game.mortgageInterestDue[1], undefined)
})
