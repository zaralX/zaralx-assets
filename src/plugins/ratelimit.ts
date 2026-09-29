import fp from 'fastify-plugin'
import fastifyRateLimit from '@fastify/rate-limit'
import { config } from '../config'

export default fp(async (fastify) => {
  await fastify.register(fastifyRateLimit, {
    max: 250,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // X-Real-IP can be spoofed unless we are behind our proxy
      const realIp = config.trustProxy ? request.headers['x-real-ip'] : undefined
      return typeof realIp === 'string' ? realIp : request.ip
    },
  })
})
