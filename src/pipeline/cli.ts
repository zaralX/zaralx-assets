import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { config } from '../config'
import { jarCacheDir } from '../catalog/paths'
import { downloadVerified, fetchJson, fetchManifest, type ManifestVersion, type VersionJson } from '../mojang'
import { buildVersion, PIPELINE_VERSION, readIndex, removeUnusedBlobs, UnsupportedVersionError } from './build'
import { JarAssets } from './jar'
import { ItemRenderer } from './render'
import { consoleLogger as log } from './logger'

const USAGE = `Usage: pipeline <command>

  list                     versions eligible for building and their state
  sync [--force]           build every eligible version that is missing or outdated
  watch                    run sync every PIPELINE_INTERVAL_MINUTES
  build <version...>       build the given versions, even if not eligible
  gc                       delete blobs no version refers to
  render <version> <item> [--size 256] [--out file.png]
                           render one icon, for debugging`

function eligible(versions: ManifestVersion[]) {
  const min = versions.find(v => v.id === config.pipeline.minVersion)
  if (!min) throw new Error(`PIPELINE_MIN_VERSION ${config.pipeline.minVersion} is not in the version manifest`)
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
      await buildVersion(version, { dataDir: config.dataDir, manifest, keepJar: config.pipeline.keepJars, log })
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
    case 'list': {
      const { manifest, built } = await pending(false)
      for (const v of eligible(manifest)) {
        const state = built.get(v.id)
        const status = !state ? 'missing' : state.pipeline < PIPELINE_VERSION ? 'outdated' : `built ${state.builtAt}`
        console.log(`${v.id.padEnd(20)} ${v.type.padEnd(9)} ${status}`)
      }
      return 0
    }
    case 'sync': {
      const { manifest, targets } = await pending(values.force)
      log.info(targets.length ? `building ${targets.map(v => v.id).join(', ')}` : 'everything is up to date')
      return await build(targets, manifest) ? 1 : 0
    }
    case 'watch': {
      log.info(`watching for new versions every ${config.pipeline.intervalMinutes} min`)
      for (;;) {
        try {
          const { manifest, targets } = await pending(false)
          if (targets.length) {
            log.info(`building ${targets.map(v => v.id).join(', ')}`)
            await build(targets, manifest)
          }
        }
        catch (err) {
          log.error(`sync failed: ${(err as Error).message}`)
        }
        await sleep(config.pipeline.intervalMinutes * 60_000)
      }
    }
    case 'gc': {
      await gc()
      return 0
    }
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
