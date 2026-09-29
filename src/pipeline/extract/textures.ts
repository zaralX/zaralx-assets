import sharp from 'sharp'
import type { BlobWriter } from '../../catalog/blobs'
import type { TextureEntry } from '../../catalog/types'
import type { JarAssets } from '../jar'

const TEXTURES = 'assets/minecraft/textures/'

interface AnimationMeta {
  animation?: { width?: number, height?: number }
}

export async function extractTextures(assets: JarAssets, blobs: BlobWriter) {
  const entries: TextureEntry[] = []
  for (const file of assets.list(TEXTURES, '.png')) {
    const path = file.slice(TEXTURES.length, -4)
    const png = assets.read(file)!
    const { width = 0, height = 0 } = await sharp(png).metadata()
    const mcmeta = assets.read(file + '.mcmeta')
    const meta = mcmeta && JSON.parse(mcmeta.toString('utf8')) as AnimationMeta

    let frames = 1
    if (meta && meta.animation) {
      const frameWidth = meta.animation.width ?? Math.min(width, height)
      const frameHeight = meta.animation.height ?? frameWidth
      frames = Math.max(1, Math.floor(width / frameWidth)) * Math.max(1, Math.floor(height / frameHeight))
    }

    entries.push({
      path,
      width,
      height,
      frames,
      hash: await blobs.put(png, 'png'),
      mcmeta: mcmeta && await blobs.put(mcmeta, 'mcmeta'),
    })
  }
  return entries
}
