import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import { once } from 'node:events'
import { verifyToken } from '@clerk/backend'
import { Server } from 'socket.io'
import { io as client } from 'socket.io-client'
import { createAuthentication } from '../server/authentication.js'
import { createGame, rollDice, sanitizeGame } from '../server/gameEngine.js'

const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwtKey = keys.publicKey.export({ type: 'spki', format: 'pem' })
function token(sub = 'alice', expiresIn = 60) {
  const now = Math.floor(Date.now() / 1000)
  const data = [Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub, sid: 'sess_test', iss: 'https://fixture.clerk.accounts.dev', azp: 'http://localhost:5173', iat: now - 60, nbf: now - 60, exp: now + expiresIn })).toString('base64url')].join('.')
  return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), keys.privateKey).toString('base64url')}`
}
const room = { code: 'ABC123', players: [{ sessionHash: 'a', displayName: 'Alice', avatar: '🦅' }, { sessionHash: 'b', displayName: 'Bob', avatar: '🐺' }], settings: { startingCash: 1500000, randomOrder: false } }
const authentication = createAuthentication({ verifyToken, options: { jwtKey, authorizedParties: ['http://localhost:5173'], clockSkewInMs: 0 }, blocked: async (id) => id === 'deleted', findSession: async (id) => ({ clerkId: id === 'a' ? 'alice' : 'bob', tokenHash: id, expiresAt: new Date(Date.now() + 60000) }), findRoom: async (code) => code === room.code ? room : null })
let server, sockets, base, game
before(async () => {
  game = createGame(room); game.status = 'playing'; game.currentPlayerId = 'a'; game.turnState.phase = 'roll'
  server = http.createServer()
  sockets = new Server(server)
  sockets.use(async (socket, next) => {
    try { socket.data.auth = await authentication.authenticateGame({ ...socket.handshake.auth, roomCode: socket.handshake.query.roomCode }); next() } catch (error) { next(error) }
  })
  sockets.on('connection', (socket) => {
    socket.join(room.code)
    socket.emit('game:state', sanitizeGame(game))
    socket.on('game:roll', () => { try { rollDice(game, socket.data.auth.session.tokenHash); sockets.to(room.code).emit('game:state', sanitizeGame(game)) } catch (error) { socket.emit('game:error', error.message) } })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { await new Promise((resolve) => sockets.close(resolve)) })
function connect(auth, code = room.code) { return client(base, { autoConnect: false, auth, query: { roomCode: code }, reconnection: false, timeout: 2000 }) }

test('real Clerk verifier accepts a signed fixture JWT and rejects invalid/missing/expired identities', async () => {
  assert.equal((await authentication.verify(token())).sub, 'alice')
  await assert.rejects(authentication.verify('invalid'))
  await assert.rejects(authentication.verify(undefined))
  await assert.rejects(authentication.verify(token('alice', -30)))
  await assert.rejects(authentication.verify(token('deleted')))
})
test('game socket rejects missing JWT and unauthorized room membership', async () => {
  for (const [auth, code] of [[{ token: 'a' }, room.code], [{ token: 'a', clerkToken: token() }, 'OTHER1'], [{ token: 'b', clerkToken: token() }, room.code]]) {
    const socket = connect(auth, code)
    const rejected = once(socket, 'connect_error')
    socket.connect(); await rejected; socket.disconnect()
  }
})
test('two authenticated tabs receive identical state, authoritative dice, and restored reconnect state', async () => {
  const first = connect({ token: 'a', clerkToken: token() }), second = connect({ token: 'a', clerkToken: token() })
  try {
    const firstState = once(first, 'game:state'), secondState = once(second, 'game:state')
    first.connect(); second.connect()
    assert.deepEqual((await firstState)[0], (await secondState)[0])
    const rolledFirst = once(first, 'game:state'), rolledSecond = once(second, 'game:state')
    first.emit('game:roll')
    const state = (await rolledFirst)[0]
    assert.deepEqual(state, (await rolledSecond)[0])
    assert.deepEqual(state.dice, game.dice)
    first.disconnect()
    const restored = once(first, 'game:state'); first.connect()
    assert.deepEqual((await restored)[0], sanitizeGame(game))
  } finally { first.disconnect(); second.disconnect() }
})
