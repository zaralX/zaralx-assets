import {FastifyPluginAsync} from 'fastify'

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/swagger', {
        schema: {
            description: 'Get OpenAPI/Swagger specification for the API',
            response: {
                200: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'OpenAPI 3.0 specification document'
                }
            }
        }
    }, async function (request, reply) {
        return reply.status(200).send(fastify.swagger())
    })
}

export default root
