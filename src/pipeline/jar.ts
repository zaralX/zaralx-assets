import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

export class JarAssets {
  private constructor(private readonly files: Map<string, Uint8Array>) {}

  static async open(file: string, prefix = 'assets/') {
    const entries = unzipSync(await readFile(file), { filter: entry => entry.name.startsWith(prefix) })
    return new JarAssets(new Map(Object.entries(entries)))
  }

  has(path: string) {
    return this.files.has(path)
  }

  read(path: string) {
    const data = this.files.get(path)
    return data ? Buffer.from(data.buffer, data.byteOffset, data.byteLength) : undefined
  }

  json<T>(path: string): T | undefined {
    const data = this.read(path)
    return data ? JSON.parse(data.toString('utf8')) as T : undefined
  }

  list(prefix: string, suffix = '') {
    const result: string[] = []
    for (const path of this.files.keys()) {
      if (path.startsWith(prefix) && path.endsWith(suffix) && !path.endsWith('/')) result.push(path)
    }
    return result.sort()
  }
}

export function splitId(id: string) {
  const i = id.indexOf(':')
  return i === -1 ? { namespace: 'minecraft', path: id } : { namespace: id.slice(0, i), path: id.slice(i + 1) }
}

export function normalizeId(id: string) {
  const { namespace, path } = splitId(id)
  return `${namespace}:${path}`
}

export function assetPath(kind: string, id: string, ext: string) {
  const { namespace, path } = splitId(id)
  return `assets/${namespace}/${kind}/${path}${ext}`
}
