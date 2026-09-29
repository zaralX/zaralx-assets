import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { blobFile, BlobWriter, collectGarbage } from '../catalog/blobs'
import { jarCacheDir, VERSION_FILES, versionDir, versionsIndexFile } from '../catalog/paths'
import { DATA_FORMAT, ICON_SIZES, type ItemEntry, type LangIndex, type TextureEntry, type VersionIndex, type VersionMeta, type VersionSummary } from '../catalog/types'
import { assetObjectUrl, downloadVerified, fetchJson, type AssetIndex, type ManifestVersion, type VersionJson } from '../mojang'
import { downloadFile } from '../utils/download'
import { extractBlocks } from './extract/blocks'
import { creativeTabs } from './extract/creative-tabs'
import { extractTextures } from './extract/textures'
import { JarAssets } from './jar'
import { ItemRenderer } from './render'
import type { RenderPart } from './render/item-model'
import type { Logger } from './logger'

// Bump to make sync rebuild existing versions
export const PIPELINE_VERSION = 4

const ITEMS = 'assets/minecraft/items/'
const BLOCKSTATES = 'assets/minecraft/blockstates/'
const EN_US = 'assets/minecraft/lang/en_us.json'

export class UnsupportedVersionError extends Error {}

function spritePath(sprite: string) {
  return sprite.startsWith('minecraft:') ? sprite.slice(10) : sprite
}

async function writeJson(file: string, data: unknown) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data))
}

async function readJson<T>(file: string) {
  return JSON.parse(await readFile(file, 'utf8')) as T
}

function partTextures(renderer: ItemRenderer, parts: RenderPart[]) {
  const sprites = new Set<string>()
  for (const part of parts) {
    const model = renderer.models.get(part.kind === 'model' ? part.model : part.base)
    for (const [key, ref] of Object.entries(model.textures)) {
      if (key === 'particle') continue
      const texture = renderer.models.texture(model, typeof ref === 'string' ? ref : ref.sprite)
      if (texture) sprites.add(spritePath(texture.sprite))
    }
  }
  return [...sprites].sort()
}

export interface BuildOptions {
  dataDir: string
  manifest: ManifestVersion[]
  keepJar: boolean
  // Languages stored with the build instead of being downloaded on first request
  prefetchLangs: string[]
  log: Logger
}

export async function buildVersion(version: ManifestVersion, { dataDir, manifest, keepJar, prefetchLangs, log }: BuildOptions) {
  const started = Date.now()
  const json = await fetchJson<VersionJson>(version.url)

  const jarFile = join(jarCacheDir(dataDir), `${json.downloads.client.sha1}.jar`)
  log.info(`${version.id}: downloading client.jar`)
  await downloadVerified(json.downloads.client, jarFile, { log: message => log.warn(`${version.id}: ${message}`) })
  const assets = await JarAssets.open(jarFile)
  if (assets.list(ITEMS, '.json').length === 0) {
    throw new UnsupportedVersionError(`${version.id} has no item model definitions (added in 1.21.4)`)
  }

  const blobs = new BlobWriter(dataDir)
  const outDir = `${versionDir(dataDir, version.id)}.building`
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  log.info(`${version.id}: extracting textures`)
  const textures = await extractTextures(assets, blobs)

  const langIndex: LangIndex = {}
  const assetIndex = await fetchJson<AssetIndex>(json.assetIndex.url)
  for (const [key, object] of Object.entries(assetIndex.objects)) {
    const match = /^minecraft\/lang\/([a-z0-9_]+)\.json$/.exec(key)
    if (match) langIndex[match[1]] = object
  }
  const enUs = assets.read(EN_US) ?? Buffer.from('{}')
  langIndex.en_us = { hash: await blobs.put(enUs, 'json'), size: enUs.length }
  for (const code of prefetchLangs) {
    const object = langIndex[code]
    if (object) await downloadFile(assetObjectUrl(object.hash), blobFile(dataDir, object.hash, 'json'), { sha1: object.hash })
  }
  const lang = JSON.parse(enUs.toString('utf8')) as Record<string, string>

  log.info(`${version.id}: rendering item icons`)
  const renderer = new ItemRenderer(assets)
  const blockIds = new Set(assets.list(BLOCKSTATES, '.json').map(f => f.slice(BLOCKSTATES.length, -5)))
  const items: ItemEntry[] = []
  const missingIcons: Record<string, string> = {}

  for (const file of assets.list(ITEMS, '.json')) {
    const id = file.slice(ITEMS.length, -5)
    const icons: ItemEntry['icons'] = {}
    let parts: RenderPart[] = []
    try {
      for (const size of ICON_SIZES) {
        const result = await renderer.render(id, size)
        parts = result.parts
        if (result.unsupported.length) {
          missingIcons[id] = `special renderer: ${result.unsupported.map(m => m.type).join(', ')}`
          break
        }
        if (!result.image) {
          missingIcons[id] = 'nothing to draw'
          break
        }
        const webp = await sharp(result.image, { raw: { width: size, height: size, channels: 4 } })
          .webp({ lossless: true, effort: 6 })
          .toBuffer()
        icons[size] = await blobs.put(webp, 'webp')
      }
    }
    catch (err) {
      missingIcons[id] = (err as Error).message
      log.warn(`${version.id}: ${id}: ${(err as Error).message}`)
    }

    const itemKey = `item.minecraft.${id}`
    const block = blockIds.has(id)
    items.push({
      id,
      translationKey: lang[itemKey] !== undefined || !block ? itemKey : `block.minecraft.${id}`,
      block,
      icons: missingIcons[id] ? {} : icons,
      textures: parts.length ? partTextures(renderer, parts) : [],
    })
  }

  log.info(`${version.id}: extracting blocks`)
  const blocks = extractBlocks(assets, renderer.models, new Set(items.map(i => i.id))).map(block => ({
    ...block,
    particle: block.particle && spritePath(block.particle),
    faces: Object.fromEntries(Object.entries(block.faces).map(([side, sprite]) => [side, spritePath(sprite)])),
    textures: block.textures.map(spritePath),
  }))

  const summary: VersionSummary = {
    id: version.id,
    type: version.type,
    releaseTime: version.releaseTime,
    builtAt: new Date().toISOString(),
    pipeline: PIPELINE_VERSION,
    items: items.length,
    blocks: blocks.length,
    textures: textures.length,
  }
  const meta: VersionMeta = {
    ...summary,
    assetIndex: { id: json.assetIndex.id, url: json.assetIndex.url, sha1: json.assetIndex.sha1 },
    client: { url: json.downloads.client.url, sha1: json.downloads.client.sha1 },
    missingIcons,
  }
  await writeJson(join(outDir, VERSION_FILES.items), items)
  await writeJson(join(outDir, VERSION_FILES.blocks), blocks)
  await writeJson(join(outDir, VERSION_FILES.textures), textures)
  await writeJson(join(outDir, VERSION_FILES.langIndex), langIndex)
  await writeJson(join(outDir, VERSION_FILES.creativeTabs), await creativeTabs(version, manifest, items.map(i => i.id)))
  await writeJson(join(outDir, VERSION_FILES.meta), meta)

  await installVersion(dataDir, version.id, outDir)
  await recordVersions(dataDir, [summary])
  if (!keepJar) await rm(jarFile, { force: true })

  const rendered = items.filter(i => i.icons[256]).length
  log.info(`${version.id}: done in ${((Date.now() - started) / 1000).toFixed(1)}s, ${rendered}/${items.length} icons, `
    + `${blocks.length} blocks, ${textures.length} textures, ${blobs.written} new blobs, ${blobs.reused} reused`)
  return meta
}

export async function readIndex(dataDir: string): Promise<VersionIndex> {
  try {
    return await readJson<VersionIndex>(versionsIndexFile(dataDir))
  }
  catch {
    return { updatedAt: new Date(0).toISOString(), versions: [] }
  }
}

// Two renames, so the API never sees a half-written version
export async function installVersion(dataDir: string, id: string, builtDir: string) {
  const finalDir = versionDir(dataDir, id)
  const oldDir = `${finalDir}.old`
  await rm(oldDir, { recursive: true, force: true })
  await rename(finalDir, oldDir).catch(() => undefined)
  await rename(builtDir, finalDir)
  await rm(oldDir, { recursive: true, force: true })
}

export async function recordVersions(dataDir: string, summaries: VersionSummary[]) {
  const index = await readIndex(dataDir)
  const ids = new Set(summaries.map(v => v.id))
  index.versions = [...summaries, ...index.versions.filter(v => !ids.has(v.id))]
    .sort((a, b) => b.releaseTime.localeCompare(a.releaseTime))
  index.updatedAt = new Date().toISOString()
  const file = versionsIndexFile(dataDir)
  await writeJson(`${file}.tmp`, index)
  await rename(`${file}.tmp`, file)
}

export async function referencedBlobs(dataDir: string) {
  const referenced = new Set<string>()
  // Throws if a manifest is unreadable, so nothing is deleted then
  for (const { id, pipeline } of (await readIndex(dataDir)).versions) {
    if (pipeline < DATA_FORMAT) continue
    const dir = versionDir(dataDir, id)
    for (const item of await readJson<ItemEntry[]>(join(dir, VERSION_FILES.items))) {
      for (const hash of Object.values(item.icons)) referenced.add(hash)
    }
    for (const texture of await readJson<TextureEntry[]>(join(dir, VERSION_FILES.textures))) {
      referenced.add(texture.hash)
      if (texture.mcmeta) referenced.add(texture.mcmeta)
    }
    for (const { hash } of Object.values(await readJson<LangIndex>(join(dir, VERSION_FILES.langIndex)))) referenced.add(hash)
  }
  return referenced
}

export async function removeUnusedBlobs(dataDir: string) {
  return collectGarbage(dataDir, await referencedBlobs(dataDir))
}
