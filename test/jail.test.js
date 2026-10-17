import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, payBail, rollDice, useJailCard } from '../server/gameEngine.js'

const jailGame = () => {
  const game = createGame({ code: 'JAIL', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'
  game.players[0].jail = { turns: 2 }
  return game
}

test('player can pay configurable bail to leave jail', () => {
  const game = jailGame()
  payBail(game, 'a')
  assert.equal(game.players[0].jail, null)
  assert.equal(game.players[0].balance, 950000)
})

test('Get Out of Jail Free card is consumed and returned to its deck', () => {
  const game = jailGame()
  game.players[0].cards = ['chance-jail-free']
  useJailCard(game, 'a', 'chance-jail-free')
  assert.equal(game.players[0].cards.length, 0)
  assert.equal(game.players[0].jail, null)
  assert.equal(game.cards.decks.chance.discard.at(-1).id, 'chance-jail-free')
})

test('jail actions cannot be performed out of turn', () => {
  const game = createGame({ code: 'JAIL-TURN', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'b'; game.players[0].jail = { turns: 1 }; game.players[0].cards = ['chance-jail-free']
  assert.throws(() => payBail(game, 'a'), /your turn/i)
  assert.throws(() => useJailCard(game, 'a', 'chance-jail-free'), /your turn/i)
})

test('card movement resolves the destination tile instead of the original card tile', () => {
  const game = createGame({ code: 'CARDMOVE', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000, auction: true } })
  game.status = 'playing'; game.currentPlayerId = 'a'
  game.cards.decks.chance.draw = [{ id: 'advance', type: 'advance', target: 0, text: 'Advance to GO.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].position, 0)
  assert.equal(game.players[0].balance, 1200000)
  const movement = game.events.find((event) => event.type === 'movement' && event.source === 'card')
  assert.deepEqual(movement, { id: 4, type: 'movement', playerId: 'a', from: 2, to: 0, steps: 38, path: Array.from({ length: 38 }, (_, index) => (2 + index + 1) % 40), passedGo: true, source: 'card' })
  assert.deepEqual(game.events.find((event) => event.type === 'go' && event.source === 'card'), { id: 3, type: 'go', playerId: 'a', amount: 200000, source: 'card' })
})

test('card and tax payments trigger authoritative bankruptcy instead of clamping balance', () => {
  const game = createGame({ code: 'PAY', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 0; game.players[0].balance = 1000; game.cards.decks.chance.draw = [{ id: 'pay', type: 'pay', amount: 5000, text: 'Pay.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].bankrupt, true)
  assert.equal(game.status, 'finished')
})

test('jail release roll resolves the destination property and rent', () => {
  const game = createGame({ code: 'JAIL-LAND', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 9; game.players[0].jail = { turns: 1 }; game.properties[11] = 'b'
  const before = game.players[0].balance
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].position, 11)
  assert.equal(game.players[0].jail, null)
  assert.equal(game.players[0].balance, before - 26000)
  assert.equal(game.players[1].balance, 1026000)
})

test('doubles used to leave jail grant the extra roll phase', () => {
  const game = createGame({ code: 'JAIL-DOUBLE', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 9; game.players[0].jail = { turns: 1 }
  rollDice(game, 'a', [2, 2])
  assert.equal(game.players[0].jail, null)
  assert.equal(game.turnState.phase, 'roll')
  assert.equal(game.turnState.extraTurn, true)
})

test('landing on Go To Jail sends the player to jail without paying GO', () => {
  const game = createGame({ code: 'GO-JAIL', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 8
  const before = game.players[0].balance
  rollDice(game, 'a', [6, 6])
  assert.equal(game.players[0].position, 10)
  assert.deepEqual(game.players[0].jail, { turns: 0 })
  assert.equal(game.players[0].balance, before)
  assert.equal(game.lastRoll.sentToJail, true)
  assert.equal(game.turnState.phase, 'jail')
})

test('Go To Jail cards enter the authoritative jail phase', () => {
  const game = createGame({ code: 'CARD-JAIL', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 6
  game.cards.decks.chest.draw = [{ id: 'chest-go-to-jail', type: 'jail', text: 'Go to jail.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].position, 10)
  assert.equal(game.turnState.phase, 'jail')
  assert.equal(game.lastRoll.viaCard, true)
})

test('Go To Jail keeps a numeric jail counter and nearest cards pay GO when wrapping', () => {
  const jail = createGame({ code: 'GO-JAIL', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  jail.status = 'playing'; jail.currentPlayerId = 'a'; jail.players[0].position = 0; jail.cards.decks.chance.draw = [{ id: 'go-jail', type: 'jail', text: 'Go directly to Jail.' }]
  rollDice(jail, 'a', [1, 1])
  assert.deepEqual(jail.players[0].jail, { turns: 0 })

  const nearest = createGame({ code: 'NEAREST', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  nearest.status = 'playing'; nearest.currentPlayerId = 'a'; nearest.players[0].position = 34; nearest.cards.decks.chest.draw = [{ id: 'nearest', type: 'nearest', targetType: 'transport', text: 'Advance to the nearest railroad.' }]
  rollDice(nearest, 'a', [1, 1])
  assert.equal(nearest.players[0].position, 5)
  assert.equal(nearest.players[0].balance, 1200000)
})

test('card movement resolves chained Chance destinations deterministically', () => {
  const game = createGame({ code: 'CHAIN', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'
  game.cards.decks.chance.draw = [{ id: 'advance-chance', type: 'advance', target: 8, text: 'Advance.' }]
  game.cards.decks.chest.draw = [{ id: 'bonus', type: 'collect', amount: 50000, text: 'Bonus.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].position, 8)
  assert.equal(game.players[0].balance, 1050000)
  assert.equal(game.players[0].lastCard, 'bonus')
})

test('player-to-player card transfers use bankruptcy rules for insufficient funds', () => {
  const game = createGame({ code: 'CARD-DEBT', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 0; game.players[1].balance = 1000; game.cards.decks.chance.draw = [{ id: 'birthday', type: 'collect-from-players', amount: 5000, text: 'Collect.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[1].bankrupt, true)
  assert.equal(game.status, 'finished')
})

test('repair cards charge house and hotel assessments', () => {
  const game = createGame({ code: 'REPAIRS', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 0; game.properties[1] = 'a'; game.houses[1] = 2
  game.cards.decks.chance.draw = [{ id: 'repairs', type: 'repairs', house: 100, hotel: 500, text: 'Repair.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].balance, 999800)
})

test('pay-each-player cards transfer cash to every active opponent', () => {
  const game = createGame({ code: 'PAY-EACH', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }, { sessionHash: 'c', displayName: 'C', avatar: 'c' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.cards.decks.chance.draw = [{ id: 'pay-each', type: 'pay-each-player', amount: 1000, text: 'Pay.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].balance, 998000)
  assert.equal(game.players[1].balance, 1001000)
  assert.equal(game.players[2].balance, 1001000)
})

test('backward movement cards resolve to the resulting board position', () => {
  const game = createGame({ code: 'BACK', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.cards.decks.chance.draw = [{ id: 'back', type: 'back', spaces: 1, text: 'Back.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].position, 1)
})

test('custom board card metadata routes mapped spaces to Community Chest', () => {
  const game = createGame({ code: 'CHEST-MAP', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 6; game.cards.decks.chest.draw = [{ id: 'chest-bonus', type: 'collect', amount: 25000, text: 'Bonus.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].position, 8)
  assert.equal(game.players[0].lastCard, 'chest-bonus')
  assert.equal(game.players[0].balance, 1025000)
})

test('bankruptcy returns retained Get Out of Jail Free cards to their deck', () => {
  const game = createGame({ code: 'CARD-RETURN', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 0; game.players[0].balance = 1000; game.players[0].cards = ['chance-jail-free']; game.cards.decks.chance.draw = [{ id: 'pay', type: 'pay', amount: 5000, text: 'Pay.' }]
  rollDice(game, 'a', [1, 1])
  assert.deepEqual(game.players[0].cards, [])
  assert.equal(game.cards.decks.chance.discard.at(-1).id, 'chance-jail-free')
})

test('bankruptcy to a creditor transfers retained cards to that creditor', () => {
  const game = createGame({ code: 'CARD-CREDITOR', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 0; game.players[0].balance = 1000; game.players[0].cards = ['chance-jail-free']; game.properties[3] = 'b'
  rollDice(game, 'a', [1, 2])
  assert.equal(game.players[0].bankrupt, true)
  assert.deepEqual(game.players[1].cards, ['chance-jail-free'])
  assert.equal(game.cards.decks.chance.discard.some((card) => card.id === 'chance-jail-free'), false)
})

test('bankruptcy advances the active turn to the next surviving player', () => {
  const game = createGame({ code: 'BANK-TURN', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }, { sessionHash: 'c', displayName: 'C', avatar: 'c' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.players[0].position = 0; game.players[0].balance = 1000; game.cards.decks.chance.draw = [{ id: 'pay', type: 'pay', amount: 5000, text: 'Pay.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].bankrupt, true)
  assert.equal(game.currentPlayerId, 'b')
  assert.equal(game.dice, null)
})
