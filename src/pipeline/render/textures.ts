import sharp from 'sharp'
import { assetPath, normalizeId, type JarAssets } from '../jar'

export interface Texture {
  id: string
  width: number
  height: number
  // RGBA of the first animation frame
  data: Buffer
  frames: number
  // Has pixels that are neither fully opaque nor fully transparent
  translucent: boolean
}

interface AnimationMeta {
  animation?: {
    width?: number
    height?: number
    frames?: (number | { index: number })[]
  }
}

function hasTranslucency(data: Buffer) {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0 && data[i] !== 255) return true
  }
  return false
}

export async function decodeTexture(png: Buffer, meta?: AnimationMeta) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (!meta?.animation) return { width: info.width, height: info.height, data, frames: 1, translucent: hasTranslucency(data) }

  const frameWidth = meta.animation.width ?? Math.min(info.width, info.height)
  const frameHeight = meta.animation.height ?? frameWidth
  const columns = Math.max(1, Math.floor(info.width / frameWidth))
  const frames = columns * Math.max(1, Math.floor(info.height / frameHeight))
  const first = meta.animation.frames?.[0]
  const index = typeof first === 'object' ? first.index : (first ?? 0)
  const fx = (index % columns) * frameWidth
  const fy = Math.floor(index / columns) * frameHeight

  const frame = Buffer.alloc(frameWidth * frameHeight * 4)
  for (let y = 0; y < frameHeight; y++) {
    const from = ((fy + y) * info.width + fx) * 4
    data.copy(frame, y * frameWidth * 4, from, from + frameWidth * 4)
  }
  return { width: frameWidth, height: frameHeight, data: frame, frames, translucent: hasTranslucency(data) }
}

export class TextureStore {
  private readonly cache = new Map<string, Promise<Texture | undefined>>()

  constructor(private readonly assets: JarAssets) {}

  get(id: string) {
    const key = normalizeId(id)
    let pending = this.cache.get(key)
    if (!pending) {
      pending = this.load(key)
      this.cache.set(key, pending)
    }
    return pending
  }

  private async load(id: string): Promise<Texture | undefined> {
    const path = assetPath('textures', id, '.png')
    const png = this.assets.read(path)
    if (!png) return undefined
    return { id, ...await decodeTexture(png, this.assets.json<AnimationMeta>(path + '.mcmeta')) }
  }
}
