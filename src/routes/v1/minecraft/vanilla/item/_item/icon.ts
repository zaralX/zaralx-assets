import type { FastifyPluginAsync } from 'fastify'
import { ID_PATTERN } from '../../../../../../catalog/paths'
import { sendImage, useLegacyVersion } from '../../../../../../utils/http'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { item: string } }>('/icon', {
    schema: {
      tags: ['v1'],
      deprecated: true,
      description: 'Use /v2/minecraft/{version}/items/{id}/icon',
      params: {
        type: 'object',
        required: ['item'],
        properties: { item: { type: 'string', description: 'The item identifier', examples: ['diamond_block', 'carrot'] } },
      },
    },
    config: { rateLimit: { max: 5000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { data, alias } = await useLegacyVersion(fastify)
    const item = ID_PATTERN.test(request.params.item) ? data.items.get(request.params.item) : undefined
    if (!item?.icon) return reply.code(404).send({ error: 'Item not found' })
    return sendImage(request, reply, { file: fastify.catalog.iconFile(data.meta.id, item.id, 256), format: 'webp' }, { alias, builtAt: data.meta.builtAt })
  })
}

export default route
