import type { FastifyPluginAsync } from 'fastify'
import { LANG_PATTERN } from '../../../../../../catalog/paths'
import { useLegacyVersion } from '../../../../../../utils/http'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { item: string, lang: string } }>('/lang/:lang/name', {
    schema: {
      summary: 'Item name',
      tags: ['v1'],
      deprecated: true,
      description: 'Use /v2/minecraft/{version}/items/{id}?lang={lang}',
      params: {
        type: 'object',
        required: ['item', 'lang'],
        properties: {
          item: { type: 'string', examples: ['diamond_block', 'carrot'] },
          lang: { type: 'string', examples: ['en_us', 'ru_ru'] },
        },
      },
    },
  }, async (request, reply) => {
    const { data } = await useLegacyVersion(fastify)
    const { item, lang } = request.params
    if (!LANG_PATTERN.test(lang) || !data.langIndex[lang]) {
      return reply.status(400).send({ message: 'Unknown lang', lang_keys: Object.keys(data.langIndex).sort() })
    }
    const translations = await fastify.catalog.lang(data, lang)
    const name = translations[`item.minecraft.${item}`] ?? translations[`block.minecraft.${item}`]
    if (!name) return reply.status(400).send({ message: 'Not found item name' })
    return reply.type('text/plain; charset=utf-8').send(name)
  })
}

export default route
