import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ID_PATTERN, LANG_PATTERN, TEXTURE_PATH_PATTERN } from '../../src/catalog/paths'
import { LruCache } from '../../src/utils/lru'

test('lru evicts the least recently used entries by size', () => {
  const cache = new LruCache<string, string>(5, v => v.length)
  cache.set('a', 'aa')
  cache.set('b', 'bb')
  cache.get('a')
  cache.set('c', 'cc')
  assert.equal(cache.get('b'), undefined)
  assert.equal(cache.get('a'), 'aa')
  assert.equal(cache.get('c'), 'cc')
})

test('path patterns reject traversal', () => {
  assert.ok(TEXTURE_PATH_PATTERN.test('block/stone'))
  assert.ok(TEXTURE_PATH_PATTERN.test('entity/chest/normal'))
  assert.ok(!TEXTURE_PATH_PATTERN.test('block/../../meta'))
  assert.ok(!TEXTURE_PATH_PATTERN.test('../x'))
  assert.ok(!TEXTURE_PATH_PATTERN.test('/etc/passwd'))
  assert.ok(ID_PATTERN.test('diamond_sword'))
  assert.ok(!ID_PATTERN.test('..'))
  assert.ok(!ID_PATTERN.test('a/b'))
  assert.ok(LANG_PATTERN.test('en_us'))
  assert.ok(LANG_PATTERN.test('tok'))
  assert.ok(!LANG_PATTERN.test('../en_us'))
})
