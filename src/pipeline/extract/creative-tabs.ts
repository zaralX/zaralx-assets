import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { UNCATEGORIZED, type CreativeTabs } from '../../catalog/types'
import type { ManifestVersion } from '../../mojang'

const TABS_DIR = join(__dirname, '..', '..', '..', 'resources', 'creative-tabs')

// Tabs are defined in code, so the newest hand-made snapshot not newer than the version is used
export async function creativeTabs(version: ManifestVersion, manifest: ManifestVersion[], items: string[]): Promise<CreativeTabs> {
  const releaseTime = new Map(manifest.map(v => [v.id, v.releaseTime]))
  const snapshots = (await readdir(TABS_DIR))
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -5))
    .filter(id => releaseTime.has(id))
    .sort((a, b) => releaseTime.get(a)!.localeCompare(releaseTime.get(b)!))

  const source = snapshots.filter(id => releaseTime.get(id)! <= version.releaseTime).at(-1) ?? snapshots[0]
  const tabs: CreativeTabs = source ? JSON.parse(await readFile(join(TABS_DIR, `${source}.json`), 'utf8')) : {}

  const available = new Set(items)
  const placed = new Set<string>()
  const result: CreativeTabs = {}
  for (const [tab, ids] of Object.entries(tabs)) {
    result[tab] = ids.filter(id => available.has(id))
    for (const id of result[tab]) placed.add(id)
  }
  result[UNCATEGORIZED] = items.filter(id => !placed.has(id) && id !== 'air')
  return result
}
