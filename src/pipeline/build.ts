import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { iconFile, jarCacheDir, VERSION_FILES, versionDir, versionsIndexFile } from '../catalog/paths'
import { ICON_SIZES, type ItemEntry, type LangIndex, type VersionIndex, type VersionMeta, type VersionSummary } from '../catalog/types'
import { downloadVerified, fetchJson, type AssetIndex, type ManifestVersion, type VersionJson } from '../mojang'
import { extractBlocks } from './extract/blocks'
import { creativeTabs } from './extract/creative-tabs'
import { extractTextures } from './extract/textures'
import { JarAssets } from './jar'
import { ItemRenderer } from './render'
import type { RenderPart } from './render/item-model'
import type { Logger } from './logger'

// Bump to make sync rebuild existing versions
export const PIPELINE_VERSION = 3

const ITEMS = 'assets/minecraft/items/'
const BLOCKSTATES = 'assets/minecraft/blockstates/'

export class UnsupportedVersionError extends Error {}

function spritePath(sprite: string) {
  return sprite.startsWith('minecraft:') ? sprite.slice(10) : sprite
}

async function writeJson(file: string, data: unknown) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data))
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
  log: Logger
}

export async function buildVersion(version: ManifestVersion, { dataDir, manifest, keepJar, log }: BuildOptions) {
  const started = Date.now()
  const json = await fetchJson<VersionJson>(version.url)

  const jarFile = join(jarCacheDir(dataDir), `${json.downloads.client.sha1}.jar`)
  log.info(`${version.id}: downloading client.jar`)
  await downloadVerified(json.downloads.client, jarFile)
  const assets = await JarAssets.open(jarFile)
  if (assets.list(ITEMS, '.json').length === 0) {
    throw new UnsupportedVersionError(`${version.id} has no item model definitions (added in 1.21.4)`)
  }

  const finalDir = versionDir(dataDir, version.id)
  const outDir = `${finalDir}.building`
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  log.info(`${version.id}: extracting textures`)
  const textures = await extractTextures(assets, outDir)

  const lang = assets.json<Record<string, string>>('assets/minecraft/lang/en_us.json') ?? {}
  await writeJson(join(outDir, 'lang', 'en_us.json'), lang)
  const assetIndex = await fetchJson<AssetIndex>(json.assetIndex.url)
  const langIndex: LangIndex = {}
  for (const [key, object] of Object.entries(assetIndex.objects)) {
    const match = /^minecraft\/lang\/([a-z0-9_]+)\.json$/.exec(key)
    if (match) langIndex[match[1]] = object
  }
  await writeJson(join(outDir, VERSION_FILES.langIndex), langIndex)

  log.info(`${version.id}: rendering item icons`)
  const renderer = new ItemRenderer(assets)
  const blockIds = new Set(assets.list(BLOCKSTATES, '.json').map(f => f.slice(BLOCKSTATES.length, -5)))
  const items: ItemEntry[] = []
  const missingIcons: Record<string, string> = {}
  for (const size of ICON_SIZES) await mkdir(dirname(iconFile(outDir, 'x', size)), { recursive: true })

  for (const file of assets.list(ITEMS, '.json')) {
    const id = file.slice(ITEMS.length, -5)
    let icon = false
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
        await sharp(result.image, { raw: { width: size, height: size, channels: 4 } })
          .webp({ lossless: true, effort: 6 })
          .toFile(iconFile(outDir, id, size))
        icon = true
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
      icon,
      textures: parts.length ? partTextures(renderer, parts) : [],
    })
  }
  await writeJson(join(outDir, VERSION_FILES.items), items)

  log.info(`${version.id}: extracting blocks`)
  const blocks = extractBlocks(assets, renderer.models, new Set(items.map(i => i.id))).map(block => ({
    ...block,
    particle: block.particle && spritePath(block.particle),
    faces: Object.fromEntries(Object.entries(block.faces).map(([side, sprite]) => [side, spritePath(sprite)])),
    textures: block.textures.map(spritePath),
  }))
  await writeJson(join(outDir, VERSION_FILES.blocks), blocks)
  await writeJson(join(outDir, VERSION_FILES.textures), textures)
  await writeJson(join(outDir, VERSION_FILES.creativeTabs), await creativeTabs(version, manifest, items.map(i => i.id)))

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
  await writeJson(join(outDir, VERSION_FILES.meta), meta)

  const oldDir = `${finalDir}.old`
  await rm(oldDir, { recursive: true, force: true })
  await rename(finalDir, oldDir).catch(() => undefined)
  await rename(outDir, finalDir)
  await rm(oldDir, { recursive: true, force: true })
  await updateIndex(dataDir, summary)
  if (!keepJar) await rm(jarFile, { force: true })

  const rendered = items.filter(i => i.icon).length
  log.info(`${version.id}: done in ${((Date.now() - started) / 1000).toFixed(1)}s, ${rendered}/${items.length} icons, ${blocks.length} blocks, ${textures.length} textures`)
  return meta
}

export async function readIndex(dataDir: string): Promise<VersionIndex> {
  try {
    return JSON.parse(await readFile(versionsIndexFile(dataDir), 'utf8'))
  }
  catch {
    return { updatedAt: new Date(0).toISOString(), versions: [] }
  }
}

async function updateIndex(dataDir: string, summary: VersionSummary) {
  const index = await readIndex(dataDir)
  index.versions = [summary, ...index.versions.filter(v => v.id !== summary.id)]
    .sort((a, b) => b.releaseTime.localeCompare(a.releaseTime))
  index.updatedAt = new Date().toISOString()
  const file = versionsIndexFile(dataDir)
  await writeJson(`${file}.tmp`, index)
  await rename(`${file}.tmp`, file)
}
