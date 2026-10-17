import test from 'node:test'
import assert from 'node:assert/strict'
import { createCardState, drawCard, returnJailCard, shuffleCards, validateCardDecks } from '../server/cards.js'
import { createClassicDecks } from '../server/cards.js'
import { createGame, rollDice } from '../server/gameEngine.js'

test('Classic decks contain sixteen Chance and sixteen Community Chest cards', () => {
  const decks = createClassicDecks()
  assert.equal(decks.chance.length, 16)
  assert.equal(decks.chest.length, 16)
})

test('custom card decks are validated before entering authoritative state', () => {
  assert.equal(validateCardDecks({ chance: [{ id: 'ok', type: 'advance', target: 0 }], chest: [] }), true)
  assert.equal(validateCardDecks({ chance: [{ id: 'bad', type: 'advance', target: 40 }], chest: [] }), false)
  assert.equal(validateCardDecks({ chance: [{ id: 'same', type: 'collect', amount: 1 }, { id: 'same', type: 'collect', amount: 1 }], chest: [] }), false)
  assert.equal(validateCardDecks({ chance: [{ id: 'cross', type: 'collect', amount: 1 }], chest: [{ id: 'cross', type: 'collect', amount: 1 }] }), false)
  assert.throws(() => createCardState({ chance: [{ id: 'bad', type: 'pay', amount: -1 }], chest: [] }), /card deck/i)
})

test('card decks draw, discard, and recycle non-retainable cards', () => {
  const state = createCardState({ chance: [{ id: 'one', type: 'collect', amount: 1 }], chest: [] })
  assert.equal(drawCard(state, 'chance', () => 0).id, 'one')
  assert.equal(state.decks.chance.discard.length, 1)
  assert.equal(drawCard(state, 'chance', () => 0).id, 'one')
})

test('card shuffling accepts an injectable deterministic random source', () => {
  const cards = [{ id: 'a', type: 'collect', amount: 1 }, { id: 'b', type: 'collect', amount: 1 }, { id: 'c', type: 'collect', amount: 1 }]
  const random = () => 0
  assert.deepEqual(shuffleCards(cards, random).map((card) => card.id), ['b', 'c', 'a'])
  assert.deepEqual(createCardState({ chance: cards, chest: [] }, random).decks.chance.draw.map((card) => card.id), ['b', 'c', 'a'])
})

test('recycled discard piles use the same deterministic shuffle contract', () => {
  const state = createCardState({ chance: [{ id: 'a', type: 'collect', amount: 1 }, { id: 'b', type: 'collect', amount: 1 }, { id: 'c', type: 'collect', amount: 1 }], chest: [] }, () => 0)
  const first = drawCard(state, 'chance', () => 0)
  const second = drawCard(state, 'chance', () => 0)
  const third = drawCard(state, 'chance', () => 0)
  assert.deepEqual([first.id, second.id, third.id], ['b', 'c', 'a'])
  assert.equal(state.decks.chance.draw.length, 0)
  assert.deepEqual(state.decks.chance.discard.map((card) => card.id), ['b', 'c', 'a'])
  assert.equal(drawCard(state, 'chance', () => 0).id, 'c')
})

test('Get Out of Jail Free cards stay out of the draw deck until returned', () => {
  const state = createCardState({ chance: [{ id: 'free', type: 'get-out-of-jail' }], chest: [] })
  const card = drawCard(state, 'chance', () => 0)
  assert.equal(state.decks.chance.draw.length, 0)
  assert.equal(state.decks.chance.discard.length, 0)
  returnJailCard(state, 'chance', card.id)
  assert.equal(state.decks.chance.discard.length, 1)
  assert.equal(returnJailCard(state, 'chance', card.id), false)
  assert.equal(state.decks.chance.discard.length, 1)
})

test('drawing a card emits an authoritative card event', () => {
  const game = createGame({ code: 'CARD-EVENT', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'; game.currentPlayerId = 'a'; game.cards.decks.chance.draw = [{ id: 'event-card', type: 'collect', amount: 1, title: 'Custom title', titleMn: 'Монгол гарчиг', text: 'Event.', textMn: 'Монгол тайлбар' }]
  rollDice(game, 'a', [1, 1])
  const event = game.events.find((item) => item.type === 'card')
  assert.equal(event?.cardId, 'event-card')
  assert.equal(event?.card?.title, 'Custom title')
  assert.equal(event?.card?.titleMn, 'Монгол гарчиг')
  assert.equal(event?.card?.text, 'Event.')
})

test('Chance nearest railroad applies the official double-rent rule once', () => {
  const game = createGame({ code: 'CARD-RAIL', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'
  game.currentPlayerId = 'a'
  game.players[0].balance = 1000000
  game.players[1].balance = 0
  game.properties[5] = 'b'
  game.cards.decks.chance.draw = [{ id: 'rail-card', type: 'nearest', targetType: 'transport', rentMultiplier: 2, text: 'Advance to railroad.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].position, 5)
  assert.equal(game.players[0].balance, 900000)
  assert.equal(game.players[1].balance, 100000)
  assert.equal(game.pendingCardRent, undefined)
})

test('Chance nearest utility charges ten times the dice total, not ownership-scaled utility rent', () => {
  const game = createGame({ code: 'CARD-UTILITY', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000 } })
  game.status = 'playing'
  game.currentPlayerId = 'a'
  game.players[0].balance = 1000000
  game.players[1].balance = 0
  game.properties[12] = 'b'
  game.properties[23] = 'b'
  game.cards.decks.chance.draw = [{ id: 'utility-card', type: 'nearest', targetType: 'utility', text: 'Advance to utility.' }]
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].position, 12)
  assert.equal(game.players[0].balance, 999980)
  assert.equal(game.players[1].balance, 20)
  assert.equal(game.pendingCardUtilityRent, undefined)
})
