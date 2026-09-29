import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifySchema } from 'fastify'
import fp from 'fastify-plugin'
import fastifySwagger from '@fastify/swagger'
import { config } from '../config'

const { version } = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as { version: string }

interface RouteSchema {
  params?: { properties?: Record<string, unknown>, required?: string[] }
  [key: string]: unknown
}

// Wildcard routes show up as {*} and prefix routes with a trailing slash
function cleanRoute(url: string, schema: RouteSchema | undefined) {
  if (url.endsWith('/*') && schema?.params?.properties?.['*']) {
    const { '*': wildcard, ...properties } = schema.params.properties
    schema = {
      ...schema,
      params: {
        ...schema.params,
        properties: { ...properties, path: wildcard },
        required: schema.params.required?.map(name => (name === '*' ? 'path' : name)),
      },
    }
    url = `${url.slice(0, -1)}:path`
  }
  return { url: url.length > 1 ? url.replace(/\/$/, '') : url, schema }
}

export default fp(async (fastify) => {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'zaralX Assets',
        description: 'Minecraft item icons, block textures, languages and player skins',
        version,
      },
      servers: [{ url: config.publicUrl }],
      tags: [
        { name: 'versions', description: 'Built versions. `{version}` in other routes is a version id, `latest` or `latest-snapshot`' },
        { name: 'items', description: 'Items, their names and icons rendered like in an inventory slot' },
        { name: 'blocks', description: 'Textures of each block side, separately from the icon' },
        { name: 'textures', description: 'Every vanilla texture as it is in the game files' },
        { name: 'lang', description: 'Translations of every game language' },
        { name: 'players', description: 'Skins and faces by nickname or UUID' },
        { name: 'v1', description: 'Legacy routes, served from a fixed version' },
      ],
    },
    transform: ({ schema, url }) => {
      const route = cleanRoute(url, schema as RouteSchema | undefined)
      return { url: route.url, schema: route.schema as FastifySchema }
    },
  })
})
