import test from 'node:test'
import assert from 'node:assert/strict'
import { readApiResponse } from '../src/apiErrors.js'

test('API errors identify HTTP status and preserve server explanations', async () => {
  for (const status of [401, 403, 404, 409, 503]) {
    await assert.rejects(readApiResponse(new Response(JSON.stringify({ error: 'Туршилтын алдаа' }), { status })), new RegExp(`HTTP ${status}: Туршилтын алдаа`))
  }
  await assert.rejects(readApiResponse(new Response('<html>Not found</html>', { status: 404 })), /HTTP 404/)
  assert.deepEqual(await readApiResponse(new Response(JSON.stringify({ code: 'ABC123' }))), { code: 'ABC123' })
})
