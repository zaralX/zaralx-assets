import type { FastifyPluginAsync } from 'fastify'
import { versionParam } from '../../../../schemas/v2'
import { publicUrl, setCaching, useVersion } from '../../../../utils/http'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { version: string } }>('/', {
    schema: {
      summary: 'Version',
      tags: ['versions'],
      description: 'Build information of a version, including items without an icon',
      params: { type: 'object', required: ['version'], properties: { version: versionParam } },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    const { meta } = data
    setCaching(reply, alias, meta.builtAt, 'meta')
    const base = `/v2/minecraft/${meta.id}`
    return {
      id: meta.id,
      type: meta.type,
      releaseTime: meta.releaseTime,
      builtAt: meta.builtAt,
      items: meta.items,
      blocks: meta.blocks,
      textures: meta.textures,
      missingIcons: meta.missingIcons,
      links: {
        items: publicUrl(`${base}/items`),
        blocks: publicUrl(`${base}/blocks`),
        textures: publicUrl(`${base}/textures`),
        lang: publicUrl(`${base}/lang`),
        creativeTabs: publicUrl(`${base}/creative-tabs`),
      },
    }
  })
}

export default route
