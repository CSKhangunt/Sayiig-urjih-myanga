import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { io } from 'socket.io-client'

test('real backend integrates signed auth, profiles, friendship, private invitations, skins and reconnect', { timeout: 60000 }, async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const reservation = http.createServer()
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve))
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  const base = `http://127.0.0.1:${port}`
  const origin = 'http://localhost:5173'
  const tokens = {}
  for (const id of ['alice', 'bob']) {
    const now = Math.floor(Date.now() / 1000)
    const data = [Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, sid: `sess_${id}`, iss: 'https://fixture.clerk.accounts.dev', azp: origin, iat: now, nbf: now, exp: now + 300 })).toString('base64url')].join('.')
    tokens[id] = `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), keys.privateKey).toString('base64url')}`
  }
  let diagnostics = ''
  const backend = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, NODE_ENV: 'test', PORT: String(port), MONGODB_URI: replica.getUri('application-integration'), CLERK_SECRET_KEY: 'sk_test_fixture_only', CLERK_JWT_KEY: keys.publicKey.export({ type: 'spki', format: 'pem' }), CLIENT_ORIGIN: origin }, stdio: ['ignore', 'pipe', 'pipe'] })
  backend.stdout.on('data', (data) => { diagnostics += data.toString() })
  backend.stderr.on('data', (data) => { diagnostics += data.toString() })
  const sockets = []
  const sessions = {}
  async function request(id, path, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${path.startsWith('/api/rooms') ? sessions[id]?.token : tokens[id]}`, 'X-Clerk-Token': tokens[id], 'X-Game-Token': sessions[id]?.token || '' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const data = await response.json()
    assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`)
    return data
  }
  function socket(id, room) { const connection = io(base, { forceNew: true, autoConnect: false, query: { roomCode: room.code }, auth: { token: sessions[id].token, clerkToken: tokens[id] }, reconnection: false }); sockets.push(connection); return connection }
  try {
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      try { const health = await fetch(`${base}/api/health`); if (health.ok) { ready = true; break } } catch { /* startup */ }
      if (backend.exitCode !== null) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert.ok(ready, `Backend failed to start: ${diagnostics}`)
    const untrusted = await fetch(`${base}/api/health`, { headers: { Origin: 'https://untrusted.example' } })
    assert.equal(untrusted.headers.get('access-control-allow-origin'), null)
    assert.equal(untrusted.status, 403)
    const unauthenticated = await fetch(`${base}/api/profile`)
    assert.equal(unauthenticated.status, 401)
    for (const id of ['alice', 'bob']) sessions[id] = await request(id, '/api/clerk-session', 'POST', { displayName: id, avatar: '🦅' })
    assert.deepEqual(sessions.alice.profile.skins, ['steppe-free'])
    const restored = await request('alice', '/api/clerk-session', 'POST', { displayName: 'ignored', avatar: '🐺' })
    assert.equal(restored.token, sessions.alice.token)
    assert.equal(restored.profile.displayName, 'alice')
    const socialAlice = io(`${base}/social`, { autoConnect: false, auth: { token: tokens.alice }, reconnection: false })
    const socialBob = io(`${base}/social`, { autoConnect: false, auth: { token: tokens.bob }, reconnection: false })
    sockets.push(socialAlice, socialBob)
    const aliceConnected = once(socialAlice, 'connect'); socialAlice.connect(); await aliceConnected
    const search = await request('alice', '/api/friends/search?q=bob')
    assert.equal(search.players[0].clerkId, 'bob')
    const relation = await request('alice', '/api/friends/request', 'POST', { clerkId: 'bob' })
    await request('bob', `/api/friends/${relation.relation._id}`, 'PATCH', { status: 'accepted' })
    const friends = await request('alice', '/api/friends/requests')
    assert.equal(friends.requests[0].status, 'accepted')
    const online = once(socialAlice, 'presence:changed')
    const bobConnected = once(socialBob, 'connect'); socialBob.connect(); await bobConnected
    assert.deepEqual((await online)[0], { clerkId: 'bob', online: true })
    const publicRoom = await request('alice', '/api/rooms', 'POST', { privateRoom: false, maxPlayers: 4, startingCash: 1500000 })
    assert.equal((await request('alice', '/api/rooms')).rooms.some((item) => item.code === publicRoom.code), false)
    // Listing before the first socket connects must never delete a newly created room.
    await request('alice', `/api/rooms/${publicRoom.code}`)
    const publicSocket = socket('alice', publicRoom)
    const publicState = once(publicSocket, 'game:state'); publicSocket.connect(); await publicState
    let listed = (await request('alice', '/api/rooms')).rooms.find((item) => item.code === publicRoom.code)
    assert.ok(listed)
    assert.equal(listed.players[0].sessionHash, undefined)
    await request('bob', `/api/rooms/${publicRoom.code}/join`, 'POST', {})
    listed = (await request('alice', '/api/rooms')).rooms.find((item) => item.code === publicRoom.code)
    assert.equal(listed.players.length, 2)
    const publicDisconnected = once(publicSocket, 'disconnect'); publicSocket.disconnect(); await publicDisconnected
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.equal((await request('alice', '/api/rooms')).rooms.some((item) => item.code === publicRoom.code), false)
    await request('alice', `/api/rooms/${publicRoom.code}`)
    const refreshed = once(publicSocket, 'game:state'); publicSocket.connect(); await refreshed
    assert.ok((await request('alice', '/api/rooms')).rooms.some((item) => item.code === publicRoom.code))
    publicSocket.disconnect()
    const room = await request('alice', '/api/rooms', 'POST', { privateRoom: true, maxPlayers: 2, startingCash: 1500000, randomOrder: false })
    const forbiddenSocket = socket('bob', room)
    const invalidInvite = await fetch(`${base}/api/rooms/${room.code}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessions.bob.token}`, 'X-Clerk-Token': tokens.bob }, body: JSON.stringify({ inviteToken: 'invalid' }) })
    assert.equal(invalidInvite.status, 403)
    const forbidden = once(forbiddenSocket, 'connect_error'); forbiddenSocket.connect(); await forbidden; forbiddenSocket.disconnect()
    const notification = once(socialBob, 'invitation:received')
    const sent = await request('alice', '/api/invitations', 'POST', { recipientId: 'bob', roomId: room.code })
    assert.equal((await notification)[0].id, sent.invitation._id)
    const pending = await request('bob', '/api/invitations')
    assert.equal(pending.invitations.length, 1)
    await request('bob', `/api/invitations/${sent.invitation._id}`, 'PATCH', { status: 'accepted' })
    const first = socket('alice', room), second = socket('bob', room)
    const firstState = once(first, 'game:state'), secondState = once(second, 'game:state')
    first.connect(); second.connect()
    const [initialAlice, initialBob] = await Promise.all([firstState, secondState])
    assert.deepEqual(initialAlice[0].players.map((player) => player.id), initialBob[0].players.map((player) => player.id))
    const updatedState = once(second, 'game:state')
    await request('alice', '/api/skins/sun-free/claim', 'POST')
    await request('alice', '/api/profile', 'PATCH', { displayName: 'Саруул', activeSkin: 'sun-free', avatar: '🐺' })
    assert.equal((await updatedState)[0].players.find((player) => player.name === 'alice').activeSkin, 'sun-free')
    const profile = await request('alice', '/api/profile')
    assert.equal(profile.profile.displayName, 'Саруул')
    const started = once(second, 'game:state'); first.emit('game:start'); assert.equal((await started)[0].status, 'playing')
    const resumedRoom = await request('alice', `/api/rooms/${room.code}/join`, 'POST', { inviteToken: room.inviteToken })
    assert.equal(resumedRoom.code, room.code)
    assert.equal(resumedRoom.status, 'playing')
    const firstRoll = once(first, 'game:state'), secondRoll = once(second, 'game:state')
    first.emit('game:roll')
    const rolled = (await firstRoll)[0]
    assert.deepEqual(rolled, (await secondRoll)[0])
    first.disconnect()
    const reconnected = once(first, 'game:state'); first.connect()
    assert.deepEqual((await reconnected)[0].dice, rolled.dice)
    first.disconnect(); second.disconnect()
    assert.equal(first.connected, false)
    assert.equal(second.connected, false)
  } finally {
    for (const connection of sockets) connection.disconnect()
    if (backend.exitCode === null) { const exited = once(backend, 'exit'); backend.kill('SIGTERM'); await exited }
    await replica.stop()
  }
})
