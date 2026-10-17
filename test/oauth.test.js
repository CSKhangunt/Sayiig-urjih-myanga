import test from 'node:test'
import assert from 'node:assert/strict'
import { installOAuth } from '../server/oauth.js'

function setup() {
  const routes = new Map()
  let databaseQueries = 0
  class Schema { index() { return this } }
  const mongoose = { Schema, model: () => ({ findOneAndDelete: async () => { databaseQueries++; return null } }) }
  const app = { use() {}, get: (path, ...handlers) => routes.set(path, handlers.at(-1)), post: (path, ...handlers) => routes.set(path, handlers.at(-1)) }
  installOAuth(app, { mongoose, GuestSession: {}, createSessionResponse() {}, allowedAvatars: ['avatar'], clientOrigin: 'http://localhost:5173', requireDatabase() {} })
  const res = { set() {}, clearCookie() {}, redirect(url) { this.url = url }, sendStatus(status) { this.status = status } }
  return { routes, res, queries: () => databaseQueries }
}

test('callback rejects state from a different browser before accessing identities', async () => {
  const { routes, res, queries } = setup()
  await routes.get('/api/auth/:provider/callback')({ params: { provider: 'google' }, query: { state: 'attacker' }, headers: { cookie: 'oauth_state=browser' } }, res)
  assert.match(res.url, /invalid_state/)
  assert.equal(queries(), 0)
})

test('callback rejects expired or replayed transactions', async () => {
  const { routes, res, queries } = setup()
  await routes.get('/api/auth/:provider/callback')({ params: { provider: 'facebook' }, query: { state: 'browser', code: 'code' }, headers: { cookie: 'oauth_state=browser' } }, res)
  assert.match(res.url, /cancelled/)
  assert.equal(queries(), 1)
})

test('session handoff rejects requests from another origin', async () => {
  const { routes, res } = setup()
  await routes.get('/api/auth/oauth-session')({ headers: { origin: 'https://other.example' } }, res)
  assert.equal(res.status, 403)
})
