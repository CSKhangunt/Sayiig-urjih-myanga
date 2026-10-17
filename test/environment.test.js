import test from 'node:test'
import assert from 'node:assert/strict'
import { serverEnvironment } from '../server/environment.js'

test('production requires secrets and explicit HTTPS origins without paths or wildcards', () => {
  assert.throws(() => serverEnvironment({ NODE_ENV: 'production' }))
  const environment = { NODE_ENV: 'production', CLERK_SECRET_KEY: 'test-fixture-only', MONGODB_URI: 'mongodb://fixture', CLIENT_ORIGIN: 'https://game.example', PORT: '10000' }
  assert.deepEqual(serverEnvironment(environment).origins, ['https://game.example'])
  for (const origin of ['*', 'http://game.example', 'https://game.example/path', 'https://game.example/']) assert.throws(() => serverEnvironment({ ...environment, CLIENT_ORIGIN: origin }))
  assert.throws(() => serverEnvironment({ ...environment, PORT: 'not-a-port' }))
})
