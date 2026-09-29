import type { FastifyPluginAsync } from 'fastify'
import { renderFace, renderLayeredFace } from '../../../../../players'
import { loadSkin, sendPng } from '../../../../../players/http'

const FACE_SIZE = 256

const params = { type: 'object', required: ['identifier'], properties: { identifier: { type: 'string', examples: ['_zaralX_'] } } } as const

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { identifier: string } }>('/face/:identifier', {
    schema: { tags: ['v1'], deprecated: true, description: 'Use /v2/minecraft/players/{identifier}/face?overlay=false', params },
  }, async (request, reply) => {
    const { skin } = await loadSkin(fastify, request.params.identifier)
    return sendPng(reply, await renderFace(skin, FACE_SIZE, false))
  })

  fastify.get<{ Params: { identifier: string } }>('/face/:identifier/full', {
    schema: { tags: ['v1'], deprecated: true, description: 'Face with the hat layer drawn over the back of the hat', params },
  }, async (request, reply) => {
    const { skin } = await loadSkin(fastify, request.params.identifier)
    return sendPng(reply, await renderLayeredFace(skin, FACE_SIZE))
  })
}

export default route
