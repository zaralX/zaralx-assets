import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { LATEST, LATEST_SNAPSHOT, type VersionData } from '../catalog/catalog'
import { config } from '../config'
import { CONTENT_TYPES, renderImage, type ImageRequest } from './images'

const DAY = 24 * 60 * 60

export async function useVersion(fastify: FastifyInstance, version: string) {
  const summary = await fastify.catalog.resolve(version)
  if (!summary) throw fastify.httpErrors.notFound(`Unknown or not yet built version ${version}`)
  const data = await fastify.catalog.load(summary)
  const alias = version === LATEST || version === LATEST_SNAPSHOT
  return { summary, data, alias }
}

// Builds of a version only change when the pipeline is upgraded; aliases move with every release
export function setCaching(reply: FastifyReply, alias: boolean, builtAt: string, key: string) {
  reply.header('Cache-Control', alias
    ? 'public, max-age=3600'
    : `public, max-age=${DAY}, stale-while-revalidate=${7 * DAY}`)
  const etag = `"${createHash('sha1').update(`${builtAt}\n${key}`).digest('base64url').slice(0, 20)}"`
  reply.header('ETag', etag)
  return etag
}

export function notModified(request: FastifyRequest, etag: string) {
  return request.headers['if-none-match'] === etag
}

export async function sendImage(request: FastifyRequest, reply: FastifyReply, image: ImageRequest, cache: { alias: boolean, builtAt: string }) {
  const etag = setCaching(reply, cache.alias, cache.builtAt, JSON.stringify(image))
  if (notModified(request, etag)) return reply.code(304).send()
  const body = await renderImage(image)
  return reply.type(CONTENT_TYPES[image.format]).send(body)
}

export function publicUrl(path: string) {
  return `${config.publicUrl}${path}`
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

// v1 predates versioning and keeps serving the version it was built for, or the latest release until that is built
export async function useLegacyVersion(fastify: FastifyInstance) {
  const version = await fastify.catalog.resolve(config.legacyVersion) ? config.legacyVersion : LATEST
  return useVersion(fastify, version)
}
