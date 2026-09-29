import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { config } from '../config'
import { jarCacheDir } from '../catalog/paths'
import type { VersionSummary } from '../catalog/types'
import { downloadVerified, fetchJson, fetchManifest, type ManifestVersion, type VersionJson } from '../mojang'
import { buildVersion, PIPELINE_VERSION, readIndex, removeUnusedBlobs, UnsupportedVersionError } from './build'
import { JarAssets } from './jar'
import { ItemRenderer } from './render'
import { consoleLogger as log } from './logger'
import { packData, pullRelease, releaseBaseUrl, releaseTag } from './release'

const USAGE = `Usage: pipeline <command>

  watch                    keep versions up to date, from GitHub or by building (PIPELINE_SOURCE)
  pull                     import versions published on GitHub
  sync [--force]           build every eligible version that is missing or outdated
  build <version...>       build the given versions, even if not eligible
  list                     versions eligible for building and their state
  pack <dir>               write data.zip and index.json for publishing
  release-tag              print the GitHub release tag of this pipeline version
  gc                       delete blobs no version refers to
  render <version> <item> [--size 256] [--out file.png]
                           render one icon, for debugging`

type Version = Pick<ManifestVersion, 'id' | 'type' | 'releaseTime'>

function eligible<T extends Version>(versions: T[]) {
  const min = versions.find(v => v.id === config.pipeline.minVersion)
  if (!min) throw new Error(`PIPELINE_MIN_VERSION ${config.pipeline.minVersion} is not in the version list`)
  return versions.filter(v => config.pipeline.types.includes(v.type) && v.releaseTime >= min.releaseTime)
}

async function pending(force: boolean) {
  const manifest = await fetchManifest()
  const index = await readIndex(config.dataDir)
  const built = new Map(index.versions.map(v => [v.id, v]))
  const targets = eligible(manifest.versions).filter((v) => {
    const current = built.get(v.id)
    return force || !current || current.pipeline < PIPELINE_VERSION
  })
  return { manifest: manifest.versions, targets, built }
}

async function build(targets: ManifestVersion[], manifest: ManifestVersion[]) {
  let failed = 0
  for (const version of [...targets].reverse()) {
    try {
      const { dataDir, pipeline } = config
      await buildVersion(version, { dataDir, manifest, keepJar: pipeline.keepJars, prefetchLangs: pipeline.prefetchLangs, log })
    }
    catch (err) {
      failed++
      const reason = err instanceof UnsupportedVersionError ? err.message : (err as Error).stack
      log.error(`${version.id}: build failed: ${reason}`)
    }
  }
  if (targets.length) await gc()
  return failed
}

async function sync(force: boolean) {
  const { manifest, targets } = await pending(force)
  log.info(targets.length ? `building ${targets.map(v => v.id).join(', ')}` : 'everything is up to date')
  return build(targets, manifest)
}

async function pull() {
  const imported = await pullRelease({
    dataDir: config.dataDir,
    baseUrl: releaseBaseUrl(config.pipeline.repo, config.pipeline.releaseUrl),
    log,
    accept: (version: VersionSummary, all: VersionSummary[]) => eligible(all).includes(version),
  })
  if (imported.length) await gc()
  return imported
}

async function gc() {
  const { removed, kept } = await removeUnusedBlobs(config.dataDir)
  log.info(`gc: removed ${removed} blobs, kept ${kept}`)
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      force: { type: 'boolean', default: false },
      size: { type: 'string', default: '256' },
      out: { type: 'string' },
    },
  })
  const [command, ...args] = positionals

  switch (command) {
    case 'watch': {
      const { source, repo, releaseUrl, intervalMinutes } = config.pipeline
      log.info(source === 'github'
        ? `pulling ${releaseBaseUrl(repo, releaseUrl)} every ${intervalMinutes} min`
        : `building new versions every ${intervalMinutes} min`)
      for (;;) {
        try {
          if (source === 'github') await pull()
          else await sync(false)
        }
        catch (err) {
          log.error(`update failed: ${(err as Error).message}`)
        }
        // Until the first data arrives, check more often
        const empty = (await readIndex(config.dataDir)).versions.length === 0
        await sleep((empty ? Math.min(5, intervalMinutes) : intervalMinutes) * 60_000)
      }
    }
    case 'pull': {
      await pull()
      return 0
    }
    case 'sync':
      return await sync(values.force) ? 1 : 0
    case 'list': {
      const { manifest, built } = await pending(false)
      for (const v of eligible(manifest)) {
        const state = built.get(v.id)
        const status = !state ? 'missing' : state.pipeline < PIPELINE_VERSION ? 'outdated' : `built ${state.builtAt}`
        console.log(`${v.id.padEnd(20)} ${v.type.padEnd(9)} ${status}`)
      }
      return 0
    }
    case 'pack': {
      const [outDir] = args
      if (!outDir) break
      const index = await packData(config.dataDir, outDir)
      log.info(`packed ${index.versions.length} versions, ${(index.size / 1e6).toFixed(1)} MB`)
      return 0
    }
    case 'gc': {
      await gc()
      return 0
    }
    case 'release-tag':
      console.log(releaseTag())
      return 0
    case 'build': {
      if (!args.length) break
      const manifest = (await fetchManifest()).versions
      const targets = args.map((id) => {
        const version = manifest.find(v => v.id === id)
        if (!version) throw new Error(`Unknown version ${id}`)
        return version
      })
      return await build(targets, manifest) ? 1 : 0
    }
    case 'render': {
      const [id, item] = args
      if (!id || !item) break
      const version = (await fetchManifest()).versions.find(v => v.id === id)
      if (!version) throw new Error(`Unknown version ${id}`)
      const json = await fetchJson<VersionJson>(version.url)
      const jar = join(jarCacheDir(config.dataDir), `${json.downloads.client.sha1}.jar`)
      await downloadVerified(json.downloads.client, jar)
      const size = Number(values.size)
      const result = await new ItemRenderer(await JarAssets.open(jar)).render(item, size)
      if (!result.image) throw new Error(`Nothing to draw: ${JSON.stringify(result.unsupported)}`)
      const out = values.out ?? `${item}.png`
      await writeFile(out, await sharp(result.image, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer())
      log.info(`wrote ${out}`)
      return 0
    }
  }
  console.log(USAGE)
  return 1
}

main().then(
  code => process.exit(code),
  (err) => {
    log.error((err as Error).stack ?? String(err))
    process.exit(1)
  },
)
