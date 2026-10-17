// Original vector fallback art. Replace `src` with approved WebP/PNG files when licensed assets are supplied.
const escapeSvg = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const makeFallback = (label, from, to) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="180" rx="24" fill="url(#g)"/><circle cx="260" cy="42" r="58" fill="white" opacity=".12"/><path d="M0 145 70 100 125 130 205 76 320 145V180H0Z" fill="white" opacity=".12"/><text x="24" y="105" fill="white" font-family="Arial,sans-serif" font-size="26" font-weight="700">${escapeSvg(label)}</text></svg>`)}`

export const propertyAssets = {
  1: { kind: 'logo', label: 'GS25', src: makeFallback('GS25', '#087b45', '#1b4d9b') },
  3: { kind: 'logo', label: 'CU', src: makeFallback('CU', '#5d2c91', '#e7b8ff') },
  5: { kind: 'food', label: 'Пирошки', src: makeFallback('ПИРОШКИ', '#b86b34', '#552817') },
  6: { kind: 'store', label: 'МИНИЙ ДЭЛГҮҮР', src: makeFallback('МИНИЙ ДЭЛГҮҮР', '#267f7c', '#143b58') },
  7: { kind: 'food', label: 'PIZZA', src: makeFallback('PIZZA + BURGER', '#bc493e', '#3d1826') },
  9: { kind: 'clinic', label: 'MY DENT', src: makeFallback('MY DENT', '#ca8b45', '#452e5f') },
  11: { kind: 'place', label: '21', src: makeFallback('21-ИЙН ТАЛБАЙ', '#386d8b', '#182d55') },
  12: { kind: 'food', label: 'EFES', src: makeFallback('EFES', '#b88a2e', '#41251d') },
  13: { kind: 'place', label: 'PARK', src: makeFallback('ПАРК', '#4e9b68', '#193d39') },
  14: { kind: 'place', label: 'ZAISAN', src: makeFallback('ЗАЙСАН', '#4e9b68', '#283451') },
  15: { kind: 'logo', label: 'KFC', src: makeFallback('KFC', '#d32f3d', '#5b1727') },
  16: { kind: 'home', label: 'IVELT', src: makeFallback('IVELT\'S LAGAR', '#b97846', '#3e2142') },
  17: { kind: 'home', label: 'GUNE', src: makeFallback('GUNE\'S HOME', '#b97846', '#272c58') },
  18: { kind: 'home', label: 'TAMIRA', src: makeFallback('TAMIRA\'S HOME', '#77578c', '#242047') },
  21: { kind: 'home', label: 'TUGU', src: makeFallback('TUGU\'S HOME', '#386d8b', '#182d55') },
  22: { kind: 'sport', label: 'OLYMP', src: makeFallback('OLYMP', '#386d8b', '#263b70') },
  23: { kind: 'food', label: 'JUR UR', src: makeFallback('JUR UR', '#2996b2', '#35244c') },
  24: { kind: 'home', label: 'TUVSHU', src: makeFallback('TUVSHU\'S HOME', '#386d8b', '#182d55') },
  25: { kind: 'food', label: 'ХУУШУУР', src: makeFallback('ХУУШУУР', '#aa613a', '#4c241f') },
  26: { kind: 'home', label: 'KAT', src: makeFallback('KAT\'S HOME', '#b84d62', '#321c48') },
  27: { kind: 'home', label: 'IVERLT', src: makeFallback('IVERLT\'S HOME', '#b84d62', '#321c48') },
  29: { kind: 'home', label: 'AZA', src: makeFallback('AZA\'S HOME', '#b84d62', '#321c48') },
  31: { kind: 'car', label: 'AQUA', src: makeFallback('TOYOTA AQUA', '#3a918e', '#152f50') },
  32: { kind: 'car', label: 'PRIUS 20', src: makeFallback('PRIUS 20', '#3a918e', '#152f50') },
  34: { kind: 'car', label: 'PRIUS 30', src: makeFallback('PRIUS 30', '#3a918e', '#152f50') },
  35: { kind: 'food', label: 'KIMBAP', src: makeFallback('KIMBAP', '#42678b', '#211b43') },
  37: { kind: 'gaming', label: 'P-GAMING', src: makeFallback('P-GAMING', '#7856a5', '#21143c') },
  39: { kind: 'gaming', label: 'META', src: makeFallback('META-GAMING', '#7856a5', '#21143c') },
}

export const specialAssets = {
  start: makeFallback('START', '#8b5cf6', '#39205e'),
  chance: makeFallback('TREASURE', '#bd8e42', '#48253a'),
  tax: makeFallback('ТАТВАР', '#b84d62', '#35182c'),
  jail: makeFallback('ШОРОН', '#596074', '#1b2036'),
  vacation: makeFallback('АМРАЛТ', '#4d9b87', '#173d4a'),
}
