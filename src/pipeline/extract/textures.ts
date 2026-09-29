import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import type { TextureEntry } from '../../catalog/types'
import type { JarAssets } from '../jar'

const TEXTURES = 'assets/minecraft/textures/'

interface AnimationMeta {
  animation?: { width?: number, height?: number }
}

// Copies every vanilla texture as-is, next to its .mcmeta
export async function extractTextures(assets: JarAssets, outDir: string) {
  const entries: TextureEntry[] = []
  for (const file of assets.list(TEXTURES, '.png')) {
    const path = file.slice(TEXTURES.length, -4)
    const png = assets.read(file)!
    const { width = 0, height = 0 } = await sharp(png).metadata()
    const meta = assets.json<AnimationMeta>(file + '.mcmeta')

    let frames = 1
    if (meta?.animation) {
      const frameWidth = meta.animation.width ?? Math.min(width, height)
      const frameHeight = meta.animation.height ?? frameWidth
      frames = Math.max(1, Math.floor(width / frameWidth)) * Math.max(1, Math.floor(height / frameHeight))
    }

    const target = join(outDir, 'textures', `${path}.png`)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, png)
    if (meta) await writeFile(target + '.mcmeta', assets.read(file + '.mcmeta')!)

    entries.push({ path, width, height, frames })
  }
  return entries
}
