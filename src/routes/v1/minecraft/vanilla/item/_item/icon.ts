import type { FastifyPluginAsync } from 'fastify'
import { ID_PATTERN } from '../../../../../../catalog/paths'
import { hasIcon } from '../../../../../../catalog/types'
import { sendImage, useLegacyVersion, versionCaching } from '../../../../../../utils/http'

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
    if (!item || !hasIcon(item)) return reply.code(404).send({ error: 'Item not found' })
    return sendImage(request, reply, { file: fastify.catalog.iconFile(item, 256)!, format: 'webp' }, item.icons[256]!, versionCaching(alias))
  })
}

export default route
