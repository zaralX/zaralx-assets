import { access, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { sha1 } from '../mojang'

export type BlobExtension = 'webp' | 'png' | 'mcmeta' | 'json'

export const BLOB_EXTENSIONS: BlobExtension[] = ['webp', 'png', 'mcmeta', 'json']

// sha1 like Mojang's asset index, so language files are stored under their asset hash
export const BLOB_HASH_PATTERN = /^[0-9a-f]{40}$/

export function blobsDir(dataDir: string) {
  return join(dataDir, 'blobs')
}

export function blobFile(dataDir: string, hash: string, extension: BlobExtension) {
  return join(blobsDir(dataDir), hash.slice(0, 2), `${hash}.${extension}`)
}

export async function writeBlobFile(file: string, data: Buffer) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, data)
  await rename(tmp, file)
}

export class BlobWriter {
  written = 0
  reused = 0
  private readonly known = new Set<string>()

  constructor(private readonly dataDir: string) {}

  async put(data: Buffer, extension: BlobExtension) {
    const hash = sha1(data)
    const file = blobFile(this.dataDir, hash, extension)
    if (this.known.has(file)) {
      this.reused++
      return hash
    }
    try {
      await access(file)
      this.reused++
    }
    catch {
      await writeBlobFile(file, data)
      this.written++
    }
    this.known.add(file)
    return hash
  }
}

export async function readBlob(dataDir: string, hash: string, extension: BlobExtension) {
  return readFile(blobFile(dataDir, hash, extension))
}

// Deletes blobs no version refers to; recent ones may belong to a build in progress
export async function collectGarbage(dataDir: string, referenced: Set<string>, graceMs = 60 * 60_000) {
  let removed = 0
  let kept = 0
  const root = blobsDir(dataDir)
  const prefixes = await readdir(root).catch(() => [] as string[])
  for (const prefix of prefixes) {
    for (const name of await readdir(join(root, prefix))) {
      const hash = name.split('.')[0]
      const file = join(root, prefix, name)
      if (referenced.has(hash) || Date.now() - (await stat(file)).mtimeMs < graceMs) {
        kept++
        continue
      }
      await unlink(file)
      removed++
    }
  }
  return { removed, kept }
}
