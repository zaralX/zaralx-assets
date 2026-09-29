import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { test } from 'node:test'
import { BlobWriter } from '../../src/catalog/blobs'
import { DATA_FORMAT, type VersionIndex } from '../../src/catalog/types'
import { readIndex } from '../../src/pipeline/build'
import { packData, pullRelease } from '../../src/pipeline/release'

const quiet = { info() {}, warn() {}, error() {} }

async function fakeBuild(dataDir: string) {
  const blobs = new BlobWriter(dataDir)
  const icon = await blobs.put(Buffer.from('icon'), 'webp')
  const texture = await blobs.put(Buffer.from('texture'), 'png')
  const lang = await blobs.put(Buffer.from('{}'), 'json')
  const dir = join(dataDir, 'versions', '26.3')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'items.json'), JSON.stringify([{ id: 'stone', icons: { 256: icon } }]))
  await writeFile(join(dir, 'textures.json'), JSON.stringify([{ path: 'block/stone', hash: texture }]))
  await writeFile(join(dir, 'lang.json'), JSON.stringify({ en_us: { hash: lang, size: 2 } }))
  const index: VersionIndex = {
    updatedAt: new Date().toISOString(),
    versions: [{ id: '26.3', type: 'release', releaseTime: '2026-09-15T00:00:00Z', builtAt: '2026-09-29T00:00:00Z', pipeline: DATA_FORMAT, items: 1, blocks: 0, textures: 1 }],
  }
  await writeFile(join(dataDir, 'versions.json'), JSON.stringify(index))
  return { icon, texture }
}

test('a packed release is imported into an empty data dir, resuming a dropped download', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-'))
  let dropped = false
  const server = createServer(async (req, res) => {
    const file = join(root, 'out', basename(req.url ?? ''))
    const size = await stat(file).then(s => s.size, () => -1)
    if (size < 0) return res.writeHead(404).end()
    const start = Number(/bytes=(\d+)-/.exec(req.headers.range ?? '')?.[1] ?? 0)
    res.writeHead(start ? 206 : 200, { 'Content-Length': size - start })
    if (!dropped && file.endsWith('.zip')) {
      dropped = true
      const half = (await readFile(file)).subarray(0, Math.floor(size / 2))
      res.write(half, () => req.socket.destroy())
      return
    }
    createReadStream(file, { start }).pipe(res)
  })
  try {
    const { icon, texture } = await fakeBuild(join(root, 'source'))
    await packData(join(root, 'source'), join(root, 'out'))
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    const target = join(root, 'target')
    const pull = () => pullRelease({ dataDir: target, baseUrl, log: quiet, accept: () => true })
    assert.deepEqual(await pull(), ['26.3'])
    assert.ok(dropped)
    assert.equal((await readIndex(target)).versions[0].id, '26.3')
    assert.equal(await readFile(join(target, 'blobs', icon.slice(0, 2), `${icon}.webp`), 'utf8'), 'icon')
    assert.equal(await readFile(join(target, 'blobs', texture.slice(0, 2), `${texture}.png`), 'utf8'), 'texture')
    assert.deepEqual(await pull(), [])
  }
  finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
})
