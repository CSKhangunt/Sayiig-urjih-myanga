import test from 'node:test'
import assert from 'node:assert/strict'
import { auctionBid, auctionPass, buyProperty, createGame, declinePurchase, endTurn, removeAuctionBidder, rollDice, skipExpiredTurn, startAuction } from '../server/gameEngine.js'

const gameForAuction = () => {
  const game = createGame({ code: 'AUCT', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }, { sessionHash: 'c', displayName: 'C', avatar: 'c' }], settings: { startingCash: 1000000, auction: true } })
  game.status = 'playing'
  return game
}

test('auction resolves to the highest bidder and charges only the winner', () => {
  const game = gameForAuction()
  startAuction(game, 'a', 1)
  assert.equal(game.turnState.phase, 'auction')
  auctionBid(game, 'a', 10000)
  auctionBid(game, 'b', 20000)
  assert.equal(game.events.filter((event) => event.type === 'auction-bid').length, 2)
  auctionPass(game, 'a')
  auctionPass(game, 'c')
  assert.equal(game.auction, null)
  assert.equal(game.properties[1], 'b')
  assert.equal(game.turnState.phase, 'manage')
  assert.equal(game.players.find((p) => p.id === 'b').balance, 980000)
  assert.equal(game.events.at(-2).type, 'auction-win')
  assert.equal(game.events.at(-1).type, 'auction-close')
})

test('dice requests are rejected outside the roll or jail phase', () => {
  const game = gameForAuction()
  game.currentPlayerId = 'a'
  game.turnState.phase = 'manage'
  assert.throws(() => rollDice(game, 'a', [1, 2]), /ready for a dice roll/)
})

test('end turn is rejected until the active phase is resolved', () => {
  const game = gameForAuction()
  game.currentPlayerId = 'a'
  game.dice = [2, 3]
  game.turnState.phase = 'resolve'
  assert.throws(() => endTurn(game, 'a'), /Resolve the current turn phase/)
})

test('auction with all players passing leaves the property unowned', () => {
  const game = gameForAuction()
  startAuction(game, 'a', 1)
  auctionPass(game, 'a'); auctionPass(game, 'b')
  assert.equal(game.auction, null)
  assert.equal(game.properties[1], undefined)
  assert.equal(game.events.at(-1).type, 'auction-close')
})

test('disconnecting a bidder cannot leave a stale auction open', () => {
  const game = gameForAuction()
  startAuction(game, 'a', 1)
  auctionBid(game, 'b', 10000)
  removeAuctionBidder(game, 'a')
  removeAuctionBidder(game, 'c')
  assert.equal(game.auction, null)
  assert.equal(game.properties[1], 'b')
})

test('pending bank-returned properties are auctioned sequentially', () => {
  const game = gameForAuction()
  game.currentPlayerId = 'a'
  game.pendingBankAuctions = [3]
  startAuction(game, 'a', 1)
  auctionPass(game, 'a'); auctionPass(game, 'b')
  assert.equal(game.auction?.propertyId, 3)
})

test('ending after an affordable unowned landing requires an explicit purchase decision', () => {
  const game = gameForAuction()
  game.currentPlayerId = 'a'; game.players[0].position = 1; game.dice = [2, 2]; game.lastRoll = { playerId: 'a', tileId: 1 }
  game.turnState.phase = 'purchase'
  assert.throws(() => endTurn(game, 'a'), /purchase decision|buy.*auction/i)
  assert.equal(game.auction, null)
  assert.equal(game.currentPlayerId, 'a')
})

test('auction enforces the configured minimum bid increment', () => {
  const game = gameForAuction()
  game.rules.auctionMinimumIncrement = 5000
  startAuction(game, 'a', 1)
  auctionBid(game, 'a', 10000)
  assert.throws(() => auctionBid(game, 'b', 14000), /minimum increment/i)
  auctionBid(game, 'b', 15000)
  assert.equal(game.auction.highestBid, 15000)
})

test('expired no-bid auction closes and releases the turn', () => {
  const game = gameForAuction()
  game.currentPlayerId = 'a'
  startAuction(game, 'a', 1)
  game.auction.startedAt = Date.now() - game.auction.durationMs - 1
  assert.equal(skipExpiredTurn(game), true)
  assert.equal(game.auction, null)
  assert.equal(game.properties[1], undefined)
})

test('declining a purchase respects the room auction setting', () => {
  const game = gameForAuction()
  game.settings.auction = false; game.currentPlayerId = 'a'; game.players[0].position = 1; game.lastRoll = { playerId: 'a', tileId: 1 }
  assert.throws(() => declinePurchase(game, 'a'), /disabled/i)
  assert.equal(game.auction, null)
})

test('disconnecting the highest bidder restores the best remaining bid', () => {
  const game = gameForAuction()
  startAuction(game, 'a', 1)
  auctionBid(game, 'a', 10000)
  auctionBid(game, 'b', 20000)
  removeAuctionBidder(game, 'b')
  assert.equal(game.auction.highestBid, 10000)
  assert.equal(game.auction.highestBidderId, 'a')
})

test('stale purchase requests cannot bypass auction or phase state', () => {
  const game = gameForAuction()
  game.currentPlayerId = 'a'; game.players[0].position = 1; game.dice = [1, 1]; game.lastRoll = { playerId: 'a', tileId: 1 }; game.turnState.phase = 'auction'
  assert.throws(() => buyProperty(game, 'a'), /purchase|auction/i)
})

test('purchase requests are rejected from a non-active player even with stale roll data', () => {
  const game = createGame({ code: 'STALEBUY', players: [{ sessionHash: 'a', displayName: 'A', avatar: 'a' }, { sessionHash: 'b', displayName: 'B', avatar: 'b' }], settings: { startingCash: 1000000, auction: true } })
  game.status = 'playing'
  game.currentPlayerId = 'b'
  game.players[0].position = 1
  game.lastRoll = { playerId: 'a', tileId: 1 }
  game.dice = [1, 2]
  game.turnState.phase = 'purchase'
  assert.throws(() => buyProperty(game, 'a'), /active player/i)
})

test('bankruptcy to a creditor transfers the debtor remaining cash atomically', () => {
  const game = gameForAuction()
  game.players[0].balance = 10000
  game.players[1].balance = 500000
  game.cards.decks.chance.draw = [{ id: 'debt-card', type: 'pay-each-player', amount: 20000, text: 'Pay each player.' }]
  game.currentPlayerId = 'a'
  rollDice(game, 'a', [1, 1])
  assert.equal(game.players[0].bankrupt, true)
  assert.equal(game.players[0].balance, 0)
  assert.equal(game.players[1].balance, 510000)
})

test('buying a property emits an authoritative purchase event', () => {
  const game = gameForAuction()
  game.currentPlayerId = 'a'; game.players[0].position = 1; game.dice = [1, 1]; game.lastRoll = { playerId: 'a', tileId: 1 }; game.turnState.phase = 'purchase'
  buyProperty(game, 'a')
  assert.deepEqual(game.events.at(-1), { id: 1, type: 'purchase', playerId: 'a', propertyId: 1 })
})

test('highest bidder cannot withdraw a bid by passing', () => {
  const game = gameForAuction()
  startAuction(game, 'a', 1)
  auctionBid(game, 'a', 10000)
  assert.throws(() => auctionPass(game, 'a'), /cannot pass/i)
  assert.equal(game.auction.highestBidderId, 'a')
})
