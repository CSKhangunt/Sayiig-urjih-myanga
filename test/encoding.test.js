import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

test('application source contains valid UTF-8 without known mojibake', async () => {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  async function check(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name)
      if (entry.isDirectory()) await check(file)
      else if (/\.(js|jsx|css)$/.test(entry.name)) {
        const source = decoder.decode(await readFile(file))
        assert.equal(/\uFFFD|(?:\u00d0[\u0080-\u00ff]){2}|\u00e2\u20ac/.test(source), false, file)
      }
    }
  }
  for (const dir of ['src', 'server', 'shared']) await check(dir)
})
