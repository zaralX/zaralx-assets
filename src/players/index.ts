import sharp from 'sharp'
import type { KeyValueCache } from '../utils/cache'

const TIMEOUT = 10_000
const PROFILE_TTL = 60 * 60
const MISSING_PROFILE_TTL = 5 * 60
export const SKIN_TTL = 24 * 60 * 60

const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
const NICKNAME_PATTERN = /^\w{3,16}$/

export class PlayerNotFoundError extends Error {}
export class UpstreamError extends Error {}

export function isPlayerIdentifier(identifier: string) {
  return UUID_PATTERN.test(identifier) || NICKNAME_PATTERN.test(identifier)
}

export async function resolveUuid(cache: KeyValueCache, identifier: string) {
  if (UUID_PATTERN.test(identifier)) return identifier.replaceAll('-', '').toLowerCase()
  if (!NICKNAME_PATTERN.test(identifier)) throw new PlayerNotFoundError(identifier)

  const key = `player:uuid:${identifier.toLowerCase()}`
  const cached = await cache.get(key)
  if (cached) {
    if (!cached.length) throw new PlayerNotFoundError(identifier)
    return cached.toString()
  }

  const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${identifier}`, { signal: AbortSignal.timeout(TIMEOUT) })
    .catch((err: Error) => {
      throw new UpstreamError(`Mojang API: ${err.message}`)
    })
  if (res.status === 204 || res.status === 404) {
    await cache.set(key, Buffer.alloc(0), MISSING_PROFILE_TTL)
    throw new PlayerNotFoundError(identifier)
  }
  if (!res.ok) throw new UpstreamError(`Mojang API responded ${res.status}`)
  const { id } = await res.json() as { id: string }
  await cache.set(key, Buffer.from(id), PROFILE_TTL)
  return id
}

async function download(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) throw new Error(`${url} responded ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function skinFromSessionServer(uuid: string) {
  const res = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { signal: AbortSignal.timeout(TIMEOUT) })
  if (res.status === 204 || res.status === 404) throw new PlayerNotFoundError(uuid)
  if (!res.ok) throw new Error(`session server responded ${res.status}`)
  const profile = await res.json() as { properties: { name: string, value: string }[] }
  const textures = profile.properties.find(p => p.name === 'textures')
  const url = textures && (JSON.parse(Buffer.from(textures.value, 'base64').toString()) as { textures: { SKIN?: { url: string } } }).textures.SKIN?.url
  if (!url) throw new PlayerNotFoundError(uuid)
  return download(url.replace(/^http:/, 'https:'))
}

// mineskin.eu mirrors skins without Mojang's rate limit; the session server is the fallback
export async function getSkin(cache: KeyValueCache, uuid: string) {
  const key = `player:skin:${uuid}`
  const cached = await cache.get(key)
  if (cached) return cached

  let skin: Buffer
  try {
    skin = await download(`https://mineskin.eu/skin/${uuid}`)
  }
  catch {
    try {
      skin = await skinFromSessionServer(uuid)
    }
    catch (err) {
      if (err instanceof PlayerNotFoundError) throw err
      throw new UpstreamError(`Failed to fetch skin: ${(err as Error).message}`)
    }
  }

  const { width, height, format } = await sharp(skin).metadata()
  if (format !== 'png' || width !== 64 || (height !== 64 && height !== 32)) {
    throw new UpstreamError(`Unexpected skin image ${format} ${width}x${height}`)
  }
  await cache.set(key, skin, SKIN_TTL)
  return skin
}

function region(skin: Buffer, left: number, top: number, size: number) {
  return sharp(skin).extract({ left, top, width: 8, height: 8 }).resize(size, size, { kernel: sharp.kernel.nearest }).toBuffer()
}

export async function renderFace(skin: Buffer, size: number, overlay: boolean) {
  const face = await region(skin, 8, 8, size)
  if (!overlay) return sharp(face).png().toBuffer()
  return sharp(face).composite([{ input: await region(skin, 40, 8, size) }]).png().toBuffer()
}

// v1 "full" face: the back of the hat behind a slightly shrunk face, then the hat front on top
export async function renderLayeredFace(skin: Buffer, size: number) {
  const inset = Math.round(size / 32)
  const [back, face, front] = await Promise.all([
    region(skin, 56, 8, size),
    region(skin, 8, 8, size - inset),
    region(skin, 40, 8, size),
  ])
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: back, left: 0, top: 0 },
      { input: face, left: Math.floor(inset / 2), top: Math.floor(inset / 2) },
      { input: front, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}
