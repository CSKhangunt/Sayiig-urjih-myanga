import crypto from 'node:crypto'
import { createCardState, drawCard, returnJailCard } from './cards.js'
import { DEFAULT_RULES, PHASES, buildingSaleValue, calculateRentForTile, calculateTax, canBuildEvenly, canSellEvenly, createBankInventory, createTurnState, mortgageRepayment, mortgageValue, movePosition, resolveDice, resolveJailAttempt, resolveTurnAfterLanding, settleBankruptcy, validateBoardConfiguration, validatePropertyRentTables } from './monopolyRules.js'

const salary = 100000

export const board = [
  { id: 0, type: 'start', name: 'Эхлэл', description: `Энд өнгөрөх бүрд +${salary.toLocaleString('mn-MN')} ₮` },
  { id: 1, type: 'property', name: 'GS25', price: 180000, rent: 22000, buildCost: 90000, group: 'улаан', color: '#4caf50' },
  { id: 2, type: 'chance', name: 'Хонжвор', description: 'Санамсаргүй карт авна' },
  { id: 3, type: 'property', name: 'CU', price: 220000, rent: 28000, buildCost: 90000, group: 'улаан', color: '#4caf50' },
  { id: 4, type: 'tax', name: 'Орлогын татвар', amount: 50000 },
  { id: 5, type: 'transport', name: 'Пирошки', price: 420000, rent: 50000, color: '#3f637a' },
  { id: 6, type: 'property', name: 'Миний дэлгүүр', price: 260000, rent: 32000, buildCost: 110000, group: 'ногоон', color: '#4b8d8c' },
  { id: 7, type: 'property', name: 'Woo Pizza & Burger', price: 300000, rent: 36000, buildCost: 110000, group: 'ногоон', color: '#4b8d8c' },
  { id: 8, type: 'chance', deck: 'chest', name: 'Гэнэтийн бэлэг', description: 'Сюрприз карт авна' },
  { id: 9, type: 'property', name: 'My dent', price: 390000, rent: 46000, buildCost: 130000, group: 'шар', color: '#c08a45' },
  { id: 10, type: 'jail', name: 'Шорон', description: 'Хорихын бүс' },
  { id: 11, type: 'property', name: '21-ийн талбай', price: 200000, rent: 26000, buildCost: 100000, group: 'цэнхэр', color: '#3f637a' },
  { id: 12, type: 'utility', name: 'Эфэс', price: 150000, rent: 20000, color: '#d7aa35' },
  { id: 13, type: 'property', name: 'Цэцэрлэгт хүрээлэн', price: 240000, rent: 30000, buildCost: 100000, group: 'ногоон', color: '#62a86a' },
  { id: 14, type: 'property', name: 'Шинэ Зайсан', price: 280000, rent: 34000, buildCost: 110000, group: 'ногоон', color: '#62a86a' },
  { id: 15, type: 'transport', name: 'KFC', price: 360000, rent: 43000, color: '#3f637a' },
  { id: 16, type: 'property', name: "Ивэлт's лагар", price: 390000, rent: 46000, buildCost: 130000, group: 'шар', color: '#c08a45' },
  { id: 17, type: 'property', name: "Гүнээ's home", price: 420000, rent: 50000, buildCost: 140000, group: 'шар', color: '#c08a45' },
  { id: 18, type: 'property', name: "Тамира's home", price: 450000, rent: 56000, buildCost: 150000, group: 'нил ягаан', color: '#6c5c88' },
  { id: 19, type: 'chance', name: 'Эрдэнэсийн авдар', description: 'Санамсаргүй карт авна' },
  { id: 20, type: 'jail', name: 'Шоронд очих', description: 'Нэг ээлж өнжинө' },
  { id: 21, type: 'property', name: "Tugu's home", price: 280000, rent: 34000, buildCost: 110000, group: 'цэнхэр', color: '#3f637a' },
  { id: 22, type: 'property', name: 'Olymp', price: 270000, rent: 33000, buildCost: 110000, group: 'цэнхэр', color: '#3f637a' },
  { id: 23, type: 'utility', name: 'Жүр Үр', price: 150000, rent: 20000, color: '#37a6c8' },
  { id: 24, type: 'property', name: "Төвшү's home", price: 260000, rent: 32000, buildCost: 100000, group: 'цэнхэр', color: '#3f637a' },
  { id: 25, type: 'transport', name: 'Халиартай хуушуур', price: 360000, rent: 43000, color: '#3f637a' },
  { id: 26, type: 'property', name: "Kat's home", price: 240000, rent: 30000, buildCost: 100000, group: 'улаан', color: '#b84d62' },
  { id: 27, type: 'property', name: "Иверлт's home", price: 220000, rent: 28000, buildCost: 90000, group: 'улаан', color: '#b84d62' },
  { id: 28, type: 'chance', deck: 'chest', name: 'Гэнэтийн бэлэг', description: 'Сюрприз карт авна' },
  { id: 29, type: 'property', name: "Aza's home", price: 210000, rent: 26000, buildCost: 90000, group: 'улаан', color: '#b84d62' },
  { id: 30, type: 'vacation', name: 'Амралт', description: 'Тайвшрах мөч' },
  { id: 31, type: 'property', name: 'Toyota Aqua', price: 290000, rent: 35000, buildCost: 110000, group: 'ногоон', color: '#4b8d8c' },
  { id: 32, type: 'property', name: 'Prius20', price: 300000, rent: 36000, buildCost: 110000, group: 'ногоон', color: '#4b8d8c' },
  { id: 33, type: 'chance', name: 'Эрдэнэсийн авдар', description: 'Санамсаргүй карт авна' },
  { id: 34, type: 'property', name: 'Prius30', price: 320000, rent: 39000, buildCost: 120000, group: 'ногоон', color: '#4b8d8c' },
  { id: 35, type: 'transport', name: 'Ким Баб Чонгүг', price: 360000, rent: 43000, color: '#3f637a' },
  { id: 36, type: 'chance', deck: 'chest', name: 'Гэнэтийн бэлэг', description: 'Сюрприз карт авна' },
  { id: 37, type: 'property', name: 'P-Gaming', price: 360000, rent: 44000, buildCost: 130000, group: 'нил ягаан', color: '#6c5c88' },
  { id: 38, type: 'tax', name: 'Дээд зэрэглэлийн татвар', amount: 75000 },
  { id: 39, type: 'property', name: 'Meta-Gaming', price: 400000, rent: 50000, buildCost: 140000, group: 'нил ягаан', color: '#6c5c88' },
]

const publicPlayer = (player) => ({ id: player.publicId, name: player.name, avatar: player.avatar, activeSkin: player.activeSkin || 'steppe-free', balance: player.balance, position: player.position, connected: player.connected, bankrupt: player.bankrupt, jail: player.jail || null, cards: player.cards || [] })

export const createGame = (room) => ({
  roomCode: room.code,
  status: 'lobby',
  currentPlayerId: null,
  turn: 0,
  dice: null,
  lastRoll: null,
  players: room.players.map((player) => ({ id: player.sessionHash, publicId: crypto.randomUUID(), name: player.displayName, avatar: player.avatar, balance: room.settings.startingCash, position: 0, connected: true, bankrupt: false, cards: [], jail: null })),
  properties: {},
  trades: [],
  auction: null,
  houses: {},
  mortgaged: {},
  mortgageInterestDue: {},
  turnStartedAt: null,
  turnDurationMs: 90000,
  winnerId: null,
  logs: ['Өрөө үүслээ. Тоглогчид нэгдэхийг хүлээж байна.'],
  settings: room.settings,
  rules: { ...DEFAULT_RULES, ...(room.settings.rules || {}) },
  turnState: createTurnState(room.settings.rules),
  bank: createBankInventory({ ...DEFAULT_RULES, ...(room.settings.rules || {}) }),
  cards: createCardState(),
  pendingBankAuctions: [],
  events: [],
})

export const sanitizeGame = (game) => ({
  ...game,
  currentPlayerName: game.players.find((player) => player.id === game.currentPlayerId)?.name || null,
  winnerName: game.players.find((player) => player.id === game.winnerId)?.name || null,
  turnEndsAt: game.turnStartedAt ? game.turnStartedAt + game.turnDurationMs : null,
  lastRoll: game.lastRoll ? { ...game.lastRoll, playerName: game.players.find((player) => player.id === game.lastRoll.playerId)?.name || null } : null,
  properties: Object.fromEntries(Object.entries(game.properties).map(([tileId, ownerId]) => [tileId, game.players.find((player) => player.id === ownerId)?.name || null])),
  trades: game.trades.map((trade) => ({ ...trade, id: trade.id, fromId: game.players.find((player) => player.id === trade.fromId)?.publicId || null, toId: game.players.find((player) => player.id === trade.toId)?.publicId || null, fromName: game.players.find((player) => player.id === trade.fromId)?.name || null, toName: game.players.find((player) => player.id === trade.toId)?.name || null })),
  houses: game.houses,
  mortgaged: game.mortgaged,
  mortgageInterestDue: game.mortgageInterestDue,
  auction: game.auction ? { ...game.auction, eligibleIds: game.auction.eligibleIds.map((id) => game.players.find((player) => player.id === id)?.publicId || id), passedIds: game.auction.passedIds.map((id) => game.players.find((player) => player.id === id)?.publicId || id), highestBidderId: game.players.find((player) => player.id === game.auction.highestBidderId)?.publicId || null } : null,
  phase: game.turnState?.phase || null,
  events: game.events || [],
  players: game.players.map(publicPlayer),
})

const addLog = (game, text) => {
  game.logs = [`${new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })} · ${text}`, ...game.logs].slice(0, 40)
}

const recordEvent = (game, type, payload = {}) => {
  game.eventSequence = (game.eventSequence || 0) + 1
  game.events = [...(game.events || []), { id: game.eventSequence, type, ...payload }].slice(-30)
}

const resolveCard = (game, player, deckName) => {
  const card = drawCard(game.cards, deckName)
  recordEvent(game, 'card', { playerId: player.id, cardId: card.id, deck: deckName, card: { ...card } })
  player.lastCard = card.id
  if (card.type === 'advance') { const from = player.position; const steps = (card.target - from + board.length) % board.length; const movement = movePosition(from, steps, board.length); if (movement.passedGo) { player.balance += game.rules.goSalary; recordEvent(game, 'go', { playerId: player.id, amount: game.rules.goSalary, source: 'card' }) } player.position = card.target; recordEvent(game, 'movement', { playerId: player.id, from, to: player.position, steps, path: Array.from({ length: steps }, (_, index) => (from + index + 1) % board.length), passedGo: movement.passedGo, source: 'card' }) }
  else if (card.type === 'back') { const from = player.position; player.position = (player.position - card.spaces + board.length) % board.length; recordEvent(game, 'movement', { playerId: player.id, from, to: player.position, steps: card.spaces, path: Array.from({ length: card.spaces }, (_, index) => (from - index - 1 + board.length * 2) % board.length), passedGo: false, source: 'card-backward' }) }
  else if (card.type === 'jail') { player.position = 10; player.jail = { turns: 0 } }
  else if (card.type === 'get-out-of-jail') player.cards = [...(player.cards || []), card.id]
  else if (card.type === 'collect') player.balance += card.amount
  else if (card.type === 'pay') {
    const due = Number(card.amount || 0)
    if (player.balance < due) bankrupt(game, player.id)
    else player.balance -= due
  }
  else if (card.type === 'collect-from-players') game.players.filter((item) => item.id !== player.id && !item.bankrupt).forEach((item) => { if (item.balance < card.amount) bankrupt(game, item.id, player.id); else { item.balance -= card.amount; player.balance += card.amount } })
  else if (card.type === 'pay-each-player') game.players.filter((item) => item.id !== player.id && !item.bankrupt).forEach((item) => { if (player.bankrupt) return; if (player.balance < card.amount) bankrupt(game, player.id, item.id); else { player.balance -= card.amount; item.balance += card.amount } })
  else if (card.type === 'repairs') {
    const due = Object.entries(game.houses).filter(([tileId]) => game.properties[tileId] === player.id).reduce((sum, [, level]) => sum + (level === 5 ? card.hotel : card.house * level), 0)
    if (player.balance < due) bankrupt(game, player.id)
    else player.balance -= due
  }
  else if (card.type === 'nearest') { const candidates = board.filter((tile) => tile.type === card.targetType && tile.id > player.position); const target = candidates[0] || board.find((tile) => tile.type === card.targetType); if (target) { const from = player.position; const steps = (target.id - from + board.length) % board.length; const movement = movePosition(from, steps, board.length); if (movement.passedGo) { player.balance += game.rules.goSalary; recordEvent(game, 'go', { playerId: player.id, amount: game.rules.goSalary, source: 'card' }) } player.position = target.id; recordEvent(game, 'movement', { playerId: player.id, from, to: player.position, steps, path: Array.from({ length: steps }, (_, index) => (from + index + 1) % board.length), passedGo: movement.passedGo, source: 'card-nearest' }); if (card.rentMultiplier) game.pendingCardRent = { playerId: player.id, multiplier: card.rentMultiplier }; if (card.targetType === 'utility') game.pendingCardUtilityRent = player.id } }
  addLog(game, `${player.name} card: ${card.text}`)
  return card
}

const getPlayer = (game, playerId) => game.players.find((player) => player.id === playerId)

const nextActivePlayer = (game, currentIndex) => {
  for (let offset = 1; offset <= game.players.length; offset += 1) {
    const index = (currentIndex + offset) % game.players.length
    if (!game.players[index].bankrupt) return game.players[index]
  }
  return null
}

export const startGame = (game, actorId) => {
  const boardValidation = validateBoardConfiguration(board)
  if (!boardValidation.ok) throw new Error(`Invalid board configuration: ${boardValidation.reason}`)
  if (game.settings?.map && game.settings.map !== 'Сонгодог') throw new Error('Unsupported board map.')
  if (!validatePropertyRentTables(game.rules?.propertyRentTables || {}, board)) throw new Error('Invalid property rent table configuration.')
  if (game.status !== 'lobby') throw new Error('Тоглоом аль хэдийн эхэлсэн байна.')
  if (game.players.length < 2) throw new Error('At least two players are required to start a Classic game.')
  if (game.players[0].id !== actorId) throw new Error('Зөвхөн өрөө үүсгэгч тоглоом эхлүүлнэ.')
  game.status = 'playing'
  game.currentPlayerId = game.settings.randomOrder ? game.players[crypto.randomInt(game.players.length)].id : game.players[0].id
  game.turnStartedAt = Date.now()
  addLog(game, 'Тоглоом эхэллээ. Эхний ээлжийг сервер санамсаргүй сонголоо.')
}

export const rollDice = (game, actorId, forcedDice = null) => {
  if (game.status !== 'playing') throw new Error('Тоглоом хараахан эхлээгүй байна.')
  if (game.currentPlayerId !== actorId) throw new Error('Одоо таны ээлж биш байна.')
  if (![PHASES.ROLL, PHASES.JAIL].includes(game.turnState?.phase)) throw new Error('The turn is not ready for a dice roll.')
  if (game.dice) throw new Error('Энэ ээлжийн шоо аль хэдийн хаягдсан байна.')
  const player = getPlayer(game, actorId)
  const dice = forcedDice || [crypto.randomInt(1, 7), crypto.randomInt(1, 7)]
  if (player.jail) {
    const jailResult = resolveJailAttempt({ dice, jailTurns: player.jail.turns, rules: game.rules })
    game.dice = dice
    if (jailResult.released) {
      if (jailResult.bailDue) { if (player.balance < jailResult.bailDue) throw new Error('Bail money is insufficient.'); player.balance -= jailResult.bailDue }
      player.jail = null
      if (game.turnState) game.turnState = { ...game.turnState, phase: PHASES.RESOLVE, extraTurn: dice[0] === dice[1] }
      const movement = movePosition(player.position, jailResult.move, board.length)
      const movementStart = player.position
      player.position = movement.position
      if (jailResult.move > 0) recordEvent(game, 'movement', { playerId: actorId, from: movementStart, to: movement.position, steps: jailResult.move, path: Array.from({ length: jailResult.move }, (_, index) => (movementStart + index + 1) % board.length), passedGo: movement.passedGo, source: 'jail-release' })
      game.lastRoll = { playerId: actorId, total: jailResult.move, tileId: player.position, jailReleased: true }
      const landedTile = board[player.position]
      if (landedTile.type === 'tax') {
        const tax = calculateTax(landedTile, player.balance, game.rules)
        if (player.balance < tax) bankrupt(game, player.id)
        else { player.balance -= tax; recordEvent(game, 'payment', { playerId: player.id, amount: tax, kind: 'tax' }) }
      } else if (['property', 'transport', 'utility'].includes(landedTile.type)) {
        const ownerId = game.properties[landedTile.id]
        const owner = ownerId ? getPlayer(game, ownerId) : null
        if (ownerId && ownerId !== player.id && !game.mortgaged[landedTile.id] && !(game.settings.noRentInPrison && owner?.jail)) {
          const baseRent = game.pendingCardUtilityRent === player.id ? jailResult.move * 10 : calculateRentForTile({ tile: landedTile, game, board, ownerId, diceTotal: jailResult.move, monopoly: game.settings.doubledSetRent && ownsCompleteSet(game, ownerId, landedTile.group) })
          const rent = baseRent * (game.pendingCardRent?.playerId === player.id ? game.pendingCardRent.multiplier : 1)
          if (player.balance < rent) bankrupt(game, player.id, ownerId)
          else { player.balance -= rent; owner.balance += rent; recordEvent(game, 'payment', { playerId: player.id, ownerId, amount: rent, kind: 'rent' }) }
        }
      }
      if (game.turnState) game.turnState = resolveTurnAfterLanding(game.turnState)
    } else {
      player.jail = { turns: jailResult.jailTurns }
      game.lastRoll = { playerId: actorId, total: 0, tileId: player.position, jailTurn: jailResult.jailTurns }
      if (game.turnState) game.turnState = resolveTurnAfterLanding(game.turnState)
    }
    return
  }
  const first = dice[0]
  const second = dice[1]
  const turnResult = resolveDice(dice, { ...(game.turnState || createTurnState(game.rules)), rules: game.rules || DEFAULT_RULES })
  game.turnState = turnResult
  if (turnResult.sendToJail) {
    player.position = 10
    player.jail = { turns: 0 }
    game.dice = dice
    game.lastRoll = { playerId: actorId, total: 0, tileId: 10, sentToJail: true }
    recordEvent(game, 'jail', { playerId: actorId })
    return
  }
  const total = first + second
  const oldPosition = player.position
  const movement = movePosition(oldPosition, total, board.length)
  const newPosition = movement.position
  if (movement.passedGo) {
    player.balance += game.rules?.goSalary ?? salary
    recordEvent(game, 'go', { playerId: actorId, amount: game.rules?.goSalary ?? salary })
    addLog(game, `${player.name} эхлэлийг давж ${salary.toLocaleString('mn-MN')} ₮ авлаа.`)
  }
  player.position = newPosition
  recordEvent(game, 'movement', { playerId: actorId, from: oldPosition, to: newPosition, steps: total, path: Array.from({ length: total }, (_, index) => (oldPosition + index + 1) % board.length), passedGo: movement.passedGo, source: 'dice' })
  game.dice = [first, second]
  game.lastRoll = { playerId: actorId, total, tileId: newPosition }
  let tile = board[newPosition]
  let cardDepth = 0
  while (cardDepth < 4 && !player.jail && (tile.type === 'chance' || tile.type === 'chest')) {
    const cardPosition = player.position
    resolveCard(game, player, tile.deck || tile.type)
    tile = board[player.position]
    cardDepth += 1
    if (player.position === cardPosition) break
  }
  if (player.jail && tile.id === 10) {
    game.lastRoll = { playerId: actorId, total, tileId: 10, sentToJail: true, viaCard: true }
    recordEvent(game, 'jail', { playerId: actorId, reason: 'card' })
    if (game.turnState) game.turnState = resolveTurnAfterLanding(game.turnState, { sentToJail: true })
    return
  }
  if (tile.id === 20) {
    player.position = 10
    player.jail = { turns: 0 }
    game.lastRoll = { playerId: actorId, total, tileId: 10, sentToJail: true }
    recordEvent(game, 'jail', { playerId: actorId, reason: 'go-to-jail' })
    if (game.turnState) game.turnState = resolveTurnAfterLanding(game.turnState, { sentToJail: true })
    addLog(game, `${player.name} was sent to jail.`)
    return
  }
  const isPurchasable = ['property', 'transport', 'utility'].includes(tile.type)
  const unowned = isPurchasable && !game.properties[tile.id]
  const requiresPurchase = unowned && player.balance >= tile.price
  const requiresAuction = game.settings.auction && unowned && player.balance < tile.price
  if (requiresAuction) startAuction(game, actorId, tile.id)
  if (tile.type === 'tax') {
    const tax = calculateTax(tile, player.balance, game.rules)
    if (player.balance < tax) bankrupt(game, player.id)
    else { player.balance -= tax; recordEvent(game, 'payment', { playerId: player.id, amount: tax, kind: 'tax' }) }
    addLog(game, `${player.name} ${tile.name}-д ${tax.toLocaleString('mn-MN')} ₮ төллөө.`)
  } else if (['property', 'transport', 'utility'].includes(tile.type)) {
    const ownerId = game.properties[tile.id]
    if (ownerId && ownerId !== actorId) {
      const owner = getPlayer(game, ownerId)
      const rentBlocked = Boolean(game.mortgaged[tile.id] || (game.settings.noRentInPrison && owner?.jail))
      const baseRent = game.pendingCardUtilityRent === player.id ? total * 10 : calculateRentForTile({ tile, game, board, ownerId, diceTotal: total, monopoly: game.settings.doubledSetRent && ownsCompleteSet(game, ownerId, tile.group) })
      const rent = rentBlocked ? 0 : baseRent * (game.pendingCardRent?.playerId === player.id ? game.pendingCardRent.multiplier : 1)
      const paid = Math.min(player.balance, rent)
      player.balance -= paid
      if (owner) owner.balance += paid
      if (paid > 0) recordEvent(game, 'payment', { playerId: actorId, ownerId, amount: paid, kind: 'rent' })
      if (player.balance === 0 && paid < rent) bankrupt(game, player.id, owner?.id)
      addLog(game, `${player.name} ${tile.name}-д ${paid.toLocaleString('mn-MN')} ₮ түрээс төллөө.`)
    }
  }
  if (tile.type === 'vacation' && game.settings.vacationCash) { player.balance += game.rules?.goSalary ?? salary; recordEvent(game, 'vacation', { playerId: actorId, amount: game.rules?.goSalary ?? salary }) }
  if (game.pendingCardRent?.playerId === player.id) delete game.pendingCardRent
  if (game.pendingCardUtilityRent === player.id) delete game.pendingCardUtilityRent
  if (game.turnState && !game.auction) game.turnState = resolveTurnAfterLanding(game.turnState, { requiresPurchase, requiresAuction })
  addLog(game, `${player.name} ${first} + ${second} шоо хаяж ${tile.name}-д буулаа.`)
}

export const startAuction = (game, actorId, propertyId) => {
  const tile = board.find((item) => item.id === Number(propertyId))
  if (!tile || !['property', 'transport', 'utility'].includes(tile.type) || game.properties[tile.id]) throw new Error('Энэ хөрөнгө дуудлага худалдаанд орох боломжгүй.')
  if (game.auction) throw new Error('Дуудлага худалдаа аль хэдийн үргэлжилж байна.')
  const eligibleIds = game.players.filter((player) => !player.bankrupt && player.connected).map((player) => player.id)
  game.auction = { propertyId: tile.id, price: tile.price, highestBid: 0, highestBidderId: null, eligibleIds, passedIds: [], bids: [], closed: false, startedAt: Date.now(), durationMs: 60000 }
  if (game.turnState) game.turnState = { ...game.turnState, phase: PHASES.AUCTION, extraTurn: false }
  addLog(game, `${tile.name}-ийн дуудлага худалдаа эхэллээ.`)
}

export const declinePurchase = (game, actorId) => {
  if (game.settings.auction === false) throw new Error('Auctions are disabled for this room.')
  const player = getPlayer(game, actorId)
  if (!player || game.currentPlayerId !== actorId || game.lastRoll?.playerId !== actorId) throw new Error('Only the active player can decline the landed property.')
  const tile = board[player.position]
  if (!tile || !['property', 'transport', 'utility'].includes(tile.type) || game.properties[tile.id]) throw new Error('No unowned property is available to auction.')
  startAuction(game, actorId, tile.id)
}

export const auctionBid = (game, actorId, amount) => {
  const auction = game.auction
  const player = getPlayer(game, actorId)
  const bid = Math.floor(Number(amount) || 0)
  if (!auction || auction.closed || !player || !auction.eligibleIds.includes(actorId) || auction.passedIds.includes(actorId)) throw new Error('Та энэ дуудлага худалдаанд оролцох боломжгүй.')
  const minimumIncrement = game.rules?.auctionMinimumIncrement ?? DEFAULT_RULES.auctionMinimumIncrement
  if (bid < auction.highestBid + (auction.highestBid ? minimumIncrement : 1) || bid > player.balance) throw new Error('Bid must exceed the current bid by the minimum increment and remain affordable.')
  auction.bids.push({ bidderId: actorId, amount: bid })
  auction.highestBid = bid; auction.highestBidderId = actorId
  recordEvent(game, 'auction-bid', { propertyId: auction.propertyId, playerId: actorId, amount: bid })
  if (auction.passedIds.length + 1 >= auction.eligibleIds.length) finishAuction(game)
}

export const auctionPass = (game, actorId) => {
  const auction = game.auction
  if (!auction || !auction.eligibleIds.includes(actorId) || auction.passedIds.includes(actorId)) throw new Error('Та энэ дуудлага худалдаанд оролцохгүй байна.')
  if (auction.highestBidderId === actorId) throw new Error('A bidder cannot pass after placing the current high bid.')
  auction.passedIds.push(actorId)
  if (auction.eligibleIds.filter((id) => !auction.passedIds.includes(id)).length <= 1) finishAuction(game)
}

export const removeAuctionBidder = (game, actorId) => {
  const auction = game.auction
  if (!auction) return
  auction.eligibleIds = auction.eligibleIds.filter((id) => id !== actorId)
  auction.passedIds = auction.passedIds.filter((id) => id !== actorId)
  auction.bids = (auction.bids || []).filter((bid) => bid.bidderId !== actorId)
  if (auction.highestBidderId === actorId) {
    const replacement = auction.bids.filter((bid) => auction.eligibleIds.includes(bid.bidderId) && !auction.passedIds.includes(bid.bidderId)).sort((a, b) => b.amount - a.amount)[0]
    auction.highestBid = replacement?.amount || 0
    auction.highestBidderId = replacement?.bidderId || null
  }
  if (auction.eligibleIds.filter((id) => !auction.passedIds.includes(id)).length <= 1) finishAuction(game)
}

export const removeDisconnectedTransactions = (game, actorId) => {
  const before = game.trades.length
  game.trades = game.trades.filter((trade) => trade.fromId !== actorId && trade.toId !== actorId)
  return before - game.trades.length
}

const finishAuction = (game) => {
  const auction = game.auction
  if (!auction || auction.closed) return
  auction.closed = true
  if (auction.highestBidderId && auction.highestBid > 0) {
    const winner = getPlayer(game, auction.highestBidderId)
    if (winner && winner.balance >= auction.highestBid && !game.properties[auction.propertyId]) { winner.balance -= auction.highestBid; game.properties[auction.propertyId] = winner.id; recordEvent(game, 'auction-win', { playerId: winner.id, propertyId: auction.propertyId, amount: auction.highestBid }); addLog(game, `${winner.name} дуудлага худалдаагаар ${board[auction.propertyId].name}-ийг авлаа.`) }
  }
  recordEvent(game, 'auction-close', { propertyId: auction.propertyId, winnerId: auction.highestBidderId, amount: auction.highestBid || 0, sold: Boolean(auction.highestBidderId && auction.highestBid > 0) })
  game.auction = null
  if (game.turnState) game.turnState = { ...game.turnState, phase: PHASES.MANAGE }
  if (game.pendingBankAuctions?.length) {
    const nextProperty = game.pendingBankAuctions.shift()
    const auctionStarter = game.currentPlayerId || game.players.find((player) => !player.bankrupt)?.id
    if (auctionStarter) startAuction(game, auctionStarter, nextProperty)
  }
}

export const buyProperty = (game, actorId) => {
  if (game.currentPlayerId !== actorId) throw new Error('Only the active player can purchase the landed property.')
  if (!game.dice || game.lastRoll?.playerId !== actorId) throw new Error('Эхлээд шоо хаяна уу.')
  if (game.auction) throw new Error('Finish the active auction before purchasing.')
  if (game.turnState?.phase && game.turnState.phase !== PHASES.PURCHASE) throw new Error('This turn is not awaiting a property purchase.')
  const player = getPlayer(game, actorId)
  const tile = board[player.position]
  if (!['property', 'transport', 'utility'].includes(tile.type)) throw new Error('Энэ талбар хөрөнгө биш байна.')
  if (game.properties[tile.id]) throw new Error('Энэ хөрөнгө аль хэдийн эзэмшилтэй байна.')
  if (player.balance < tile.price) throw new Error('Хөрөнгө худалдаж авах мөнгө хүрэлцэхгүй байна.')
  player.balance -= tile.price
  game.properties[tile.id] = actorId
  recordEvent(game, 'purchase', { playerId: actorId, propertyId: tile.id })
  if (game.turnState) game.turnState = { ...game.turnState, phase: PHASES.MANAGE }
  addLog(game, `${player.name} ${tile.name}-ийг ${tile.price.toLocaleString('mn-MN')} ₮-өөр худалдан авлаа.`)
}

export const payBail = (game, actorId) => {
  const player = getPlayer(game, actorId)
  if (game.currentPlayerId && game.currentPlayerId !== actorId) throw new Error('Bail can only be paid during your turn.')
  if (!player?.jail) throw new Error('Player is not in jail.')
  const bail = game.rules?.jailBail ?? DEFAULT_RULES.jailBail
  if (player.balance < bail) throw new Error('Bail money is insufficient.')
  player.balance -= bail
  player.jail = null
}

export const useJailCard = (game, actorId, cardId) => {
  const player = getPlayer(game, actorId)
  if (game.currentPlayerId && game.currentPlayerId !== actorId) throw new Error('A Jail Free card can only be used during your turn.')
  if (!player?.jail) throw new Error('Player is not in jail.')
  const index = (player.cards || []).findIndex((card) => card === cardId || card === 'chance-jail-free' || card === 'chest-jail-free')
  if (index < 0) throw new Error('Get Out of Jail Free card not found.')
  player.cards.splice(index, 1)
  player.jail = null
  const deckName = String(cardId || '').startsWith('chest') ? 'chest' : 'chance'
  game.cards.decks[deckName].discard.push({ id: cardId, type: 'get-out-of-jail' })
}

const ownsCompleteSet = (game, ownerId, group) => group && board.filter((tile) => tile.group === group).every((tile) => game.properties[tile.id] === ownerId)

const bankrupt = (game, playerId, creditorId = null) => {
  const player = getPlayer(game, playerId)
  if (!player || player.bankrupt) return
  game.trades = game.trades.filter((trade) => trade.fromId !== playerId && trade.toId !== playerId)
  const creditor = creditorId ? getPlayer(game, creditorId) : null
  if (creditor) creditor.cards = [...(creditor.cards || []), ...(player.cards || [])]
  if (creditor) {
    creditor.balance += Math.max(0, Number(player.balance) || 0)
    player.balance = 0
  }
  else (player.cards || []).forEach((cardId) => returnJailCard(game.cards, String(cardId).startsWith('chest') ? 'chest' : 'chance', cardId))
  player.cards = []
  const bankAuctions = creditorId ? [] : Object.entries(game.properties).filter(([, ownerId]) => ownerId === playerId).map(([tileId]) => Number(tileId))
  settleBankruptcy({ playerId, creditorId, players: game.players, properties: game.properties, houses: game.houses, mortgaged: game.mortgaged, mortgageInterestDue: game.mortgageInterestDue, bank: game.bank, board, rules: game.rules })
  if (bankAuctions.length) game.pendingBankAuctions.push(...bankAuctions)
  player.bankrupt = true
  recordEvent(game, 'bankruptcy', { playerId })
  Object.keys(game.properties).forEach((tileId) => {
    if (game.properties[tileId] === playerId) {
      if (creditorId) game.properties[tileId] = creditorId
      else delete game.properties[tileId]
      delete game.houses[tileId]
      delete game.mortgaged[tileId]
    }
  })
  addLog(game, `${player.name} дампуурлаа.`)
  const survivors = game.players.filter((item) => !item.bankrupt)
  if (survivors.length === 1) {
    game.status = 'finished'
    game.winnerId = survivors[0].id
    game.currentPlayerId = null
    game.turnStartedAt = null
    recordEvent(game, 'victory', { playerId: survivors[0].id })
    addLog(game, `${survivors[0].name} тоглоомын ялагч боллоо.`)
  } else if (game.currentPlayerId === playerId) {
    const currentIndex = game.players.findIndex((item) => item.id === playerId)
    const nextPlayer = nextActivePlayer(game, currentIndex)
    game.dice = null
    game.lastRoll = null
    game.currentPlayerId = nextPlayer?.id || null
    game.turn += 1
    game.turnStartedAt = game.currentPlayerId ? Date.now() : null
    if (game.turnState) game.turnState = { ...game.turnState, phase: PHASES.ROLL, extraTurn: false, doubles: 0 }
  }
}

export const buildProperty = (game, actorId, propertyId) => {
  const player = getPlayer(game, actorId)
  const tile = board.find((item) => item.id === Number(propertyId))
  if (game.status !== 'playing' || game.currentPlayerId !== actorId) throw new Error('Зөвхөн өөрийн ээлжид барилга барина.')
  if (!player || !tile?.group || game.properties[tile.id] !== actorId) throw new Error('Та энэ хөрөнгийг эзэмшдэггүй байна.')
  const developedRents = game.rules?.propertyRentTables?.[tile.id] || tile.rentLevels
  if (tile.type === 'property' && (!Array.isArray(developedRents) || developedRents.length < 5)) throw new Error('A five-level developed rent table is required before building.')
  if (player.jail) throw new Error('Players in jail cannot build.')
  if (board.some((item) => item.group === tile.group && game.mortgaged[item.id])) throw new Error('Cannot build on a mortgaged color group.')
  if (!ownsCompleteSet(game, actorId, tile.group)) throw new Error('Бүтэн багц эзэмшсэний дараа барилга барина.')
  const buildCheck = game.settings.evenBuild ? canBuildEvenly({ board, properties: game.properties, houses: game.houses, mortgaged: game.mortgaged, ownerId: actorId, group: tile.group, propertyId: tile.id, bankHouses: game.bank?.houses, bankHotels: game.bank?.hotels }) : { ok: true }
  if (!buildCheck.ok) throw new Error(`Cannot build: ${buildCheck.reason}`)
  const level = game.houses[tile.id] || 0
  if (level >= 5) throw new Error('Энэ хөрөнгө зочид буудлын дээд түвшинд хүрсэн байна.')
  if (level === 4 && game.bank && game.bank.hotels < 1) throw new Error('No hotels remain in the bank.')
  if (level < 4 && game.bank && game.bank.houses < 1) throw new Error('No houses remain in the bank.')
  if (player.balance < tile.buildCost) throw new Error('Барилга барих мөнгө хүрэлцэхгүй байна.')
  player.balance -= tile.buildCost
  game.houses[tile.id] = level + 1
  if (game.bank) {
    if (level === 4) { game.bank.hotels -= 1; game.bank.houses += 4 }
    else game.bank.houses -= 1
  }
  addLog(game, `${player.name} ${tile.name}-д ${level === 4 ? 'зочид буудал' : 'байшин'} барилаа.`)
}

export const mortgageProperty = (game, actorId, propertyId) => {
  if (game.status !== 'playing' || game.currentPlayerId !== actorId) throw new Error('Property management is only allowed during your turn.')
  if (game.settings.mortgage === false) throw new Error('Mortgage is disabled for this room.')
  const tile = board.find((item) => item.id === Number(propertyId))
  const player = getPlayer(game, actorId)
  if (!player || game.properties[tile?.id] !== actorId) throw new Error('Та энэ хөрөнгийг эзэмшдэггүй байна.')
  if (tile.group && board.some((item) => item.group === tile.group && game.properties[item.id] === actorId && game.houses[item.id] > 0)) throw new Error('Sell all buildings in the color group before mortgaging.')
  if (game.mortgaged[tile.id]) throw new Error('Энэ хөрөнгө аль хэдийн ипотектэй байна.')
  game.mortgaged[tile.id] = true
  player.balance += mortgageValue(tile.price)
  addLog(game, `${player.name} ${tile.name}-ийг ипотект тавьж ${mortgageValue(tile.price).toLocaleString('mn-MN')} ₮ авлаа.`)
}

export const sellBuilding = (game, actorId, propertyId) => {
  if (game.status !== 'playing' || game.currentPlayerId !== actorId) throw new Error('Property management is only allowed during your turn.')
  const tile = board.find((item) => item.id === Number(propertyId))
  const player = getPlayer(game, actorId)
  if (player?.jail) throw new Error('Players in jail cannot sell buildings.')
  const level = Number(game.houses[tile?.id] || 0)
  if (!player || !tile?.group || game.properties[tile.id] !== actorId || level <= 0) throw new Error('No sellable building exists on this property.')
  if (game.settings.evenBuild) {
    const check = canSellEvenly({ board, houses: game.houses, group: tile.group, propertyId: tile.id })
    if (!check.ok) throw new Error(`Cannot sell building: ${check.reason}`)
  }
  const refund = buildingSaleValue(tile.buildCost || 0, level, game.rules)
  player.balance += refund
  if (level === 5 && game.bank && game.bank.houses >= 4) {
    game.houses[tile.id] = 4
    game.bank.houses -= 4
    game.bank.hotels += 1
  } else if (level === 5) {
    throw new Error('Four houses are required in the bank to sell a hotel.')
  } else {
    game.houses[tile.id] = level - 1
  }
  if (game.bank) {
    if (level === 5 && game.houses[tile.id] !== 4) game.bank.hotels += 1
    else if (level !== 5) game.bank.houses += 1
  }
  if (game.houses[tile.id] === 0) delete game.houses[tile.id]
  addLog(game, `${player.name} ${tile.name}-ийн барилгыг зарж ${refund.toLocaleString('mn-MN')} ₮ авлаа.`)
}

export const repayMortgage = (game, actorId, propertyId) => {
  if (game.status !== 'playing' || game.currentPlayerId !== actorId) throw new Error('Property management is only allowed during your turn.')
  const tile = board.find((item) => item.id === Number(propertyId))
  const player = getPlayer(game, actorId)
  const storedInterest = Number(game.mortgageInterestDue?.[tile?.id] || 0)
  const repayment = storedInterest > 0 ? mortgageValue(tile.price) + storedInterest : mortgageRepayment(tile.price, game.rules)
  if (!player || game.properties[tile?.id] !== actorId) throw new Error('Та энэ хөрөнгийг эзэмшдэггүй байна.')
  if (!game.mortgaged[tile.id]) throw new Error('Энэ хөрөнгө ипотектэй биш байна.')
  if (player.balance < repayment) throw new Error('Ипотек төлөх мөнгө хүрэлцэхгүй байна.')
  player.balance -= repayment
  delete game.mortgaged[tile.id]
  delete game.mortgageInterestDue[tile.id]
  addLog(game, `${player.name} ${tile.name}-ийн ипотек төлөгдлөө.`)
}

const validateTradeAssets = (game, playerId, propertyIds = [], cash = 0, cards = []) => {
  const player = getPlayer(game, playerId)
  if (new Set(propertyIds.map(Number)).size !== propertyIds.length || new Set(cards).size !== cards.length) throw new Error('Trade assets cannot be offered more than once.')
  if (!player || player.bankrupt) throw new Error('Идэвхгүй тоглогч арилжаанд оролцож болохгүй.')
  if (cash < 0 || cash > player.balance) throw new Error('Мөнгө хүрэлцэхгүй байна.')
  if (propertyIds.some((id) => game.properties[Number(id)] !== playerId || (game.mortgaged[Number(id)] && game.rules?.allowMortgagedTrade === false) || game.houses[Number(id)] > 0)) throw new Error('Хөрөнгө trade хийх боломжгүй болсон байна.')
  if (cards.some((card) => !(player.cards || []).includes(card))) throw new Error('Карт эзэмшигчид байхгүй байна.')
}

const mortgageTransferFee = (game, propertyIds = []) => propertyIds.reduce((sum, id) => {
  const tile = board.find((item) => item.id === Number(id))
  return sum + (tile && game.mortgaged[tile.id] ? mortgageValue(tile.price) * (game.rules?.mortgageInterest ?? DEFAULT_RULES.mortgageInterest) : 0)
}, 0)

export const createTrade = (game, actorId, targetId, cashOffer, propertyId, payload = {}) => {
  if (game.status !== 'playing') throw new Error('Тоглоом эхлээгүй байна.')
  const from = getPlayer(game, actorId)
  const target = game.players.find((player) => player.publicId === targetId || player.id === targetId)
  const amount = Math.max(0, Math.floor(Number(cashOffer) || 0))
  if (!from || !target || from.id === target.id) throw new Error('Арилжааны тоглогч буруу байна.')
  if (amount > from.balance) throw new Error('Санал болгосон мөнгө таны балансаас их байна.')
  if (propertyId !== null && propertyId !== undefined) {
    if (game.properties[propertyId] !== actorId) throw new Error('Та энэ хөрөнгийг эзэмшдэггүй байна.')
  }
  const properties = payload.properties || (propertyId === null || propertyId === undefined ? [] : [propertyId])
  const requestedProperties = payload.requestedProperties || []
  const cards = payload.cards || []
  const requestedCards = payload.requestedCards || []
  const requestedCash = Math.max(0, Math.floor(Number(payload.requestedCash) || 0))
  validateTradeAssets(game, actorId, properties, amount, cards)
  validateTradeAssets(game, target.id, requestedProperties, requestedCash, requestedCards)
  if (amount + mortgageTransferFee(game, requestedProperties) > from.balance || requestedCash + mortgageTransferFee(game, properties) > target.balance) throw new Error('Mortgage transfer interest is unaffordable.')
  const createdAt = Date.now()
  const trade = { id: crypto.randomBytes(8).toString('hex'), fromId: actorId, toId: target.id, cashOffer: amount, propertyId: null, requestedCash, properties: properties.map(Number), requestedProperties: requestedProperties.map(Number), cards: [...cards], requestedCards: [...requestedCards], version: 1, createdAt, expiresAt: createdAt + 300000 }
  game.trades.push(trade)
  recordEvent(game, 'trade-offer', { tradeId: trade.id, fromId: actorId, toId: target.id, version: trade.version })
  addLog(game, `${from.name} ${target.name}-д арилжааны санал илгээлээ.`)
}

export const respondToTrade = (game, actorId, tradeId, accepted, expectedVersion = null) => {
  if (game.status !== 'playing') throw new Error('Trades are closed after the game ends.')
  const tradeIndex = game.trades.findIndex((trade) => trade.id === tradeId)
  if (tradeIndex < 0) throw new Error('Арилжааны санал олдсонгүй.')
  const trade = game.trades[tradeIndex]
  if (trade.toId !== actorId) throw new Error('Энэ арилжааг зөвхөн хүлээн авагч шийднэ.')
  if (expectedVersion !== null && Number(expectedVersion) !== Number(trade.version || 1)) throw new Error('This trade offer has changed. Review the latest version before responding.')
  const from = getPlayer(game, trade.fromId)
  const to = getPlayer(game, trade.toId)
  if (accepted) {
    validateTradeAssets(game, trade.fromId, trade.properties || [], trade.cashOffer, trade.cards || [])
    validateTradeAssets(game, trade.toId, trade.requestedProperties || [], trade.requestedCash || 0, trade.requestedCards || [])
    const fromMortgageFee = mortgageTransferFee(game, trade.requestedProperties || [])
    const toMortgageFee = mortgageTransferFee(game, trade.properties || [])
    if (from.balance < trade.cashOffer + fromMortgageFee || to.balance < (trade.requestedCash || 0) + toMortgageFee) throw new Error('Trade funds changed or mortgage transfer interest is unaffordable.')
    if (trade.propertyId !== null && game.properties[trade.propertyId] !== trade.fromId) throw new Error('Арилжаалах хөрөнгө аль хэдийн өөрчлөгдсөн байна.')
    from.balance -= trade.cashOffer
    to.balance += trade.cashOffer
    ;(trade.properties || (trade.propertyId === null ? [] : [trade.propertyId])).forEach((id) => { game.properties[id] = trade.toId })
    ;(trade.requestedProperties || []).forEach((id) => { game.properties[id] = trade.fromId })
    from.cards = (from.cards || []).filter((card) => !(trade.cards || []).includes(card)).concat(trade.requestedCards || [])
    to.cards = (to.cards || []).filter((card) => !(trade.requestedCards || []).includes(card)).concat(trade.cards || [])
    to.balance -= trade.requestedCash || 0
    from.balance += trade.requestedCash || 0
    from.balance -= fromMortgageFee
    to.balance -= toMortgageFee
    ;(trade.requestedProperties || []).filter((id) => game.mortgaged[id]).forEach((id) => { game.mortgageInterestDue[id] = mortgageValue(board[id].price) * (game.rules?.mortgageInterest ?? DEFAULT_RULES.mortgageInterest) })
    ;(trade.properties || []).filter((id) => game.mortgaged[id]).forEach((id) => { game.mortgageInterestDue[id] = mortgageValue(board[id].price) * (game.rules?.mortgageInterest ?? DEFAULT_RULES.mortgageInterest) })
    addLog(game, `${to.name} арилжааны саналыг зөвшөөрлөө.`)
  } else {
    recordEvent(game, 'trade-rejected', { tradeId: trade.id, fromId: trade.fromId, toId: trade.toId, version: trade.version })
    addLog(game, `${to.name} арилжааны саналыг татгалзлаа.`)
  }
  if (accepted) recordEvent(game, 'trade-complete', { fromId: trade.fromId, toId: trade.toId, tradeId: trade.id })
  game.trades.splice(tradeIndex, 1)
}

export const cancelTrade = (game, actorId, tradeId) => {
  if (game.status !== 'playing') throw new Error('Trades are closed after the game ends.')
  const index = game.trades.findIndex((trade) => trade.id === tradeId)
  if (index < 0) throw new Error('Trade not found.')
  const trade = game.trades[index]
  if (trade.fromId !== actorId && trade.toId !== actorId) throw new Error('Only trade participants can cancel.')
  recordEvent(game, 'trade-cancelled', { tradeId: trade.id, actorId })
  game.trades.splice(index, 1)
}

export const counterTrade = (game, actorId, tradeId, payload = {}) => {
  if (game.status !== 'playing') throw new Error('Trades are closed after the game ends.')
  const index = game.trades.findIndex((trade) => trade.id === tradeId)
  if (index < 0) throw new Error('Trade not found.')
  const trade = game.trades[index]
  if (trade.toId !== actorId) throw new Error('Only the recipient can counter this trade.')
  const result = createTrade(game, actorId, trade.fromId, payload.cashOffer || 0, null, {
    targetId: trade.fromId,
    properties: payload.properties || [],
    requestedProperties: payload.requestedProperties || trade.properties || [],
    cash: payload.cashOffer || 0,
    requestedCash: payload.requestedCash || 0,
    cards: payload.cards || [],
    requestedCards: payload.requestedCards || [],
  })
  game.trades.splice(index, 1)
  recordEvent(game, 'trade-counter', { tradeId: result?.id || null, replacesTradeId: trade.id, actorId })
  return result
}

export const endTurn = (game, actorId) => {
  if (game.currentPlayerId !== actorId) throw new Error('Одоо таны ээлж биш байна.')
  if (!game.dice) throw new Error('Ээлжээ дуусгахын өмнө шоо хаяна уу.')
  if (game.auction) throw new Error('Finish the active auction before ending the turn.')
  if (game.turnState?.phase === PHASES.PURCHASE) throw new Error('Choose whether to buy the landed property or start its auction before ending the turn.')
  if (game.turnState?.phase && game.turnState.phase !== PHASES.DEVELOPMENT) throw new Error('Resolve the current turn phase before ending the turn.')
  const currentIndex = game.players.findIndex((player) => player.id === actorId)
  const extraTurn = Boolean(game.turnState?.extraTurn && !game.players.find((player) => player.id === actorId)?.jail)
  const nextPlayer = extraTurn ? game.players[currentIndex] : nextActivePlayer(game, currentIndex)
  game.dice = null
  game.lastRoll = null
  if (!extraTurn) game.turn += 1
  game.currentPlayerId = nextPlayer?.id || null
  game.turnStartedAt = game.currentPlayerId ? Date.now() : null
  if (game.turnState) game.turnState = { ...game.turnState, phase: extraTurn ? PHASES.ROLL : PHASES.ROLL, extraTurn: false, doubles: extraTurn ? game.turnState.doubles : 0 }
}

export const skipExpiredTurn = (game) => {
  if (game.status !== 'playing') return false
  const now = Date.now()
  const activeTrades = game.trades.filter((trade) => !trade.expiresAt || trade.expiresAt > now)
  const expiredTrades = game.trades.length - activeTrades.length
  if (expiredTrades) {
    game.trades.filter((trade) => trade.expiresAt && trade.expiresAt <= now).forEach((trade) => recordEvent(game, 'trade-expired', { tradeId: trade.id, fromId: trade.fromId, toId: trade.toId }))
    game.trades = activeTrades
    addLog(game, `${expiredTrades} expired trade offer(s) were removed.`)
  }
  if (game.auction && Date.now() >= game.auction.startedAt + game.auction.durationMs) { finishAuction(game); return true }
  if (!game.currentPlayerId || !game.turnStartedAt || Date.now() < game.turnStartedAt + game.turnDurationMs) return Boolean(expiredTrades)
  const player = getPlayer(game, game.currentPlayerId)
  addLog(game, `${player.name} ээлжийн хугацаагаа дуусгалаа.`)
  game.dice = [1, 1]
  endTurn(game, game.currentPlayerId)
  return true
}

