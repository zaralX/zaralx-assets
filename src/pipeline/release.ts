import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { unzipSync, zipSync, type Zippable } from 'fflate'
import { blobsDir, writeBlobFile } from '../catalog/blobs'
import { jarCacheDir, versionDir } from '../catalog/paths'
import { DATA_FORMAT, type VersionIndex, type VersionSummary } from '../catalog/types'
import { sha1 } from '../mojang'
import { downloadFile } from '../utils/download'
import { installVersion, PIPELINE_VERSION, readIndex, recordVersions, referencedBlobs } from './build'
import type { Logger } from './logger'

export const DATA_ARCHIVE = 'data.zip'
export const DATA_INDEX = 'index.json'

export interface ReleaseIndex {
  pipeline: number
  publishedAt: string
  sha1: string
  size: number
  versions: VersionSummary[]
}

export function releaseTag() {
  return `data-v${PIPELINE_VERSION}`
}

export function releaseBaseUrl(repo: string, override?: string) {
  return (override ?? `https://github.com/${repo}/releases/download/${releaseTag()}`).replace(/\/+$/, '')
}

// Writes data.zip with every built version and the blobs they use, plus index.json describing it
export async function packData(dataDir: string, outDir: string) {
  const index = await readIndex(dataDir)
  const versions = index.versions.filter(v => v.pipeline >= DATA_FORMAT)
  const files: Zippable = {
    'versions.json': [Buffer.from(JSON.stringify({ ...index, versions })), { level: 9 }],
  }
  for (const { id } of versions) {
    for (const name of await readdir(versionDir(dataDir, id))) {
      files[`versions/${id}/${name}`] = [await readFile(join(versionDir(dataDir, id), name)), { level: 9 }]
    }
  }

  const referenced = await referencedBlobs(dataDir)
  const root = blobsDir(dataDir)
  for (const prefix of await readdir(root).catch(() => [] as string[])) {
    for (const name of await readdir(join(root, prefix))) {
      if (!referenced.has(name.split('.')[0]) || name.endsWith('.tmp')) continue
      const compressible = name.endsWith('.json') || name.endsWith('.mcmeta')
      files[`blobs/${prefix}/${name}`] = [await readFile(join(root, prefix, name)), { level: compressible ? 9 : 0 }]
    }
  }

  const archive = Buffer.from(zipSync(files))
  const releaseIndex: ReleaseIndex = {
    pipeline: PIPELINE_VERSION,
    publishedAt: new Date().toISOString(),
    sha1: sha1(archive),
    size: archive.length,
    versions,
  }
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, DATA_ARCHIVE), archive)
  await writeFile(join(outDir, DATA_INDEX), JSON.stringify(releaseIndex))
  return releaseIndex
}

async function fetchReleaseIndex(baseUrl: string) {
  const res = await fetch(`${baseUrl}/${DATA_INDEX}`, { signal: AbortSignal.timeout(30_000) })
  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`${DATA_INDEX} -> ${res.status}`)
  return await res.json() as ReleaseIndex
}

export interface PullOptions {
  dataDir: string
  baseUrl: string
  log: Logger
  accept: (version: VersionSummary, all: VersionSummary[]) => boolean
}

// Imports versions that are missing locally or were rebuilt since; returns their ids
export async function pullRelease({ dataDir, baseUrl, log, accept }: PullOptions) {
  const remote = await fetchReleaseIndex(baseUrl)
  if (!remote) {
    log.info(`nothing published yet at ${baseUrl}`)
    return []
  }

  const local = new Map((await readIndex(dataDir)).versions.map(v => [v.id, v]))
  const wanted = remote.versions
    .filter(v => accept(v, remote.versions))
    .filter(v => local.get(v.id)?.builtAt !== v.builtAt)
    .map(v => v.id)
  if (!wanted.length) return []

  log.info(`downloading ${(remote.size / 1e6).toFixed(1)} MB of data for ${wanted.join(', ')}`)
  const archiveFile = join(jarCacheDir(dataDir), `data-${remote.sha1}.zip`)
  await downloadFile(`${baseUrl}/${DATA_ARCHIVE}`, archiveFile, { sha1: remote.sha1, log: message => log.warn(message) })
  const entries = unzipSync(await readFile(archiveFile))
  const archiveIndex = JSON.parse(Buffer.from(entries['versions.json']).toString('utf8')) as VersionIndex
  const summaries = new Map(archiveIndex.versions.map(v => [v.id, v]))

  let written = 0
  for (const [path, data] of Object.entries(entries)) {
    if (!path.startsWith('blobs/') || path.endsWith('/')) continue
    const file = join(dataDir, path)
    if (await access(file).then(() => true, () => false)) continue
    await writeBlobFile(file, Buffer.from(data))
    written++
  }

  const imported: VersionSummary[] = []
  for (const id of wanted) {
    const summary = summaries.get(id)
    if (!summary) continue
    const building = `${versionDir(dataDir, id)}.building`
    await rm(building, { recursive: true, force: true })
    for (const [path, data] of Object.entries(entries)) {
      if (!path.startsWith(`versions/${id}/`) || path.endsWith('/')) continue
      const file = join(building, path.slice(`versions/${id}/`.length))
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, data)
    }
    await installVersion(dataDir, id, building)
    imported.push(summary)
  }
  await recordVersions(dataDir, imported)
  await rm(archiveFile, { force: true })
  log.info(`imported ${imported.map(v => v.id).join(', ')}, ${written} new blobs`)
  return imported.map(v => v.id)
}
