import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

export interface DownloadOptions {
  sha1?: string
  attempts?: number
  // Abort when no data arrives for this long
  stallMs?: number
  log?: (message: string) => void
}

async function fileSha1(file: string) {
  const hash = createHash('sha1')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

async function size(file: string) {
  return stat(file).then(s => s.size, () => 0)
}

// Streams to disk and resumes with Range after a dropped connection
export async function downloadFile(url: string, file: string, { sha1, attempts = 8, stallMs = 60_000, log }: DownloadOptions = {}) {
  if (sha1 && await size(file) && await fileSha1(file) === sha1) return

  await mkdir(dirname(file), { recursive: true })
  const partial = `${file}.part`
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    let timer = setTimeout(() => controller.abort(new Error(`no data for ${stallMs / 1000}s`)), stallMs)
    const offset = await size(partial)
    try {
      const res = await fetch(url, { headers: offset ? { Range: `bytes=${offset}-` } : {}, signal: controller.signal })
      if (!res.ok || !res.body) throw new Error(`GET ${url} -> ${res.status}`)
      const append = offset > 0 && res.status === 206
      const out = createWriteStream(partial, { flags: append ? 'a' : 'w' })
      for await (const chunk of res.body) {
        clearTimeout(timer)
        timer = setTimeout(() => controller.abort(new Error(`no data for ${stallMs / 1000}s`)), stallMs)
        if (!out.write(chunk)) await once(out, 'drain')
      }
      out.end()
      await once(out, 'finish')
      clearTimeout(timer)

      if (sha1 && await fileSha1(partial) !== sha1) {
        await rm(partial, { force: true })
        throw new Error(`sha1 mismatch for ${url}`)
      }
      await rename(partial, file)
      return
    }
    catch (err) {
      clearTimeout(timer)
      lastError = err
      const reason = err instanceof Error ? (err.cause instanceof Error ? `${err.message}: ${err.cause.message}` : err.message) : String(err)
      log?.(`download attempt ${attempt}/${attempts} failed (${reason}), ${await size(partial)} bytes kept`)
      if (attempt < attempts) await sleep(Math.min(60_000, 2_000 * 2 ** (attempt - 1)))
    }
  }
  throw lastError
}
