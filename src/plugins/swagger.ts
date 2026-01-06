import fp from 'fastify-plugin'
import fastifySwagger, {FastifySwaggerOptions} from '@fastify/swagger'

/**
 * Swagger documentation generator for Fastify
 *
 * @see https://github.com/fastify/fastify-swagger
 */
export default fp<FastifySwaggerOptions>(async (fastify) => {
    fastify.register(fastifySwagger, {
        openapi: {
            info: {
                title: 'zaralX Assets',
                description: 'Swagger for zaralX Assets documentation',
                version: '1.1.0'
            },
            servers: [{
                url: 'https://assets.zaralx.ru/api'
            }]
        },
    })
})
