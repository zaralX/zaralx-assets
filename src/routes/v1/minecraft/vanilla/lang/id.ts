import {FastifyPluginAsync} from "fastify";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/:id', {
        schema: {
            description: 'Get language data by language identifier',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'The language identifier',
                        examples: ['en_us', 'ru_ru']
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Language data object containing all translations'
                },
                400: {
                    type: 'object',
                    description: 'Bad request - unknown language',
                    properties: {
                        message: {
                            type: 'string',
                            example: 'Unknown lang'
                        },
                        lang_keys: {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: 'Available language keys'
                        }
                    }
                }
            }
        }
    }, async function (request, reply) {
        const id = (request.params as any).id
        const lang_data = (fastify as any).lang?.[id]

        if (!lang_data) {
            return reply.status(400).send({message: "Unknown lang", lang_keys: Object.keys((fastify as any).lang)})
        }

        return reply.status(200).send(lang_data)
    })
}

export default route
