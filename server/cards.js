import crypto from 'node:crypto'

export const createClassicDecks = () => ({
  chance: [
    { id: 'chance-advance-go', type: 'advance', target: 0, text: 'Advance to GO.' },
    { id: 'chance-go-jail', type: 'jail', text: 'Go directly to Jail.' },
    { id: 'chance-jail-free', type: 'get-out-of-jail', text: 'Get Out of Jail Free.' },
    { id: 'chance-bank-pays', type: 'collect', amount: 50000, text: 'Bank pays you.' },
    { id: 'chance-repairs', type: 'repairs', house: 2500, hotel: 10000, text: 'Pay for repairs.' },
    { id: 'chance-nearest-railroad', type: 'nearest', targetType: 'transport', rentMultiplier: 2, text: 'Advance to the nearest railroad. Pay twice the usual rent.' },
    { id: 'chance-nearest-utility', type: 'nearest', targetType: 'utility', text: 'Advance to the nearest utility.' },
    { id: 'chance-back-three', type: 'back', spaces: 3, text: 'Go back three spaces.' },
    { id: 'chance-reading', type: 'pay', amount: 15000, text: 'Pay a reading fee.' },
    { id: 'chance-poor-tax', type: 'pay', amount: 15000, text: 'Pay a poor tax.' },
    { id: 'chance-dividend', type: 'collect', amount: 5000, text: 'Receive a dividend.' },
    { id: 'chance-building-loan', type: 'collect', amount: 25000, text: 'Receive a building loan.' },
    { id: 'chance-chairman', type: 'pay-each-player', amount: 50000, text: 'Pay each player.' },
    { id: 'chance-crossword', type: 'collect', amount: 10000, text: 'Receive a crossword prize.' },
    { id: 'chance-move-back', type: 'back', spaces: 1, text: 'Move back one space.' },
    { id: 'chance-bank-error', type: 'collect', amount: 200000, text: 'Bank error in your favor.' },
  ],
  chest: [
    { id: 'chest-advance-go', type: 'advance', target: 0, text: 'Advance to GO.' },
    { id: 'chest-go-jail', type: 'jail', text: 'Go directly to Jail.' },
    { id: 'chest-jail-free', type: 'get-out-of-jail', text: 'Get Out of Jail Free.' },
    { id: 'chest-bank-pays', type: 'collect', amount: 200000, text: 'Bank pays you.' },
    { id: 'chest-fine', type: 'pay', amount: 50000, text: 'Pay a fine.' },
    { id: 'chest-birthday', type: 'collect-from-players', amount: 10000, text: 'Collect from every player.' },
    { id: 'chest-repairs', type: 'repairs', house: 4000, hotel: 20000, text: 'Pay for repairs.' },
    { id: 'chest-inherit', type: 'collect', amount: 100000, text: 'You inherit money.' },
    { id: 'chest-hospital', type: 'pay', amount: 10000, text: 'Pay hospital fees.' },
    { id: 'chest-school', type: 'pay', amount: 150000, text: 'Pay school fees.' },
    { id: 'chest-consultancy', type: 'collect', amount: 25000, text: 'Receive consultancy fees.' },
    { id: 'chest-life-insurance', type: 'collect', amount: 100000, text: 'Receive life insurance.' },
    { id: 'chest-stock', type: 'collect', amount: 50000, text: 'Receive stock proceeds.' },
    { id: 'chest-holiday', type: 'collect', amount: 100000, text: 'Receive holiday fund.' },
    { id: 'chest-beauty', type: 'collect', amount: 10000, text: 'Receive a beauty contest prize.' },
    { id: 'chest-grand-opera', type: 'collect', amount: 10000, text: 'Receive a community prize.' },
  ],
})

export const shuffleCards = (cards, random = crypto.randomInt) => {
  const shuffled = cards.map((card) => ({ ...card }))
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = random(0, index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

export const validateCardDecks = (decks = {}) => {
  if (!decks || typeof decks !== 'object') return false
  const allIds = Object.values(decks).flatMap((cards) => Array.isArray(cards) ? cards.map((card) => card?.id) : [])
  return new Set(allIds).size === allIds.length && Object.values(decks).every((cards) => Array.isArray(cards) && new Set(cards.map((card) => card?.id)).size === cards.length && cards.every((card) => {
    if (!card || typeof card !== 'object' || typeof card.id !== 'string' || !card.id) return false
    if (!['advance', 'back', 'jail', 'get-out-of-jail', 'collect', 'pay', 'collect-from-players', 'pay-each-player', 'repairs', 'nearest'].includes(card.type)) return false
    if (['collect', 'pay', 'collect-from-players', 'pay-each-player'].includes(card.type) && (!Number.isFinite(Number(card.amount)) || Number(card.amount) < 0)) return false
    if (card.type === 'advance' && (!Number.isInteger(card.target) || card.target < 0 || card.target >= 40)) return false
    if (card.type === 'back' && (!Number.isInteger(card.spaces) || card.spaces <= 0)) return false
    if (card.type === 'nearest' && !['transport', 'utility'].includes(card.targetType)) return false
    if (card.type === 'repairs' && (![card.house, card.hotel].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0))) return false
    return true
  }))
}

export const createCardState = (decks = createClassicDecks(), random = crypto.randomInt) => ({
  decks: (() => {
    if (!validateCardDecks(decks)) throw new Error('Invalid card deck configuration.')
    return Object.fromEntries(Object.entries(decks).map(([name, cards]) => [name, { draw: shuffleCards(cards, random), discard: [] }]))
  })(),
})

export const drawCard = (cardState, deckName, random = crypto.randomInt) => {
  const deck = cardState.decks[deckName]
  if (!deck) throw new Error('Unknown card deck.')
  if (!deck.draw.length) deck.draw = shuffleCards(deck.discard.splice(0), random)
  const card = deck.draw.shift()
  if (!card) throw new Error('Card deck is empty.')
  if (card.type !== 'get-out-of-jail') deck.discard.push(card)
  return card
}

export const returnJailCard = (cardState, deckName, cardId) => {
  const deck = cardState.decks[deckName]
  if (!deck) throw new Error('Unknown card deck.')
  if (deck.draw.some((card) => card.id === cardId) || deck.discard.some((card) => card.id === cardId)) return false
  deck.discard.push({ id: cardId, type: 'get-out-of-jail' })
  return true
}
