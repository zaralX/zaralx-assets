import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config'
import { publicUrl } from '../utils/http'

const root: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      summary: 'API info',
      description: 'API information',
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            docs: { type: 'string' },
            versions: { type: 'string' },
            latest: { type: ['string', 'null'] },
            sources: {
              type: 'object',
              description: 'v1 field: the version the v1 routes serve',
              properties: { vanilla: { type: 'object', properties: { version: { type: 'string' } } } },
            },
          },
        },
      },
    },
  }, async () => {
    const latest = await fastify.catalog.resolve('latest')
    const legacy = await fastify.catalog.resolve(config.legacyVersion) ?? latest
    return {
      message: 'Open source project. Github: https://github.com/zaralX/zaralx-assets',
      docs: publicUrl('/swagger'),
      versions: publicUrl('/v2/minecraft/versions'),
      latest: latest?.id ?? null,
      sources: { vanilla: { version: legacy?.id ?? config.legacyVersion } },
    }
  })
}

export default root
