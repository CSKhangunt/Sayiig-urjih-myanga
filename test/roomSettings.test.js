import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRoomSettings, validateRoomCapacity, validateRoomSettings } from '../server/roomSettings.js'

test('room settings accept only supported capacities and Classic cash presets', () => {
  assert.equal(normalizeRoomSettings({ maxPlayers: 8, startingCash: 3000000 }).maxPlayers, 8)
  assert.equal(normalizeRoomSettings({ maxPlayers: 9, startingCash: 700000 }).maxPlayers, 4)
  assert.equal(normalizeRoomSettings({ maxPlayers: 9, startingCash: 700000 }).startingCash, 1500000)
})

test('bots are rejected because no authoritative AI engine exists', () => {
  assert.equal(validateRoomSettings({ bots: true }).bots, false)
})

test('house rules default off while Classic rules default on', () => {
  const settings = normalizeRoomSettings({})
  assert.equal(settings.vacationCash, false)
  assert.equal(settings.noRentInPrison, false)
  assert.equal(settings.auction, true)
  assert.equal(settings.evenBuild, true)
})

test('room capacity cannot be lowered below current players', () => {
  assert.throws(() => validateRoomCapacity({ maxPlayers: 2 }, 3), /capacity/i)
  assert.equal(validateRoomCapacity({ maxPlayers: 4 }, 3).maxPlayers, 4)
})

test('custom rent tables are preserved and validated in room rules', () => {
  const settings = validateRoomSettings({ rules: { propertyRentTables: { 1: [10, 20, 30, 40, 50] } } })
  assert.deepEqual(settings.rules.propertyRentTables[1], [10, 20, 30, 40, 50])
  assert.throws(() => validateRoomSettings({ rules: { propertyRentTables: { 1: [10, 20] } } }), /rent tables/i)
})

test('unsupported maps normalize to the only authoritative playable board', () => {
  assert.equal(validateRoomSettings({ map: 'Улаанбаатар' }).map, 'Сонгодог')
})
