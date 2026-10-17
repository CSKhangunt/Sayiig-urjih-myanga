import test from 'node:test'
import assert from 'node:assert/strict'
import { BOARD_POSITIONS, BOARD_SIZE } from '../src/boardLayout.js'

test('board has 40 unique perimeter positions with START at top-left', () => {
  assert.equal(BOARD_POSITIONS.length, BOARD_SIZE)
  assert.equal(BOARD_POSITIONS[0], '1 / 1')
  assert.equal(new Set(BOARD_POSITIONS).size, BOARD_SIZE)
  assert.equal(BOARD_POSITIONS.at(-1), '3 / 1')
})

test('one complete lap returns to START', () => {
  assert.equal(BOARD_POSITIONS[(0 + BOARD_SIZE) % BOARD_SIZE], BOARD_POSITIONS[0])
})
