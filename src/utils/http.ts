import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { LATEST, LATEST_SNAPSHOT, type VersionData } from '../catalog/catalog'
import { config } from '../config'
import { CONTENT_TYPES, renderImage, type ImageRequest } from './images'

const DAY = 24 * 60 * 60

export const IMMUTABLE = 'public, max-age=31536000, immutable'

export async function useVersion(fastify: FastifyInstance, version: string) {
  const summary = await fastify.catalog.resolve(version)
  if (!summary) throw fastify.httpErrors.notFound(`Unknown or not yet built version ${version}`)
  const data = await fastify.catalog.load(summary)
  const alias = version === LATEST || version === LATEST_SNAPSHOT
  return { summary, data, alias }
}

export function versionCaching(alias: boolean) {
  return alias ? 'public, max-age=3600' : `public, max-age=${DAY}, stale-while-revalidate=${7 * DAY}`
}

function etagOf(source: string) {
  return `"${createHash('sha1').update(source).digest('base64url').slice(0, 20)}"`
}

export function setCaching(reply: FastifyReply, alias: boolean, builtAt: string, key: string) {
  const etag = etagOf(`${builtAt}\n${key}`)
  reply.header('Cache-Control', versionCaching(alias)).header('ETag', etag)
  return etag
}

export function notModified(request: FastifyRequest, etag: string) {
  return request.headers['if-none-match'] === etag
}

// The ETag depends only on the content, so the same image is cached once for every version
export async function sendImage(request: FastifyRequest, reply: FastifyReply, image: ImageRequest, hash: string, cacheControl: string) {
  const etag = etagOf(`${hash}\n${image.width ?? ''}\n${image.format}\n${image.frame?.index ?? ''}`)
  reply.header('Cache-Control', cacheControl).header('ETag', etag)
  if (notModified(request, etag)) return reply.code(304).send()
  return reply.type(CONTENT_TYPES[image.format]).send(await renderImage(image))
}

export function publicUrl(path: string) {
  return `${config.publicUrl}${path}`
}

export function blobUrl(hash: string, extension: string) {
  return publicUrl(`/v2/blobs/${hash}.${extension}`)
}

export async function useLang(fastify: FastifyInstance, data: VersionData, code: string) {
  if (!data.langIndex[code]) {
    throw fastify.httpErrors.badRequest(`Unknown language ${code}, available: ${Object.keys(data.langIndex).sort().join(', ')}`)
  }
  try {
    const [lang, fallback] = await Promise.all([fastify.catalog.lang(data, code), fastify.catalog.lang(data, 'en_us')])
    return (key: string) => lang[key] ?? fallback[key] ?? key
  }
  catch (err) {
    fastify.log.error(err)
    throw fastify.httpErrors.badGateway(`Language ${code} could not be loaded`)
  }
}

export async function useLegacyVersion(fastify: FastifyInstance) {
  const version = await fastify.catalog.resolve(config.legacyVersion) ? config.legacyVersion : LATEST
  return useVersion(fastify, version)
}
