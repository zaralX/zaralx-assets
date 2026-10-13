import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import sharp from 'sharp'
import { renderFace, SKIN_TTL } from '../../src/players'
import { loadSkinImage, STEVE_SKIN } from '../../src/players/http'
import { MemoryCache } from '../../src/utils/cache'

function fakeFastify(cache = new MemoryCache()) {
  return { cache, log: { warn() {} } } as unknown as FastifyInstance
}

test('steve skin is a 64x64 png', async () => {
  const { format, width, height } = await sharp(STEVE_SKIN).metadata()
  assert.deepEqual([format, width, height], ['png', 64, 64])
  const face = await sharp(await renderFace(STEVE_SKIN, 64, true)).metadata()
  assert.deepEqual([face.width, face.height], [64, 64])
})

test('unknown and invalid players get steve', async () => {
  const cache = new MemoryCache()
  await cache.set('player:uuid:nobody_here', Buffer.alloc(0), 60)
  for (const identifier of ['nobody_here', 'a', '.bedrock name']) {
    const { skin, maxAge } = await loadSkinImage(fakeFastify(cache), identifier)
    assert.equal(skin, STEVE_SKIN)
    assert.ok(maxAge < SKIN_TTL)
  }
})

test('known players get their own skin', async () => {
  const cache = new MemoryCache()
  const uuid = '069a79f444e94726a5befca90e38aaf5'
  const own = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#ff0000' } }).png().toBuffer()
  await cache.set('player:uuid:notch', Buffer.from(uuid), 60)
  await cache.set(`player:skin:${uuid}`, own, 60)
  const { skin, maxAge } = await loadSkinImage(fakeFastify(cache), 'Notch')
  assert.equal(skin, own)
  assert.equal(maxAge, SKIN_TTL)
})
