import type { FastifyPluginAsync } from 'fastify'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get('/swagger', { schema: { hide: true } }, async () => fastify.swagger())
}

export default route
