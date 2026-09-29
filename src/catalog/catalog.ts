import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { assetObjectUrl, fetchBuffer, sha1 } from '../mojang'
import { blobFile, writeBlobFile } from './blobs'
import { VERSION_FILES, versionDir, versionsIndexFile } from './paths'
import { DATA_FORMAT, type BlockEntry, type CreativeTabs, type IconSize, type ItemEntry, type LangIndex, type TextureEntry, type VersionIndex, type VersionMeta, type VersionSummary } from './types'

export const LATEST = 'latest'
export const LATEST_SNAPSHOT = 'latest-snapshot'

export interface VersionData {
  meta: VersionMeta
  items: Map<string, ItemEntry>
  blocks: Map<string, BlockEntry>
  textures: Map<string, TextureEntry>
  creativeTabs: CreativeTabs
  itemTabs: Map<string, string>
  langIndex: LangIndex
}

const INDEX_CHECK_INTERVAL = 30_000

export class Catalog {
  private index: VersionIndex = { updatedAt: '', versions: [] }
  private indexMtime = 0
  private indexCheckedAt = 0
  private readonly data = new Map<string, Promise<VersionData>>()
  private readonly langs = new Map<string, Promise<Record<string, string>>>()

  constructor(readonly dataDir: string) {}

  async versions() {
    await this.refreshIndex()
    return this.index.versions.filter(v => v.pipeline >= DATA_FORMAT)
  }

  async resolve(version: string): Promise<VersionSummary | undefined> {
    const versions = await this.versions()
    if (version === LATEST) return versions.find(v => v.type === 'release')
    if (version === LATEST_SNAPSHOT) return versions[0]
    return versions.find(v => v.id === version)
  }

  load(version: VersionSummary) {
    const key = `${version.id}@${version.builtAt}`
    let pending = this.data.get(key)
    if (!pending) {
      for (const k of this.data.keys()) if (k.startsWith(`${version.id}@`)) this.data.delete(k)
      pending = this.read(version.id)
      pending.catch(() => this.data.delete(key))
      this.data.set(key, pending)
    }
    return pending
  }

  iconFile(item: ItemEntry, size: IconSize) {
    const hash = item.icons[size]
    return hash ? blobFile(this.dataDir, hash, 'webp') : undefined
  }

  textureFile(texture: TextureEntry) {
    return blobFile(this.dataDir, texture.hash, 'png')
  }

  // Languages other than en_us are downloaded on first use; versions share identical files
  lang(version: VersionData, code: string) {
    const object = version.langIndex[code]
    if (!object) return Promise.reject(new Error(`Unknown language ${code}`))
    let pending = this.langs.get(object.hash)
    if (!pending) {
      pending = this.readLang(object.hash)
      pending.catch(() => this.langs.delete(object.hash))
      this.langs.set(object.hash, pending)
    }
    return pending
  }

  private async readLang(hash: string) {
    const file = blobFile(this.dataDir, hash, 'json')
    let data: Buffer
    try {
      data = await readFile(file)
    }
    catch {
      data = await fetchBuffer(assetObjectUrl(hash))
      if (sha1(data) !== hash) throw new Error(`sha1 mismatch for language ${hash}`)
      await writeBlobFile(file, data)
    }
    return JSON.parse(data.toString('utf8')) as Record<string, string>
  }

  private async read(id: string): Promise<VersionData> {
    const dir = versionDir(this.dataDir, id)
    const json = async <T>(name: string) => JSON.parse(await readFile(join(dir, name), 'utf8')) as T
    const [meta, items, blocks, textures, creativeTabs, langIndex] = await Promise.all([
      json<VersionMeta>(VERSION_FILES.meta),
      json<ItemEntry[]>(VERSION_FILES.items),
      json<BlockEntry[]>(VERSION_FILES.blocks),
      json<TextureEntry[]>(VERSION_FILES.textures),
      json<CreativeTabs>(VERSION_FILES.creativeTabs),
      json<LangIndex>(VERSION_FILES.langIndex),
    ])
    const itemTabs = new Map<string, string>()
    for (const [tab, ids] of Object.entries(creativeTabs)) {
      for (const id of ids) if (!itemTabs.has(id)) itemTabs.set(id, tab)
    }
    return {
      meta,
      items: new Map(items.map(i => [i.id, i])),
      blocks: new Map(blocks.map(b => [b.id, b])),
      textures: new Map(textures.map(t => [t.path, t])),
      creativeTabs,
      itemTabs,
      langIndex,
    }
  }

  private async refreshIndex() {
    const now = Date.now()
    if (now - this.indexCheckedAt < INDEX_CHECK_INTERVAL && this.indexMtime) return
    this.indexCheckedAt = now
    const file = versionsIndexFile(this.dataDir)
    try {
      const { mtimeMs } = await stat(file)
      if (mtimeMs === this.indexMtime) return
      this.index = JSON.parse(await readFile(file, 'utf8'))
      this.indexMtime = mtimeMs
    }
    catch {
      // nothing built yet
    }
  }
}
