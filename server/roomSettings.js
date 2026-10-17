import { validatePropertyRentTables } from './monopolyRules.js'

export const STARTING_CASH_OPTIONS = [500000, 1000000, 1500000, 2000000, 2500000, 3000000]
export const MAP_OPTIONS = ['Сонгодог']
export const DEFAULT_ROOM_SETTINGS = Object.freeze({ maxPlayers: 4, startingCash: 1500000, privateRoom: false, bots: false, map: 'Сонгодог', doubledSetRent: true, vacationCash: false, auction: true, noRentInPrison: false, mortgage: true, evenBuild: true, randomOrder: true })

export const normalizeRoomSettings = (input = {}) => {
  const maxPlayers = Number(input.maxPlayers)
  const startingCash = Number(input.startingCash)
  return {
    ...DEFAULT_ROOM_SETTINGS,
    ...input,
    maxPlayers: [2, 3, 4, 5, 6, 7, 8].includes(maxPlayers) ? maxPlayers : DEFAULT_ROOM_SETTINGS.maxPlayers,
    startingCash: STARTING_CASH_OPTIONS.includes(startingCash) ? startingCash : DEFAULT_ROOM_SETTINGS.startingCash,
    map: MAP_OPTIONS.includes(input.map) ? input.map : DEFAULT_ROOM_SETTINGS.map,
    privateRoom: Boolean(input.privateRoom),
    bots: false,
    doubledSetRent: input.doubledSetRent !== false,
    vacationCash: Boolean(input.vacationCash),
    auction: input.auction !== false,
    noRentInPrison: Boolean(input.noRentInPrison),
    mortgage: input.mortgage !== false,
    evenBuild: input.evenBuild !== false,
    randomOrder: input.randomOrder !== false,
    rules: { ...(input.rules || {}) },
  }
}

export const validateRoomSettings = (input = {}) => {
  const normalized = normalizeRoomSettings(input)
  if (!MAP_OPTIONS.includes(normalized.map)) throw new Error('Unsupported board map.')
  if (normalized.bots) throw new Error('Bots are unavailable until AI gameplay is implemented.')
  if (!validatePropertyRentTables(normalized.rules.propertyRentTables || {})) throw new Error('Invalid custom property rent tables.')
  return normalized
}

export const validateRoomCapacity = (settings, playerCount) => {
  const normalized = validateRoomSettings(settings)
  if (Number(playerCount) > normalized.maxPlayers) throw new Error('Room capacity cannot be lower than the current player count.')
  return normalized
}
