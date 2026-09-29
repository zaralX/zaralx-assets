import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { assetObjectUrl, fetchBuffer, sha1 } from '../mojang'
import { iconFile, langFile, textureFile, VERSION_FILES, versionDir, versionsIndexFile } from './paths'
import type { BlockEntry, CreativeTabs, ItemEntry, LangIndex, TextureEntry, VersionIndex, VersionMeta, VersionSummary } from './types'

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

// Read side of the pipeline output; picks up newly built versions without a restart
export class Catalog {
  private index: VersionIndex = { updatedAt: '', versions: [] }
  private indexMtime = 0
  private indexCheckedAt = 0
  private readonly data = new Map<string, Promise<VersionData>>()
  private readonly langs = new Map<string, Promise<Record<string, string>>>()

  constructor(readonly dataDir: string) {}

  async versions() {
    await this.refreshIndex()
    return this.index.versions
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

  dir(version: string) {
    return versionDir(this.dataDir, version)
  }

  iconFile(version: string, item: string, size: number) {
    return iconFile(this.dir(version), item, size)
  }

  textureFile(version: string, path: string) {
    return textureFile(this.dir(version), path)
  }

  // Languages other than en_us are fetched from Mojang on first use and kept next to the build
  lang(version: VersionData, code: string) {
    const key = `${version.meta.id}/${code}`
    let pending = this.langs.get(key)
    if (!pending) {
      pending = this.readLang(version, code)
      pending.catch(() => this.langs.delete(key))
      this.langs.set(key, pending)
    }
    return pending
  }

  private async readLang(version: VersionData, code: string) {
    const file = langFile(this.dir(version.meta.id), code)
    try {
      return JSON.parse(await readFile(file, 'utf8')) as Record<string, string>
    }
    catch {
      // not downloaded yet
    }
    const object = version.langIndex[code]
    if (!object) throw new Error(`Unknown language ${code}`)
    const data = await fetchBuffer(assetObjectUrl(object.hash))
    if (sha1(data) !== object.hash) throw new Error(`sha1 mismatch for language ${code}`)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(`${file}.tmp`, data)
    await rename(`${file}.tmp`, file)
    return JSON.parse(data.toString('utf8')) as Record<string, string>
  }

  private async read(id: string): Promise<VersionData> {
    const dir = this.dir(id)
    const json = async <T>(name: string) => JSON.parse(await readFile(join(dir, name), 'utf8')) as T
    const [meta, items, blocks, textures, creativeTabs, langIndex] = await Promise.all([
      json<VersionMeta>(VERSION_FILES.meta),
      json<ItemEntry[]>(VERSION_FILES.items),
      json<BlockEntry[]>(VERSION_FILES.blocks),
      json<TextureEntry[]>(VERSION_FILES.textures),
      json<CreativeTabs>(VERSION_FILES.creativeTabs),
      json<LangIndex>(VERSION_FILES.langIndex),
    ])
    langIndex.en_us ??= { hash: '', size: 0 }
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
