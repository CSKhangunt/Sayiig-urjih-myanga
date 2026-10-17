import test from 'node:test'
import assert from 'node:assert/strict'
import { Presence } from '../server/presence.js'

test('presence keeps a user online while another tab is connected', async () => {
  const events = []
  const presence = new Presence({ graceMs: 5, changed: (...event) => events.push(event) })
  presence.connect('alice', 'tab1'); presence.connect('alice', 'tab2')
  presence.disconnect('alice', 'tab1')
  assert.equal(presence.online('alice'), true)
  assert.deepEqual(events, [['alice', true]])
  presence.disconnect('alice', 'tab2')
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(events, [['alice', true], ['alice', false]])
  assert.equal(presence.users.size, 0)
  presence.close()
})

test('reconnecting within grace period suppresses false offline notifications', async () => {
  const events = []
  const presence = new Presence({ graceMs: 10, changed: (...event) => events.push(event) })
  presence.connect('alice', 'old'); presence.disconnect('alice', 'old'); presence.connect('alice', 'new')
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.deepEqual(events, [['alice', true]])
  assert.equal(presence.online('alice'), true)
  presence.close()
})
