import fp from 'fastify-plugin'
import fastifyRedis, {FastifyRedisPluginOptions} from '@fastify/redis'

/**
 * This plugin adds cors rules
 *
 * @see https://github.com/fastify/fastify-cors
 */
export default fp<FastifyRedisPluginOptions>(async (fastify) => {
    fastify.register(fastifyRedis, { host: '127.0.0.1' }).then(() => {
        fastify.log.info("Redis is connected")
        fastify.redis.on("close", () => {
            fastify.log.info("Redis is disconnected")
        })
    })
})
