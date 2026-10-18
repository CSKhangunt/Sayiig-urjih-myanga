import test from 'node:test'
import assert from 'node:assert/strict'
import { readRoomRoute, roomPath, roomShareUrl, navigateRoom, joinRoomOnce } from '../src/roomRouting.js'

test('public and private invitations always use the production domain and encode tokens', () => {
  assert.equal(roomShareUrl({ code: 'abc123' }), 'https://sayiig-urjih-myanga.vercel.app/room/ABC123')
  const privateRoom = { code: 'ABC123', settings: { privateRoom: true }, inviteToken: 'a+b&c' }
  const link = new URL(roomShareUrl(privateRoom))
  assert.equal(link.origin, 'https://sayiig-urjih-myanga.vercel.app')
  assert.deepEqual(readRoomRoute(link), { code: 'ABC123', inviteToken: 'a+b&c' })
  assert.throws(() => roomPath({ code: 'ABC123', settings: { privateRoom: true } }))
  assert.equal(readRoomRoute(new URL('https://example.com/')), null)
  assert.equal(readRoomRoute(new URL('https://example.com/room/invalid')), null)
})

test('navigation preserves the invite and supports history without duplicate entries', () => {
  const originalWindow = globalThis.window
  const originalEvent = globalThis.PopStateEvent
  const entries = ['/']
  const events = []
  globalThis.PopStateEvent = class { constructor(type) { this.type = type } }
  globalThis.window = { location: { pathname: '/', search: '' }, history: {
    pushState(_state, _title, path) { entries.push(path); const url = new URL(path, 'https://example.com'); window.location = url },
    replaceState(_state, _title, path) { entries[entries.length - 1] = path; window.location = new URL(path, 'https://example.com') },
  }, dispatchEvent(event) { events.push(event.type) } }
  try {
    navigateRoom('/room/ABC123?invite=secret')
    assert.equal(readRoomRoute(window.location).inviteToken, 'secret')
    navigateRoom('/room/ABC123?invite=secret')
    assert.equal(entries.length, 2)
    navigateRoom('/')
    assert.deepEqual(entries, ['/', '/room/ABC123?invite=secret', '/'])
    assert.deepEqual(events, ['popstate', 'popstate'])
  } finally { globalThis.window = originalWindow; globalThis.PopStateEvent = originalEvent }
})

test('concurrent joins share a request and failures permit an explicit retry', async () => {
  let calls = 0
  const request = async () => { calls++; return { code: 'ABC123' } }
  const first = joinRoomOnce('session/ABC123', request)
  assert.equal(first, joinRoomOnce('session/ABC123', request))
  await first
  assert.equal(calls, 1)
  await assert.rejects(joinRoomOnce('failure', () => Promise.reject(new Error('Өрөө дүүрсэн байна.'))))
  await joinRoomOnce('failure', request)
  assert.equal(calls, 2)
})
