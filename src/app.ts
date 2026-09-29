import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import type { FastifyPluginAsync } from 'fastify'

const app: FastifyPluginAsync = async (fastify) => {
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
  })

  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    routeParams: true,
  })
}

export default app
