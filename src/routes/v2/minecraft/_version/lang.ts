import type { FastifyPluginAsync } from 'fastify'
import { LANG_PATTERN } from '../../../../catalog/paths'
import { versionParam } from '../../../../schemas/v2'
import { publicUrl, setCaching, useLang, useVersion } from '../../../../utils/http'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { version: string } }>('/lang', {
    schema: {
      summary: 'List languages',
      tags: ['lang'],
      description: 'Languages available for a version',
      params: { type: 'object', required: ['version'], properties: { version: versionParam } },
      response: {
        200: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, url: { type: 'string' } } } },
      },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    setCaching(reply, alias, data.meta.builtAt, 'lang')
    return Object.keys(data.langIndex).sort().map(code => ({ code, url: publicUrl(`/v2/minecraft/${data.meta.id}/lang/${code}`) }))
  })

  fastify.get<{ Params: { version: string, code: string } }>('/lang/:code', {
    schema: {
      summary: 'Language',
      tags: ['lang'],
      description: 'Every translation of a language. Missing keys are not filled from en_us',
      params: {
        type: 'object',
        required: ['version', 'code'],
        properties: { version: versionParam, code: { type: 'string', pattern: LANG_PATTERN.source, examples: ['en_us', 'ru_ru'] } },
      },
      response: { 200: { type: 'object', additionalProperties: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    await useLang(fastify, data, request.params.code)
    setCaching(reply, alias, data.meta.builtAt, `lang:${request.params.code}`)
    return fastify.catalog.lang(data, request.params.code)
  })
}

export default route
