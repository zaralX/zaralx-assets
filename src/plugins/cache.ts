import fp from 'fastify-plugin'
import fastifyRedis from '@fastify/redis'
import { config } from '../config'
import { MemoryCache, RedisCache, type KeyValueCache } from '../utils/cache'

declare module 'fastify' {
  interface FastifyInstance {
    cache: KeyValueCache
  }
}

export default fp(async (fastify) => {
  if (!config.redisUrl) {
    fastify.log.warn('REDIS_URL/REDIS_HOST is not set, player data is cached in memory')
    fastify.decorate('cache', new MemoryCache())
    return
  }
  await fastify.register(fastifyRedis, { url: config.redisUrl })
  fastify.decorate('cache', new RedisCache(fastify.redis))
}, { name: 'cache' })
