import type { FastifyPluginAsync } from 'fastify'
import { LANG_PATTERN } from '../../../../../catalog/paths'
import { useLegacyVersion } from '../../../../../utils/http'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      summary: 'Language',
      tags: ['v1'],
      deprecated: true,
      description: 'Use /v2/minecraft/{version}/lang/{code}',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', examples: ['en_us', 'ru_ru'] } } },
    },
  }, async (request, reply) => {
    const { data } = await useLegacyVersion(fastify)
    if (!LANG_PATTERN.test(request.params.id) || !data.langIndex[request.params.id]) {
      return reply.status(400).send({ message: 'Unknown lang', lang_keys: Object.keys(data.langIndex).sort() })
    }
    return fastify.catalog.lang(data, request.params.id)
  })
}

export default route
