import fp from 'fastify-plugin'
import fastifyCompress from '@fastify/compress'

export default fp(async (fastify) => {
  await fastify.register(fastifyCompress, {
    threshold: 1024,
    encodings: ['br', 'gzip', 'deflate'],
  })
})
