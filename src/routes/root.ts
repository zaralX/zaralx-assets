import type { FastifyPluginAsync } from 'fastify'
import { publicUrl } from '../utils/http'

const root: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'API information',
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            docs: { type: 'string' },
            versions: { type: 'string' },
            latest: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async () => {
    const latest = await fastify.catalog.resolve('latest')
    return {
      message: 'Open source project. Github: https://github.com/zaralX/zaralx-assets',
      docs: publicUrl('/swagger'),
      versions: publicUrl('/v2/minecraft/versions'),
      latest: latest?.id ?? null,
    }
  })
}

export default root
