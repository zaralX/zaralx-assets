import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import sharp from 'sharp'
import { JarAssets } from '../../src/pipeline/jar'
import { ICON_SIZE, ItemRenderer } from '../../src/pipeline/render'
import { downloadVerified, fetchJson, fetchManifest, type VersionJson } from '../../src/mojang'

const VERSION = '1.21.5'
const GOLDEN_DIR = join(__dirname, VERSION)
const CACHE_DIR = process.env.GOLDEN_CACHE_DIR ?? join(__dirname, '..', '..', 'data', 'cache', 'jars')

const MAX_MEAN_DIFF = 3
// GPU rasterization snaps vertices to a subpixel grid, so pixels lying on a shared edge may land on the other face.
// Such mismatches form 1-2px lines, while a wrong texel covers ~10px at this size, so the mask is eroded by 2px.
const EDGE_EROSION = 2

async function rgba(input: Buffer | string, raw?: boolean) {
  const image = raw
    ? sharp(input as Buffer, { raw: { width: ICON_SIZE, height: ICON_SIZE, channels: 4 } })
    : sharp(input)
  return image.ensureAlpha().resize(ICON_SIZE, ICON_SIZE, { kernel: 'nearest' }).raw().toBuffer()
}

// The screenshots were read back from the framebuffer, where blending leaves colors premultiplied by alpha
function premultiply(image: Buffer) {
  for (let i = 0; i < image.length; i += 4) {
    const a = image[i + 3] / 255
    image[i] = Math.round(image[i] * a)
    image[i + 1] = Math.round(image[i + 1] * a)
    image[i + 2] = Math.round(image[i + 2] * a)
  }
  return image
}

function erode(mask: Uint8Array, radius: number) {
  let current = mask
  for (let r = 0; r < radius; r++) {
    const next = new Uint8Array(current.length)
    for (let y = 1; y < ICON_SIZE - 1; y++) {
      for (let x = 1; x < ICON_SIZE - 1; x++) {
        const i = y * ICON_SIZE + x
        next[i] = current[i] & current[i - 1] & current[i + 1] & current[i - ICON_SIZE] & current[i + ICON_SIZE]
      }
    }
    current = next
  }
  return current
}

function compare(a: Buffer, b: Buffer) {
  const mismatch = new Uint8Array(ICON_SIZE * ICON_SIZE)
  let alphaMismatch = 0
  let diff = 0
  let pixels = 0
  for (let i = 0; i < a.length; i += 4) {
    const va = a[i + 3] > 127
    const vb = b[i + 3] > 127
    if (va !== vb) {
      mismatch[i / 4] = 1
      alphaMismatch++
      continue
    }
    if (!va) continue
    pixels++
    diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
  }
  const areaMismatch = alphaMismatch ? erode(mismatch, EDGE_EROSION).reduce((sum, v) => sum + v, 0) : 0
  return { alphaMismatch, areaMismatch, meanDiff: pixels ? diff / pixels / 3 : 0 }
}

test(`item icons match in-game screenshots of ${VERSION}`, { timeout: 15 * 60_000 }, async () => {
  const manifest = await fetchManifest()
  const entry = manifest.versions.find(v => v.id === VERSION)
  assert.ok(entry, `${VERSION} is not in the version manifest`)
  const version = await fetchJson<VersionJson>(entry.url)
  const jarFile = join(CACHE_DIR, `${version.downloads.client.sha1}.jar`)
  if (!existsSync(jarFile)) console.log(`downloading ${VERSION} client.jar`)
  await downloadVerified(version.downloads.client, jarFile)

  // Items that are expected to differ, with the reason
  const known: Record<string, string> = JSON.parse(await readFile(join(__dirname, `${VERSION}.known.json`), 'utf8'))
  const renderer = new ItemRenderer(await JarAssets.open(jarFile))
  const golden = (await readdir(GOLDEN_DIR)).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5))

  const regressions: string[] = []
  const fixed: string[] = []
  let exact = 0
  let near = 0

  for (const item of golden) {
    const { image } = await renderer.render(item)
    const result = image
      ? compare(premultiply(await rgba(image, true)), await rgba(join(GOLDEN_DIR, `${item}.webp`)))
      : { alphaMismatch: Infinity, areaMismatch: Infinity, meanDiff: Infinity }
    const ok = result.areaMismatch === 0 && result.meanDiff <= MAX_MEAN_DIFF
    if (ok && result.alphaMismatch === 0) exact++
    else if (ok) near++
    if (!ok && !known[item]) regressions.push(`${item}: alpha=${result.alphaMismatch} area=${result.areaMismatch} diff=${result.meanDiff.toFixed(2)}`)
    if (ok && known[item]) fixed.push(item)
  }

  console.log(`${exact} exact, ${near} within edge tolerance, ${golden.length - exact - near} differ of ${golden.length}`)
  if (fixed.length) console.log(`now matching, remove from ${VERSION}.known.json: ${fixed.join(', ')}`)
  assert.deepEqual(regressions, [], 'icons differ from in-game screenshots')
})
