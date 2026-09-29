import type { FastifyPluginAsync } from 'fastify'
import type { VersionData } from '../../../../catalog/catalog'
import { hasIcon, ICON_SIZES, type ItemEntry } from '../../../../catalog/types'
import { formatQuery, idParam, imageResponse, langQuery, sizeQuery, textureRef, versionParam } from '../../../../schemas/v2'
import { blobUrl, publicUrl, sendImage, setCaching, useLang, useVersion, versionCaching } from '../../../../utils/http'
import type { ImageFormat } from '../../../../utils/images'

interface ItemParams {
  version: string
  id: string
}

const itemSummary = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    category: { type: 'string' },
    icon: { type: ['string', 'null'] },
  },
} as const

function iconUrl(version: string, item: ItemEntry) {
  return hasIcon(item) ? publicUrl(`/v2/minecraft/${version}/items/${item.id}/icon`) : null
}

function describe(data: VersionData, item: ItemEntry, name: (key: string) => string) {
  const version = data.meta.id
  return {
    id: item.id,
    name: name(item.translationKey),
    translationKey: item.translationKey,
    category: data.itemTabs.get(item.id),
    block: item.block ? publicUrl(`/v2/minecraft/${version}/blocks/${item.id}`) : null,
    icon: iconUrl(version, item),
    missingIconReason: hasIcon(item) ? undefined : data.meta.missingIcons[item.id],
    iconBlobs: Object.fromEntries(Object.entries(item.icons).map(([size, hash]) => [size, blobUrl(hash, 'webp')])),
    textures: item.textures.map(path => ({ path, url: publicUrl(`/v2/minecraft/${version}/textures/${path}.png`) })),
  }
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { version: string }, Querystring: { lang: string, category?: string, q?: string } }>('/items', {
    schema: {
      summary: 'List items',
      tags: ['items'],
      description: 'All items of a version',
      params: { type: 'object', required: ['version'], properties: { version: versionParam } },
      querystring: {
        type: 'object',
        properties: {
          lang: langQuery,
          category: { type: 'string', description: 'Creative tab, see /creative-tabs', examples: ['building_blocks'] },
          q: { type: 'string', maxLength: 64, description: 'Substring of the id or the localized name' },
        },
      },
      response: { 200: { type: 'array', items: itemSummary } },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    const { lang, category, q } = request.query
    const name = await useLang(fastify, data, lang)
    const query = q?.toLowerCase()

    let items = [...data.items.values()]
    if (category) items = items.filter(i => data.itemTabs.get(i.id) === category)
    const result = items
      .map(i => ({ id: i.id, name: name(i.translationKey), category: data.itemTabs.get(i.id), icon: iconUrl(data.meta.id, i) }))
      .filter(i => !query || i.id.includes(query) || i.name.toLowerCase().includes(query))

    setCaching(reply, alias, data.meta.builtAt, `items:${lang}`)
    return result
  })

  fastify.get<{ Params: ItemParams, Querystring: { lang: string } }>('/items/:id', {
    schema: {
      summary: 'Item',
      tags: ['items'],
      description: 'Item details: localized name, creative tab, icon and the textures its model uses',
      params: { type: 'object', required: ['version', 'id'], properties: { version: versionParam, id: { ...idParam, examples: ['diamond_sword'] } } },
      querystring: { type: 'object', properties: { lang: langQuery } },
      response: {
        200: {
          type: 'object',
          properties: {
            ...itemSummary.properties,
            translationKey: { type: 'string' },
            block: { type: ['string', 'null'] },
            missingIconReason: { type: 'string' },
            iconBlobs: { type: 'object', description: 'Content-addressed icon per size, shared by all versions', additionalProperties: { type: 'string' } },
            textures: { type: 'array', items: textureRef },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    const item = data.items.get(request.params.id)
    if (!item) throw fastify.httpErrors.notFound(`Unknown item ${request.params.id}`)
    const name = await useLang(fastify, data, request.query.lang)
    setCaching(reply, alias, data.meta.builtAt, `item:${item.id}:${request.query.lang}`)
    return describe(data, item, name)
  })

  fastify.get<{ Params: ItemParams, Querystring: { size?: number, format: ImageFormat } }>('/items/:id/icon', {
    schema: {
      summary: 'Item icon',
      tags: ['items'],
      description: 'Item icon as rendered in an inventory slot (256px by default)\n\n![diamond_block](https://assets.zaralx.ru/api/v2/minecraft/latest/items/diamond_block/icon?size=64)',
      params: { type: 'object', required: ['version', 'id'], properties: { version: versionParam, id: { ...idParam, examples: ['diamond_block'] } } },
      querystring: { type: 'object', properties: { size: sizeQuery, format: formatQuery } },
      response: imageResponse,
    },
    config: { rateLimit: { max: 5000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { data, alias } = await useVersion(fastify, request.params.version)
    const item = data.items.get(request.params.id)
    if (!item) throw fastify.httpErrors.notFound(`Unknown item ${request.params.id}`)
    if (!hasIcon(item)) throw fastify.httpErrors.notFound(`No icon for ${item.id}: ${data.meta.missingIcons[item.id] ?? 'unknown reason'}`)
    const size = request.query.size ?? 256
    const source = ICON_SIZES.find(s => s >= size) ?? ICON_SIZES.at(-1)!
    const hash = item.icons[source]!
    return sendImage(request, reply, {
      file: fastify.catalog.iconFile(item, source)!,
      width: size === source ? undefined : size,
      format: request.query.format,
    }, hash, versionCaching(alias))
  })
}

export default route
