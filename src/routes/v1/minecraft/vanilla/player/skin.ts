import type { FastifyPluginAsync } from 'fastify'
import { loadSkin, sendPng } from '../../../../../players/http'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { identifier: string } }>('/skin/:identifier', {
    schema: {
      summary: 'Player skin',
      tags: ['v1'],
      deprecated: true,
      description: 'Use /v2/minecraft/players/{identifier}/skin',
      params: { type: 'object', required: ['identifier'], properties: { identifier: { type: 'string', examples: ['_zaralX_'] } } },
    },
  }, async (request, reply) => {
    const { skin } = await loadSkin(fastify, request.params.identifier)
    return sendPng(reply, skin)
  })
}

export default route
