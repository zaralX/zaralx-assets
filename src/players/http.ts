import type { FastifyInstance, FastifyReply } from 'fastify'
import { getSkin, isPlayerIdentifier, PlayerNotFoundError, resolveUuid, SKIN_TTL, UpstreamError } from './index'

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

export function sendPng(reply: FastifyReply, image: Buffer) {
  return reply.type('image/png').header('Cache-Control', `public, max-age=${SKIN_TTL}`).send(image)
}
