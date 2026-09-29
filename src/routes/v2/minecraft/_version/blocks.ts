import type { FastifyPluginAsync } from 'fastify'
import { idParam, langQuery, textureRef, versionParam } from '../../../../schemas/v2'
import { publicUrl, setCaching, useLang, useVersion } from '../../../../utils/http'

const sides = ['up', 'down', 'north', 'south', 'west', 'east'] as const

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { version: string }, Querystring: { lang: string, q?: string } }>('/blocks', {
    schema: {
      tags: ['blocks'],
      description: 'All blocks of a version',
      params: { type: 'object', required: ['version'], properties: { version: versionParam } },
      querystring: {
        type: 'object',
        properties: {
          lang: langQuery,
          q: { type: 'string', maxLength: 64, description: 'Substring of the id or the localized name' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, url: { type: 'string' } } },
        },
      },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    const name = await useLang(fastify, data, request.query.lang)
    const query = request.query.q?.toLowerCase()
    setCaching(reply, alias, data.meta.builtAt, `blocks:${request.query.lang}`)
    return [...data.blocks.values()]
      .map(b => ({ id: b.id, name: name(b.translationKey), url: publicUrl(`/v2/minecraft/${data.meta.id}/blocks/${b.id}`) }))
      .filter(b => !query || b.id.includes(query) || b.name.toLowerCase().includes(query))
  })

  fastify.get<{ Params: { version: string, id: string }, Querystring: { lang: string } }>('/blocks/:id', {
    schema: {
      tags: ['blocks'],
      description: 'Block textures, separately from the rendered icon: the texture of every side in the default state, plus every texture any state uses',
      params: { type: 'object', required: ['version', 'id'], properties: { version: versionParam, id: { ...idParam, examples: ['oak_log', 'furnace'] } } },
      querystring: { type: 'object', properties: { lang: langQuery } },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            translationKey: { type: 'string' },
            item: { type: ['string', 'null'] },
            model: { type: 'string' },
            particle: textureRef,
            faces: { type: 'object', properties: Object.fromEntries(sides.map(s => [s, textureRef])) },
            textures: { type: 'array', items: textureRef },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    const block = data.blocks.get(request.params.id)
    if (!block) throw fastify.httpErrors.notFound(`Unknown block ${request.params.id}`)
    const name = await useLang(fastify, data, request.query.lang)
    const version = data.meta.id
    const ref = (path: string) => ({ path, url: publicUrl(`/v2/minecraft/${version}/textures/${path}.png`) })

    setCaching(reply, alias, data.meta.builtAt, `block:${block.id}:${request.query.lang}`)
    return {
      id: block.id,
      name: name(block.translationKey),
      translationKey: block.translationKey,
      item: block.item ? publicUrl(`/v2/minecraft/${version}/items/${block.id}`) : null,
      model: block.model,
      particle: block.particle ? ref(block.particle) : undefined,
      faces: Object.fromEntries(Object.entries(block.faces).map(([side, path]) => [side, ref(path)])),
      textures: block.textures.map(ref),
    }
  })
}

export default route
