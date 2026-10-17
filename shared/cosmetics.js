export const skins = [
  { id: 'steppe-free', name: 'Хөх талын зам', description: 'Тэнгэрийн хөх хүрээтэй эхний үнэгүй дүр.', color: '#38bdf8', free: true, available: true },
  { id: 'sun-free', name: 'Алтан нар', description: 'Алтан шар хүрээтэй үнэгүй дүр.', color: '#fbbf24', free: true, available: true },
]
export const avatars = ['🦅', '🐎', '🐺', '🦌', '🐫']
export function validateProfile(body, owned) {
  const update = {}
  if (body.username !== undefined) {
    if (typeof body.username !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(body.username)) throw new Error('Хэрэглэгчийн нэр 3–24 латин үсэг, тоо, доогуур зураастай байна.')
    update.username = body.username.toLowerCase()
  }
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string' || body.displayName.trim().length < 2 || body.displayName.trim().length > 18 || /[<>]/u.test(body.displayName) || [...body.displayName].some((character) => character.codePointAt(0) < 32)) throw new Error('Нэр 2–18 тэмдэгттэй байна.')
    update.displayName = body.displayName.trim()
  }
  if (body.avatar !== undefined) { if (!avatars.includes(body.avatar)) throw new Error('Дүрийн сонголт буруу.'); update.avatar = body.avatar }
  if (body.activeSkin !== undefined) { if (!owned.includes(body.activeSkin) || !skins.some((skin) => skin.id === body.activeSkin && skin.available)) throw new Error('Эзэмшдэг дүрээ сонгоно уу.'); update.activeSkin = body.activeSkin }
  return update
}
