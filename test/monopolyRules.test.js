import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_RULES, PHASES, calculateRentForTile, calculateTax, canBuildEvenly, canSellEvenly, createBankInventory, createTurnState, movePosition, resolveDice, resolveJailAttempt, calculateRailroadRent, calculateUtilityRent, mortgageRepayment, mortgageValue, settleBankruptcy, validateBoardConfiguration, validatePropertyRentTables } from '../server/monopolyRules.js'
import { createGame, endTurn, rollDice, sanitizeGame, startGame } from '../server/gameEngine.js'

test('doubles grant an extra roll and three doubles send player to jail', () => {
  let state = createTurnState()
  state = resolveDice([2, 2], state)
  assert.equal(state.extraTurn, true)
  state = resolveDice([3, 3], state)
  assert.equal(state.doubles, 2)
  state = resolveDice([4, 4], state)
  assert.equal(state.sendToJail, true)
  assert.equal(state.phase, PHASES.JAIL)
})

test('board configuration validator rejects malformed board definitions', () => {
  assert.equal(validateBoardConfiguration([{ id: 0, type: 'start' }]).ok, false)
  assert.equal(validateBoardConfiguration(Array.from({ length: 40 }, (_, id) => ({ id, type: id === 0 ? 'start' : 'empty' }))).ok, true)
})

test('board configuration validator rejects malformed developed rent levels', () => {
  const valid = Array.from({ length: 40 }, (_, id) => id === 0 ? { id, type: 'start' } : { id, type: 'property', price: 100, rentLevels: [10, 20, 30, 40, 50] })
  assert.equal(validateBoardConfiguration(valid).ok, true)
  valid[1].rentLevels = [10, 20]
  assert.equal(validateBoardConfiguration(valid).reason, 'property-rent-levels-must-contain-five-non-negative-values')
})

test('tax resolver defaults to printed tax and supports percentage custom rules', () => {
  assert.equal(calculateTax({ amount: 50000 }, 1000000), 50000)
  assert.equal(calculateTax({ rate: 0.05 }, 1000000, { taxMode: 'percentage' }), 50000)
})

test('custom property rent tables are validated and used for developed rent', () => {
  assert.equal(validatePropertyRentTables({ 1: [10, 20, 30, 40, 50] }), true)
  assert.equal(validatePropertyRentTables({ 1: [10, 20] }), false)
  const game = { houses: { 1: 3 }, rules: { propertyRentTables: { 1: [10, 20, 30, 40, 50] } }, mortgaged: {} }
  assert.equal(calculateRentForTile({ tile: { id: 1, type: 'property', rent: 5 }, game, board: [], ownerId: 'a' }), 30)
})

test('developed rent cannot fall back to base rent without a complete table', () => {
  const game = { houses: { 1: 1 }, rules: { propertyRentTables: {} }, mortgaged: {} }
  assert.throws(() => calculateRentForTile({ tile: { id: 1, type: 'property', rent: 10 }, game, board: [ { id: 1, type: 'property' } ], ownerId: 'a' }), /five-level developed rent/i)
})

test('sanitized multiplayer state exposes authoritative phase and jail status', () => {
  const game = createGame({ code: 'SYNC', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  game.players[0].jail = { turns: 2 }
  game.turnState.phase = PHASES.JAIL
  const state = sanitizeGame(game)
  assert.equal(state.phase, PHASES.JAIL)
  assert.deepEqual(state.players[0].jail, { turns: 2 })
})

test('sanitized multiplayer state preserves authoritative event IDs', () => {
  const game = createGame({ code: 'EVENT-SYNC', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  game.events = [{ id: 7, type: 'purchase', playerId: 'a', propertyId: 1 }]
  assert.deepEqual(sanitizeGame(game).events, game.events)
})

test('Classic game cannot start with fewer than two players', () => {
  const game = createGame({ code: 'MIN-PLAYERS', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  assert.throws(() => startGame(game, 'a'), /two players/i)
  assert.equal(game.status, 'lobby')
})

test('game start rejects unsupported legacy board maps', () => {
  const game = createGame({ code: 'BAD-MAP', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000, map: 'Улаанбаатар' } })
  assert.throws(() => startGame(game, 'a'), /unsupported board map/i)
})

test('movement reports passing GO exactly once', () => {
  assert.deepEqual(movePosition(38, 4), { position: 2, passedGo: true })
  assert.deepEqual(movePosition(10, 4), { position: 14, passedGo: false })
})

test('authoritative movement events expose exact token path metadata', () => {
  const game = createGame({ code: 'MOVE-EVENT', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000, randomOrder: false } })
  game.status = 'playing'
  game.currentPlayerId = 'a'
  rollDice(game, 'a', [3, 4])
  assert.deepEqual(game.events.find((event) => event.type === 'movement'), { id: 1, type: 'movement', playerId: 'a', from: 0, to: 7, steps: 7, path: [1, 2, 3, 4, 5, 6, 7], passedGo: false, source: 'dice' })
})

test('jail releases on doubles or after the third failed attempt with bail', () => {
  assert.deepEqual(resolveJailAttempt({ dice: [5, 5], jailTurns: 0 }), { released: true, move: 10, jailTurns: 0, phase: PHASES.RESOLVE })
  const result = resolveJailAttempt({ dice: [1, 2], jailTurns: 2 })
  assert.equal(result.bailDue, DEFAULT_RULES.jailBail)
  assert.equal(result.released, true)
})

test('railroad and utility rent scale by ownership count', () => {
  assert.equal(calculateRailroadRent(25000, 1), 25000)
  assert.equal(calculateRailroadRent(25000, 4), 200000)
  assert.equal(calculateUtilityRent(8, 1), 80)
  assert.equal(calculateUtilityRent(8, 2), 800)
})

test('special rent resolution handles railroads, utilities, monopolies, and mortgages', () => {
  const board = [{ id: 5, type: 'transport', rent: 25000 }, { id: 15, type: 'transport', rent: 25000 }, { id: 12, type: 'utility' }, { id: 1, type: 'property', rent: 10000, rentLevels: [50000, 150000] }]
  const game = { properties: { 5: 'owner', 15: 'owner', 12: 'owner', 1: 'owner' }, houses: {}, mortgaged: {}, settings: { doubledSetRent: true } }
  assert.equal(calculateRentForTile({ tile: board[0], board, game, ownerId: 'owner', diceTotal: 8 }), 50000)
  assert.equal(calculateRentForTile({ tile: board[2], board, game, ownerId: 'owner', diceTotal: 8 }), 80)
  assert.equal(calculateRentForTile({ tile: board[3], board, game, ownerId: 'owner', monopoly: true }), 20000)
  game.mortgaged[1] = true
  assert.equal(calculateRentForTile({ tile: board[3], board, game, ownerId: 'owner', monopoly: true }), 0)
})

test('building is even and consumes finite bank inventory', () => {
  const board = [{ id: 1, group: 'red' }, { id: 2, group: 'red' }]
  const properties = { 1: 'p', 2: 'p' }
  assert.equal(canBuildEvenly({ board, properties, houses: { 1: 0, 2: 0 }, ownerId: 'p', group: 'red', propertyId: 1, bankHouses: 32, bankHotels: 12 }).ok, true)
  assert.equal(canBuildEvenly({ board, properties, houses: { 1: 1, 2: 0 }, ownerId: 'p', group: 'red', propertyId: 1, bankHouses: 32, bankHotels: 12 }).reason, 'even-building-required')
  assert.equal(canBuildEvenly({ board, properties, houses: { 1: 4, 2: 4 }, ownerId: 'p', group: 'red', propertyId: 1, bankHouses: 32, bankHotels: 0 }).reason, 'hotel-shortage')
})

test('bank inventory starts with official Classic supplies and selling is even', () => {
  assert.deepEqual(createBankInventory(), { houses: 32, hotels: 12 })
  const board = [{ id: 1, group: 'red' }, { id: 2, group: 'red' }]
  assert.equal(canSellEvenly({ board, houses: { 1: 2, 2: 1 }, group: 'red', propertyId: 2 }).reason, 'even-selling-required')
})

test('mortgage value is half price and repayment includes configurable interest', () => {
  assert.equal(mortgageValue(180000), 90000)
  assert.equal(mortgageRepayment(180000), 99000)
})

test('end turn keeps the same player after doubles', () => {
  const game = createGame({ code: 'DOUBLE', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.dice = [3, 3]; game.turnState = { phase: PHASES.MANAGE, extraTurn: true, doubles: 1 }
  endTurn(game, 'a')
  assert.equal(game.currentPlayerId, 'a')
  assert.equal(game.turn, 0)
  assert.equal(game.turnState.phase, PHASES.ROLL)
})

test('bankruptcy to creditor transfers property and returns buildings at half value', () => {
  const players = [{ id: 'debtor', balance: 0, bankrupt: false }, { id: 'creditor', balance: 100, bankrupt: false }]
  const properties = { 1: 'debtor', 2: 'debtor' }
  const houses = { 1: 2 }
  const mortgaged = { 2: true }
  const mortgageInterestDue = {}
  const board = [{ id: 1, group: 'red', buildCost: 50, price: 100 }, { id: 2, group: 'red', buildCost: 50, price: 100 }]
  const result = settleBankruptcy({ playerId: 'debtor', creditorId: 'creditor', players, properties, houses, mortgaged, mortgageInterestDue, board })
  assert.deepEqual(result.transferred, [1, 2])
  assert.equal(properties[1], 'creditor')
  assert.equal(houses[1], undefined)
  assert.equal(creditorBalance(players), 145)
  assert.equal(mortgaged[2], true)
  assert.equal(mortgageInterestDue[2], 5)
})

const creditorBalance = (players) => players.find((player) => player.id === 'creditor').balance

test('bankruptcy to bank clears mortgage state and returns property to the bank', () => {
  const players = [{ id: 'debtor', balance: 0, bankrupt: false }]
  const properties = { 1: 'debtor' }; const mortgaged = { 1: true }; const dues = {}
  settleBankruptcy({ playerId: 'debtor', players, properties, houses: {}, mortgaged, mortgageInterestDue: dues, board: [{ id: 1, price: 100 }], creditorId: null })
  assert.equal(properties[1], undefined)
  assert.equal(mortgaged[1], undefined)
  assert.equal(dues[1], undefined)
})

test('bankruptcy restores houses and hotels to the finite bank inventory', () => {
  const players = [{ id: 'debtor', balance: 0, bankrupt: false }]
  const properties = { 1: 'debtor', 2: 'debtor' }
  const houses = { 1: 2, 2: 5 }
  const bank = { houses: 10, hotels: 4 }
  const result = settleBankruptcy({ playerId: 'debtor', players, properties, houses, mortgaged: {}, mortgageInterestDue: {}, bank, board: [
    { id: 1, price: 100, buildCost: 50 }, { id: 2, price: 200, buildCost: 100 }
  ] })
  assert.equal(bank.houses, 12)
  assert.equal(bank.hotels, 5)
  assert.equal(result.buildingProceeds, 100)
})

test('rent tables reject non-property board targets', () => {
  const board = [{ id: 1, type: 'property' }, { id: 2, type: 'tax' }]
  assert.equal(validatePropertyRentTables({ 1: [1, 2, 3, 4, 5] }, board), true)
  assert.equal(validatePropertyRentTables({ 2: [1, 2, 3, 4, 5] }, board), false)
})
