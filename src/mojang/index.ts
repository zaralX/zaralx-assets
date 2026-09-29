import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { downloadFile, type DownloadOptions } from '../utils/download'

export const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
export const RESOURCES_URL = 'https://resources.download.minecraft.net'

export type VersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha'

export interface ManifestVersion {
  id: string
  type: VersionType
  url: string
  time: string
  releaseTime: string
  sha1: string
}

export interface VersionManifest {
  latest: { release: string, snapshot: string }
  versions: ManifestVersion[]
}

export interface Download {
  url: string
  sha1: string
  size: number
}

export interface VersionJson {
  id: string
  type: VersionType
  releaseTime: string
  assetIndex: Download & { id: string }
  downloads: { client: Download, server?: Download }
  javaVersion?: { majorVersion: number }
}

export interface AssetIndex {
  objects: Record<string, { hash: string, size: number }>
}

const TIMEOUT = 30_000

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return await res.json() as T
}

export async function fetchBuffer(url: string, timeout = TIMEOUT) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export function sha1(data: Buffer) {
  return createHash('sha1').update(data).digest('hex')
}

export function assetObjectUrl(hash: string) {
  return `${RESOURCES_URL}/${hash.slice(0, 2)}/${hash}`
}

export function fetchManifest() {
  return fetchJson<VersionManifest>(VERSION_MANIFEST_URL)
}

export async function downloadVerified(download: Pick<Download, 'url' | 'sha1'>, file: string, options: Omit<DownloadOptions, 'sha1'> = {}) {
  await downloadFile(download.url, file, { ...options, sha1: download.sha1 })
  return readFile(file)
}
