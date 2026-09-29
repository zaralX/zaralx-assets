import type { FastifyPluginAsync } from 'fastify'
import { renderFace } from '../../../players'
import { loadSkin, sendPng } from '../../../players/http'
import { publicUrl } from '../../../utils/http'

const identifierParam = {
  type: 'object',
  required: ['identifier'],
  properties: {
    identifier: { type: 'string', description: 'UUID (with or without dashes) or nickname', examples: ['_zaralX_', '069a79f444e94726a5befca90e38aaf5'] },
  },
} as const

const pngResponse = {
  200: { description: 'PNG image', content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } },
} as const

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { identifier: string } }>('/players/:identifier', {
    schema: {
      tags: ['players'],
      description: 'Player UUID and links to the skin images',
      params: identifierParam,
      response: {
        200: {
          type: 'object',
          properties: { uuid: { type: 'string' }, skin: { type: 'string' }, face: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const { uuid } = await loadSkin(fastify, request.params.identifier)
    reply.header('Cache-Control', 'public, max-age=3600')
    return {
      uuid,
      skin: publicUrl(`/v2/minecraft/players/${uuid}/skin`),
      face: publicUrl(`/v2/minecraft/players/${uuid}/face`),
    }
  })

  fastify.get<{ Params: { identifier: string } }>('/players/:identifier/skin', {
    schema: {
      tags: ['players'],
      description: 'Skin texture\n\n![skin](https://assets.zaralx.ru/api/v2/minecraft/players/_zaralX_/skin)',
      params: identifierParam,
      response: pngResponse,
    },
  }, async (request, reply) => {
    const { skin } = await loadSkin(fastify, request.params.identifier)
    return sendPng(reply, skin)
  })

  fastify.get<{ Params: { identifier: string }, Querystring: { size: number, overlay: boolean } }>('/players/:identifier/face', {
    schema: {
      tags: ['players'],
      description: 'Front of the head\n\n![face](https://assets.zaralx.ru/api/v2/minecraft/players/_zaralX_/face?size=64&overlay=true)',
      params: identifierParam,
      querystring: {
        type: 'object',
        properties: {
          size: { type: 'integer', minimum: 8, maximum: 512, default: 256 },
          overlay: { type: 'boolean', default: true, description: 'Draw the hat layer' },
        },
      },
      response: pngResponse,
    },
  }, async (request, reply) => {
    const { skin } = await loadSkin(fastify, request.params.identifier)
    return sendPng(reply, await renderFace(skin, request.query.size, request.query.overlay))
  })
}

export default route
