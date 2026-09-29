import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { LruCache } from './lru'

export type ImageFormat = 'png' | 'webp'

export const IMAGE_FORMATS: ImageFormat[] = ['png', 'webp']

export const CONTENT_TYPES: Record<ImageFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
}

export interface ImageRequest {
  file: string
  width?: number
  format: ImageFormat
  frame?: { index: number, width: number, height: number }
}

const cache = new LruCache<string, Buffer>(64 * 1024 * 1024, b => b.length)

export async function renderImage(request: ImageRequest) {
  const key = JSON.stringify(request)
  const cached = cache.get(key)
  if (cached) return cached

  let image = sharp(await readFile(request.file))
  if (request.frame) {
    const { index, width, height } = request.frame
    image = sharp(await image.extract({ left: 0, top: index * height, width, height }).toBuffer())
  }
  if (request.width) {
    image = image.resize({ width: request.width, kernel: sharp.kernel.nearest })
  }
  const output = request.format === 'png'
    ? await image.png({ compressionLevel: 9, palette: false }).toBuffer()
    : await image.webp({ lossless: true }).toBuffer()

  cache.set(key, output)
  return output
}
