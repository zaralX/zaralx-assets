import {FastifyPluginAsync} from "fastify";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/categories', {
        schema: {
            description: 'Get all categories with items',
            response: {
                200: {
                    type: 'object',
                    description: 'Categories data object',
                    required: [
                        'tools_and_utilities',
                        'building_blocks',
                        'food_and_drinks',
                        'natural_blocks',
                        'op_blocks',
                        'functional_blocks',
                        'spawn_eggs',
                        'redstone_blocks',
                        'colored_blocks',
                        'ingredients',
                        'combat'
                    ],
                    properties: {
                        tools_and_utilities: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        building_blocks: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        food_and_drinks: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        natural_blocks: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        op_blocks: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        functional_blocks: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        spawn_eggs: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        redstone_blocks: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        colored_blocks: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        ingredients: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        },
                        combat: {
                            type: 'array',
                            items: { type: 'string' },
                            uniqueItems: true
                        }
                    },
                    additionalProperties: false
                },
                503: {
                    type: 'object',
                    description: 'Service unavailable - categories not initialized',
                    properties: {
                        error: {
                            type: 'string',
                            example: 'Categories not initialized'
                        },
                        message: {
                            type: 'string',
                            example: 'The categories data is not yet available. Please try again in a few moments.'
                        }
                    }
                },
                500: {
                    type: 'object',
                    description: 'Internal server error',
                    properties: {
                        error: {
                            type: 'string',
                            example: 'Internal Server Error'
                        },
                        message: {
                            type: 'string',
                            example: 'An error occurred while retrieving categories'
                        }
                    }
                }
            }
        }
    }, async function (request, reply) {
        try {
            if (!(fastify as any).categories) {
                return reply.status(503).send({
                    error: 'Categories not initialized',
                    message: 'The categories data is not yet available. Please try again in a few moments.'
                })
            }
            return reply.status(200).send((fastify as any).categories)
        } catch (error) {
            fastify.log.error(error)
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'An error occurred while retrieving categories'
            })
        }
    })
}

export default route
