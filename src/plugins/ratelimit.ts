import fp from 'fastify-plugin';
import fastifyRatelimit, {FastifyRateLimitOptions} from "@fastify/rate-limit";

/**
 * This plugin adds some utilities for cookies
 *
 * @see https://github.com/fastify/fastify-cookie
 */
export default fp<FastifyRateLimitOptions>(async (fastify) => {
    fastify.register(fastifyRatelimit, {
        max: 250,
        timeWindow: "1 minute",
        keyGenerator: (request) => {
            const ip = request.headers['x-real-ip'] || request.ip
            return typeof ip === 'string' ? ip : 'unknown-ip'
        },
    })
})