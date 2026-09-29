import type { FastifyPluginAsync } from 'fastify'
import { publicUrl } from '../../../utils/http'

const summary = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['release', 'snapshot', 'old_beta', 'old_alpha'] },
    releaseTime: { type: 'string', format: 'date-time' },
    builtAt: { type: 'string', format: 'date-time' },
    items: { type: 'integer' },
    blocks: { type: 'integer' },
    textures: { type: 'integer' },
    url: { type: 'string' },
  },
} as const

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get('/versions', {
    schema: {
      summary: 'List versions',
      tags: ['versions'],
      description: 'Versions that have been built, newest first',
      response: {
        200: {
          type: 'object',
          properties: {
            latest: {
              type: 'object',
              properties: {
                release: { type: ['string', 'null'] },
                snapshot: { type: ['string', 'null'] },
              },
            },
            versions: { type: 'array', items: summary },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const versions = await fastify.catalog.versions()
    reply.header('Cache-Control', 'public, max-age=300')
    return {
      latest: {
        release: versions.find(v => v.type === 'release')?.id ?? null,
        snapshot: versions[0]?.id ?? null,
      },
      versions: versions.map(v => ({ ...v, url: publicUrl(`/v2/minecraft/${v.id}`) })),
    }
  })
}

export default route
