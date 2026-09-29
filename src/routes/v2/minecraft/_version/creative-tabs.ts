import type { FastifyPluginAsync } from 'fastify'
import { versionParam } from '../../../../schemas/v2'
import { setCaching, useVersion } from '../../../../utils/http'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { version: string } }>('/creative-tabs', {
    schema: {
      summary: 'Creative tabs',
      tags: ['items'],
      description: 'Item ids per creative tab, in tab order. Items that are in no tab are listed under `uncategorized`',
      params: { type: 'object', required: ['version'], properties: { version: versionParam } },
      response: { 200: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    setCaching(reply, alias, data.meta.builtAt, 'creative-tabs')
    return data.creativeTabs
  })
}

export default route
