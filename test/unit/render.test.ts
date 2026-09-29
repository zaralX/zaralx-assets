import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ItemRenderer } from '../../src/pipeline/render'
import { testAssets } from './fixtures'

function pixel(image: Buffer, size: number, x: number, y: number) {
  const i = (y * size + x) * 4
  return [...image.subarray(i, i + 4)]
}

test('a white cube is lit like a block in an inventory slot', async () => {
  const renderer = new ItemRenderer(await testAssets())
  const { image } = await renderer.render('white', 64)
  assert.ok(image)
  const top = pixel(image, 64, 32, 14)
  const left = pixel(image, 64, 16, 36)
  const right = pixel(image, 64, 48, 36)
  assert.deepEqual(top, [255, 255, 255, 255])
  assert.ok(left[0] < top[0] && right[0] < left[0], `expected top > left > right, got ${top[0]} ${left[0]} ${right[0]}`)
  assert.equal(pixel(image, 64, 1, 1)[3], 0)
})

test('generated items are flat, tinted and fill the slot', async () => {
  const renderer = new ItemRenderer(await testAssets())
  const { image } = await renderer.render('flat', 16)
  assert.ok(image)
  assert.deepEqual(pixel(image, 16, 0, 0), [255, 0, 0, 255])
  assert.deepEqual(pixel(image, 16, 15, 15), [255, 0, 0, 255])
})
