import type { FastifyPluginAsync } from 'fastify'
import { TEXTURE_PATH_PATTERN } from '../../../../catalog/paths'
import { formatQuery, imageResponse, sizeQuery, versionParam } from '../../../../schemas/v2'
import { blobUrl, publicUrl, sendImage, setCaching, useVersion, versionCaching } from '../../../../utils/http'
import { IMAGE_FORMATS, type ImageFormat } from '../../../../utils/images'

interface TextureQuery {
  size?: number
  format?: ImageFormat
  frame?: number
  strip?: boolean
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { version: string }, Querystring: { prefix?: string } }>('/textures', {
    schema: {
      summary: 'List textures',
      tags: ['textures'],
      description: 'Every vanilla texture (assets/minecraft/textures) of a version',
      params: { type: 'object', required: ['version'], properties: { version: versionParam } },
      querystring: {
        type: 'object',
        properties: { prefix: { type: 'string', maxLength: 128, examples: ['block/', 'item/', 'entity/chest/'] } },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              width: { type: 'integer' },
              height: { type: 'integer' },
              frames: { type: 'integer', description: 'Animation frames stacked vertically' },
              url: { type: 'string' },
              blob: { type: 'string', description: 'Content-addressed file, shared by all versions' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    const prefix = request.query.prefix ?? ''
    setCaching(reply, alias, data.meta.builtAt, `textures:${prefix}`)
    return [...data.textures.values()]
      .filter(t => t.path.startsWith(prefix))
      .map(t => ({
        path: t.path,
        width: t.width,
        height: t.height,
        frames: t.frames,
        url: publicUrl(`/v2/minecraft/${data.meta.id}/textures/${t.path}.png`),
        blob: blobUrl(t.hash, 'png'),
      }))
  })

  fastify.get<{ Params: { 'version': string, '*': string }, Querystring: TextureQuery }>('/textures/*', {
    schema: {
      summary: 'Texture',
      tags: ['textures'],
      description: 'A texture as it is in the game files. Animated textures return their first frame unless `frame` or `strip` is given. '
        + 'The extension picks the format (.png or .webp), `format` overrides it.\n\n'
        + '![stone](https://assets.zaralx.ru/api/v2/minecraft/latest/textures/block/stone.png?size=64)',
      params: {
        type: 'object',
        required: ['version', '*'],
        properties: { 'version': versionParam, '*': { type: 'string', examples: ['block/stone.png', 'item/diamond.webp'] } },
      },
      querystring: {
        type: 'object',
        properties: {
          size: sizeQuery,
          format: { ...formatQuery, default: undefined },
          frame: { type: 'integer', minimum: 0, description: 'Animation frame' },
          strip: { type: 'boolean', description: 'Return the whole animation strip' },
        },
      },
      response: imageResponse,
    },
    config: { rateLimit: { max: 5000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    const match = /^(.*?)(?:\.(png|webp))?$/.exec(request.params['*'])!
    const path = match[1]
    const format = request.query.format ?? (match[2] as ImageFormat | undefined) ?? 'png'
    const texture = TEXTURE_PATH_PATTERN.test(path) ? data.textures.get(path) : undefined
    if (!texture || !IMAGE_FORMATS.includes(format)) throw fastify.httpErrors.notFound(`Unknown texture ${path}`)

    let frame
    if (texture.frames > 1 && !request.query.strip) {
      const index = request.query.frame ?? 0
      if (index >= texture.frames) throw fastify.httpErrors.badRequest(`${path} has ${texture.frames} frames`)
      frame = { index, width: texture.width, height: texture.height / texture.frames }
    }
    return sendImage(request, reply, {
      file: fastify.catalog.textureFile(texture),
      width: request.query.size,
      format,
      frame,
    }, texture.hash, versionCaching(alias))
  })
}

export default route
