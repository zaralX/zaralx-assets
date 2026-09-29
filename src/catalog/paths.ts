import { join } from 'node:path'

export function versionsIndexFile(dataDir: string) {
  return join(dataDir, 'versions.json')
}

export function versionDir(dataDir: string, version: string) {
  return join(dataDir, 'versions', version)
}

export function jarCacheDir(dataDir: string) {
  return join(dataDir, 'cache', 'jars')
}

export const VERSION_FILES = {
  meta: 'meta.json',
  items: 'items.json',
  blocks: 'blocks.json',
  textures: 'textures.json',
  creativeTabs: 'creative-tabs.json',
  langIndex: 'lang.json',
} as const

export const ID_PATTERN = /^[a-z0-9_][a-z0-9_.-]*$/
export const TEXTURE_PATH_PATTERN = /^[a-z0-9_][a-z0-9_.-]*(\/[a-z0-9_][a-z0-9_.-]*)*$/
export const LANG_PATTERN = /^[a-z]{2,4}(_[a-z]{2,4})?$/
