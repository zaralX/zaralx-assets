import Fastify from 'fastify'
import app from './app'
import { config } from './config'

async function main() {
  const fastify = Fastify({
    logger: { level: config.logLevel },
    trustProxy: config.trustProxy,
    // OpenAPI annotation, not a validation keyword
    ajv: { customOptions: { keywords: ['example'] } },
  })
  await fastify.register(app)

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      fastify.log.info(`${signal} received, shutting down`)
      fastify.close().then(() => process.exit(0), () => process.exit(1))
    })
  }

  await fastify.listen({ host: config.host, port: config.port })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
