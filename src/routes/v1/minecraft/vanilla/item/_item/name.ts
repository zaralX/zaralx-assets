import {FastifyPluginAsync} from "fastify";

const search_in = ["item.minecraft.%A", "block.minecraft.%A"]

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/lang/:lang/name', {
        schema: {
            description: 'Get the localized name of an item in a specific language',
            params: {
                type: 'object',
                required: ['item', 'lang'],
                properties: {
                    item: {
                        type: 'string',
                        description: 'The item identifier',
                        examples: ['diamond_block', 'carrot']
                    },
                    lang: {
                        type: 'string',
                        description: 'The language code',
                        examples: ['en_us', 'ru_ru']
                    }
                }
            },
            response: {
                200: {
                    type: 'string',
                    description: 'The localized item name'
                },
                400: {
                    type: 'object',
                    description: 'Bad request - unknown language or item not found',
                    properties: {
                        message: {
                            type: 'string',
                            examples: ['Unknown lang', 'Not found item name']
                        },
                        lang_keys: {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: 'Available language keys (only present when language is unknown)'
                        }
                    }
                }
            }
        }
    }, async function (request, reply) {
        const item = (request.params as any).item
        const lang = (request.params as any).lang
        const lang_data = (fastify as any).lang?.[lang]

        if (!lang_data) {
            return reply.status(400).send({message: "Unknown lang", lang_keys: Object.keys((fastify as any).lang)})
        }


        for (const search_key of search_in) {
            const key = search_key.replace("%A", item)
            const value = lang_data[key]
            if (value) {
                return reply.status(200).send(value)
            }
        }

        return reply.status(400).send({message: `Not found item name`})
    })
}

export default route
