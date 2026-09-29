import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { blobFile, BlobWriter, collectGarbage, readBlob } from '../../src/catalog/blobs'

test('identical content is stored once and unreferenced blobs are collected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'blobs-'))
  try {
    const writer = new BlobWriter(dir)
    const a = await writer.put(Buffer.from('stone'), 'png')
    const again = await new BlobWriter(dir).put(Buffer.from('stone'), 'png')
    const b = await writer.put(Buffer.from('dirt'), 'png')
    assert.equal(a, again)
    assert.equal(writer.written, 2)
    assert.equal((await readBlob(dir, a, 'png')).toString(), 'stone')

    const old = new Date(Date.now() - 2 * 60 * 60_000)
    await utimes(blobFile(dir, b, 'png'), old, old)
    const result = await collectGarbage(dir, new Set([a]))
    assert.deepEqual(result, { removed: 1, kept: 1 })
    assert.deepEqual(await readdir(join(dir, 'blobs', a.slice(0, 2))), [`${a}.png`])
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})
