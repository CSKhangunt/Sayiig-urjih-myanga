export const PHASES = Object.freeze({ LOBBY: 'lobby', ROLL: 'roll', RESOLVE: 'resolve', PURCHASE: 'purchase', AUCTION: 'auction', DEVELOPMENT: 'manage', TRADE: 'trade', END_TURN: 'end-turn', JAIL: 'jail', FINISHED: 'finished', MANAGE: 'manage' })

export const DEFAULT_RULES = Object.freeze({
  goSalary: 200000,
  taxMode: 'fixed',
  taxRate: 0.1,
  jailBail: 50000,
  maxJailTurns: 3,
  houses: 32,
  hotels: 12,
  mortgageInterest: 0.1,
  allowMortgagedTrade: true,
  buildingSaleRate: 0.5,
  auctionEnabled: true,
  auctionMinimumIncrement: 1,
  doublesForExtraTurn: true,
  doublesToJail: 3,
})

export const mergeRules = (overrides = {}) => ({ ...DEFAULT_RULES, ...overrides })

export const createTurnState = (rules = DEFAULT_RULES) => ({
  phase: PHASES.ROLL,
  doubles: 0,
  jailTurns: 0,
  rules: mergeRules(rules),
})

export const validateDice = (dice) => Array.isArray(dice) && dice.length === 2 && dice.every((value) => Number.isInteger(value) && value >= 1 && value <= 6)

export const validateBoardConfiguration = (board) => {
  if (!Array.isArray(board) || board.length !== 40) return { ok: false, reason: 'board-must-have-40-tiles' }
  const ids = board.map((tile) => tile.id)
  if (new Set(ids).size !== 40 || !ids.every((id) => Number.isInteger(id) && id >= 0 && id < 40)) return { ok: false, reason: 'board-ids-must-be-unique-perimeter-positions' }
  if (board[0]?.type !== 'start') return { ok: false, reason: 'board-must-start-at-position-zero' }
  if (board.some((tile) => ['property', 'transport', 'utility'].includes(tile.type) && (!Number.isFinite(tile.price) || tile.price < 0))) return { ok: false, reason: 'purchasable-tiles-require-valid-prices' }
  if (board.some((tile) => tile.type === 'property' && tile.rentLevels !== undefined && (!Array.isArray(tile.rentLevels) || tile.rentLevels.length < 5 || tile.rentLevels.slice(0, 5).some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)))) return { ok: false, reason: 'property-rent-levels-must-contain-five-non-negative-values' }
  return { ok: true }
}

export const resolveDice = (dice, turnState) => {
  if (!validateDice(dice)) throw new Error('Invalid dice.')
  const isDouble = dice[0] === dice[1]
  const doubles = isDouble ? turnState.doubles + 1 : 0
  if (doubles >= turnState.rules.doublesToJail) return { ...turnState, phase: PHASES.JAIL, doubles, sendToJail: true, extraTurn: false }
  return { ...turnState, phase: PHASES.RESOLVE, doubles, extraTurn: isDouble && turnState.rules.doublesForExtraTurn }
}

export const resolveTurnAfterLanding = (turnState, { requiresPurchase = false, requiresAuction = false, sentToJail = false } = {}) => {
  if (sentToJail) return { ...turnState, phase: PHASES.JAIL, extraTurn: false }
  if (requiresAuction) return { ...turnState, phase: PHASES.AUCTION, extraTurn: false }
  if (requiresPurchase) return { ...turnState, phase: PHASES.PURCHASE }
  return { ...turnState, phase: turnState.extraTurn ? PHASES.ROLL : PHASES.DEVELOPMENT }
}

export const resolveJailAttempt = ({ dice, jailTurns, rules = DEFAULT_RULES }) => {
  if (!validateDice(dice)) throw new Error('Invalid dice.')
  if (dice[0] === dice[1]) return { released: true, move: dice[0] + dice[1], jailTurns: 0, phase: PHASES.RESOLVE }
  const nextTurns = jailTurns + 1
  if (nextTurns >= rules.maxJailTurns) return { released: true, bailDue: rules.jailBail, move: dice[0] + dice[1], jailTurns: 0, phase: PHASES.RESOLVE }
  return { released: false, move: 0, jailTurns: nextTurns, phase: PHASES.DEVELOPMENT }
}

export const movePosition = (position, distance, boardSize = 40) => {
  const next = (position + distance) % boardSize
  return { position: next, passedGo: position + distance >= boardSize }
}

export const calculateRailroadRent = (baseRent, ownedCount) => baseRent * (2 ** Math.max(0, Math.min(3, ownedCount - 1)))
export const calculateUtilityRent = (diceTotal, ownedCount, multiplier = 10) => diceTotal * (ownedCount >= 2 ? multiplier * 10 : multiplier)
export const calculateTax = (tile, balance, rules = DEFAULT_RULES) => rules.taxMode === 'percentage' ? Math.max(0, Math.floor(Number(balance) * Number(tile.rate || rules.taxRate || 0))) : Math.max(0, Number(tile.amount || 0))

export const calculateRentForTile = ({ tile, game, board = [], ownerId, diceTotal = 0, monopoly = false }) => {
  if (game.mortgaged?.[tile.id]) return 0
  if (tile.type === 'transport') {
    const owned = Object.entries(game.properties).filter(([id, idOwner]) => idOwner === ownerId && board.find((item) => item.id === Number(id))?.type === 'transport').length
    return calculateRailroadRent(tile.rent || 25000, owned)
  }
  if (tile.type === 'utility') {
    const owned = Object.entries(game.properties).filter(([id, idOwner]) => idOwner === ownerId && board.find((item) => item.id === Number(id))?.type === 'utility').length
    return calculateUtilityRent(diceTotal, owned, tile.utilityMultiplier || 10)
  }
  const levels = game.rules?.propertyRentTables?.[tile.id] || tile.rentLevels || []
  if (Number(game.houses?.[tile.id] || 0) > 0 && levels.length < 5) throw new Error('A five-level developed rent table is required for improved property rent.')
  return calculatePropertyRent({ baseRent: tile.rent || 0, houseRents: levels.slice(0, 5), houses: game.houses?.[tile.id] || 0, monopoly })
}

export const validatePropertyRentTables = (tables = {}, board = null) => {
  const purchasableIds = board ? new Set(board.filter((tile) => tile && tile.type === 'property').map((tile) => tile.id)) : null
  return Object.entries(tables).every(([tileId, levels]) => Number.isInteger(Number(tileId)) && (!purchasableIds || purchasableIds.has(Number(tileId))) && Array.isArray(levels) && levels.length >= 5 && levels.slice(0, 5).every((value) => Number.isFinite(Number(value)) && Number(value) >= 0))
}

export const calculatePropertyRent = ({ baseRent, houseRents = [], houses = 0, monopoly = false }) => {
  if (houses > 0) return houseRents[Math.min(houses - 1, houseRents.length - 1)] ?? baseRent
  return baseRent * (monopoly ? 2 : 1)
}

export const countOwnedInGroup = (board, properties, ownerId, group) => board.filter((tile) => tile.group === group).every((tile) => properties[tile.id] === ownerId)

export const canBuildEvenly = ({ board, properties, houses, mortgaged = {}, ownerId, group, propertyId, bankHouses = 32, bankHotels = 12 }) => {
  const groupTiles = board.filter((tile) => tile.group === group)
  if (!groupTiles.length || !countOwnedInGroup(board, properties, ownerId, group)) return { ok: false, reason: 'monopoly-required' }
  if (groupTiles.some((tile) => properties[tile.id] !== ownerId || mortgaged[tile.id])) return { ok: false, reason: 'mortgaged-group' }
  const levels = groupTiles.map((tile) => Number(houses[tile.id] || 0))
  const current = Number(houses[propertyId] || 0)
  if (current >= 5) return { ok: false, reason: 'max-development' }
  if (current === 4 && bankHotels < 1) return { ok: false, reason: 'hotel-shortage' }
  if (current < 4 && bankHouses < 1) return { ok: false, reason: 'house-shortage' }
  if (current - Math.min(...levels) > 0) return { ok: false, reason: 'even-building-required' }
  return { ok: true, level: current + 1, consumes: current === 4 ? 'hotel' : 'house' }
}

export const canSellEvenly = ({ board, houses, group, propertyId }) => {
  const groupTiles = board.filter((tile) => tile.group === group)
  const current = Number(houses[propertyId] || 0)
  if (current <= 0) return { ok: false, reason: 'no-building' }
  const levels = groupTiles.map((tile) => Number(houses[tile.id] || 0))
  if (current - Math.max(...levels) < 0) return { ok: false, reason: 'even-selling-required' }
  return { ok: true, refund: current === 5 ? 0 : 1 }
}

export const createBankInventory = (rules = DEFAULT_RULES) => ({ houses: rules.houses, hotels: rules.hotels })
export const mortgageValue = (purchasePrice) => Math.floor(Number(purchasePrice) / 2)
export const mortgageRepayment = (purchasePrice, rules = DEFAULT_RULES) => Math.round(mortgageValue(purchasePrice) * (1 + rules.mortgageInterest))
export const buildingSaleValue = (buildCost, level, rules = DEFAULT_RULES) => Math.floor(Number(buildCost) * rules.buildingSaleRate * (level === 5 ? 1 : level))

export const settleBankruptcy = ({ playerId, creditorId = null, players, properties, houses, mortgaged, mortgageInterestDue = {}, bank = null, board, rules = DEFAULT_RULES }) => {
  const debtor = players.find((player) => player.id === playerId)
  const creditor = creditorId ? players.find((player) => player.id === creditorId) : null
  if (!debtor || debtor.bankrupt) return { transferred: [], buildingProceeds: 0 }
  let buildingProceeds = 0
  Object.keys(houses).forEach((tileId) => {
    const tile = board.find((item) => item.id === Number(tileId))
    if (tile && properties[tileId] === playerId) {
      const level = Number(houses[tileId])
      buildingProceeds += buildingSaleValue(tile.buildCost || 0, level, rules)
      if (bank) { if (level === 5) bank.hotels += 1; else bank.houses += level }
      delete houses[tileId]
    }
  })
  const transferred = []
  let mortgageInterestPaid = 0
  Object.keys(properties).forEach((tileId) => {
    if (properties[tileId] !== playerId) return
    const tile = board.find((item) => item.id === Number(tileId))
    if (creditor) { properties[tileId] = creditorId; transferred.push(Number(tileId)) }
    else { delete properties[tileId] }
    if (creditor && mortgaged[tileId]) {
      const interest = mortgageValue(tile.price || 0) * rules.mortgageInterest
      mortgageInterestDue[tileId] = interest
      mortgageInterestPaid += interest
    }
    else delete mortgaged[tileId]
  })
  if (creditor) creditor.balance += buildingProceeds - mortgageInterestPaid
  debtor.bankrupt = true
  return { transferred, buildingProceeds, mortgageInterestPaid }
}
