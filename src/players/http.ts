import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { getSkin, isPlayerIdentifier, PlayerNotFoundError, resolveUuid, SKIN_TTL, UpstreamError } from './index'

const FALLBACK_TTL = 5 * 60

export const STEVE_SKIN = readFileSync(join(__dirname, '..', '..', 'resources', 'players', 'steve.png'))

export async function loadSkin(fastify: FastifyInstance, identifier: string) {
  if (!isPlayerIdentifier(identifier)) throw fastify.httpErrors.badRequest('Invalid UUID or nickname')
  try {
    const uuid = await resolveUuid(fastify.cache, identifier)
    return { uuid, skin: await getSkin(fastify.cache, uuid) }
  }
  catch (err) {
    if (err instanceof PlayerNotFoundError) throw fastify.httpErrors.notFound(`Player ${identifier} not found`)
    if (err instanceof UpstreamError) {
      fastify.log.warn(err.message)
      throw fastify.httpErrors.badGateway('Skin service is unavailable')
    }
    throw err
  }
}

export async function loadSkinImage(fastify: FastifyInstance, identifier: string) {
  const steve = { skin: STEVE_SKIN, maxAge: FALLBACK_TTL }
  if (!isPlayerIdentifier(identifier)) return steve
  try {
    const uuid = await resolveUuid(fastify.cache, identifier)
    return { skin: await getSkin(fastify.cache, uuid), maxAge: SKIN_TTL }
  }
  catch (err) {
    if (err instanceof UpstreamError) fastify.log.warn(err.message)
    else if (!(err instanceof PlayerNotFoundError)) throw err
    return steve
  }
}

export function sendPng(reply: FastifyReply, image: Buffer, maxAge = SKIN_TTL) {
  return reply.type('image/png').header('Cache-Control', `public, max-age=${maxAge}`).send(image)
}
