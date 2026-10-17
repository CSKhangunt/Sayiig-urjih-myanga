import test from 'node:test'
import assert from 'node:assert/strict'
import { validateProfile, skins } from '../shared/cosmetics.js'

test('profile updates reject unsafe names and unsupported avatar values', () => {
  assert.throws(() => validateProfile({ displayName: '<script>' }, []))
  assert.throws(() => validateProfile({ avatar: 'https://untrusted.test/avatar' }, []))
  assert.deepEqual(validateProfile({ displayName: ' Саруул ', avatar: '🐺' }, []), { displayName: 'Саруул', avatar: '🐺' })
})
test('skin selection requires ownership and an available catalog entry', () => {
  assert.throws(() => validateProfile({ activeSkin: 'sun-free' }, ['steppe-free']))
  assert.throws(() => validateProfile({ activeSkin: 'unknown' }, ['unknown']))
  assert.deepEqual(validateProfile({ activeSkin: 'steppe-free' }, ['steppe-free']), { activeSkin: 'steppe-free' })
  assert.equal(new Set(skins.map((skin) => skin.id)).size, skins.length)
})
