import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import fp from 'fastify-plugin'
import fastifySwagger from '@fastify/swagger'
import { config } from '../config'

const { version } = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as { version: string }

export default fp(async (fastify) => {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'zaralX Assets',
        description: 'Minecraft assets API: item icons rendered like in game, block textures, languages and player skins for every supported version.',
        version,
      },
      servers: [{ url: config.publicUrl }],
      tags: [
        { name: 'versions', description: 'Built Minecraft versions' },
        { name: 'items' },
        { name: 'blocks' },
        { name: 'textures' },
        { name: 'lang' },
        { name: 'players' },
        { name: 'v1', description: 'Legacy routes, served from a fixed version' },
      ],
    },
  })
})
