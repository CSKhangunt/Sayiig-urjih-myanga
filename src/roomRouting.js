import { PRODUCTION_ORIGIN } from '../shared/deployment.js'
export { PRODUCTION_ORIGIN }

export function readRoomRoute(location) {
  const match = /^\/room\/([a-z0-9]{6})\/?$/i.exec(location.pathname)
  return match ? { code: match[1].toUpperCase(), inviteToken: new URLSearchParams(location.search).get('invite') || undefined } : null
}

export function roomPath(room) {
  const code = String(room.code).toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Өрөөний код буруу байна.')
  if (room.settings?.privateRoom && !room.inviteToken) throw new Error('Хувийн өрөөний урилгын холбоос олдсонгүй.')
  return `/room/${code}${room.settings?.privateRoom ? `?invite=${encodeURIComponent(room.inviteToken)}` : ''}`
}

export const roomShareUrl = (room) => `${PRODUCTION_ORIGIN}${roomPath(room)}`

export function navigateRoom(path, replace = false) {
  if (`${window.location.pathname}${window.location.search}` !== path) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

const pendingJoins = new Map()
export function joinRoomOnce(key, request) {
  if (!pendingJoins.has(key)) {
    const pending = Promise.resolve().then(request).finally(() => { if (pendingJoins.get(key) === pending) pendingJoins.delete(key) })
    pendingJoins.set(key, pending)
  }
  return pendingJoins.get(key)
}
