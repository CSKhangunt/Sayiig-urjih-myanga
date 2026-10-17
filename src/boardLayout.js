// Clockwise perimeter path for the 11x11 board. Tile 0 is START at top-left.
export const BOARD_POSITIONS = [
  ...Array.from({ length: 11 }, (_, index) => `1 / ${index + 1}`),
  ...Array.from({ length: 10 }, (_, index) => `${index + 2} / 11`),
  ...Array.from({ length: 11 }, (_, index) => `11 / ${10 - index}`),
  ...Array.from({ length: 8 }, (_, index) => `${10 - index} / 1`),
]
export const BOARD_SIZE = 40
if (BOARD_POSITIONS.length !== BOARD_SIZE) throw new Error('Board path must contain 40 tiles')
