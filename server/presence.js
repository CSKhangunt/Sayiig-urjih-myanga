// Single-process connection tracking. Socket.IO heartbeat owns stale socket detection.
export class Presence {
  constructor({ graceMs = 5000, changed = () => {} } = {}) { this.users = new Map(); this.graceMs = graceMs; this.changed = changed }
  online(id) { return Boolean(this.users.get(id)?.sockets.size) }
  connect(id, socketId) {
    let entry = this.users.get(id)
    if (!entry) { entry = { sockets: new Set(), timer: null }; this.users.set(id, entry) }
    const announced = entry.sockets.size > 0 || Boolean(entry.timer)
    clearTimeout(entry.timer); entry.timer = null; entry.sockets.add(socketId)
    if (!announced) this.changed(id, true)
  }
  disconnect(id, socketId) {
    const entry = this.users.get(id)
    if (!entry) return
    entry.sockets.delete(socketId)
    if (entry.sockets.size || entry.timer) return
    entry.timer = setTimeout(() => { this.users.delete(id); this.changed(id, false) }, this.graceMs)
    entry.timer.unref?.()
  }
  close() { for (const entry of this.users.values()) clearTimeout(entry.timer); this.users.clear() }
}
