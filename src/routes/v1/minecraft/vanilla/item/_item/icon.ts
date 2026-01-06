import {FastifyPluginAsync} from "fastify";
import path from 'path';
import {createReadStream} from 'fs';

const fs = require('fs').promises

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/icon', {
        schema: {
            params: {
                type: 'object',
                required: ['item'],
                properties: {
                    item: { type: 'string', description: 'The item identifier', examples: ['diamond_block', 'carrot'] }
                }
            },
            response: {
                200: {
                    type: 'object',
                    description: '![Example](https://assets.zaralx.ru/api/v1/minecraft/vanilla/item/diamond_block/icon)',
                    content: {
                        'image/webp': {
                            schema: {
                                type: 'string',
                                format: 'binary'
                            }
                        }
                    }
                },
                404: {
                    description: 'Item not found',
                    type: 'object'
                }
            }
        },
        config: {
            rateLimit: {
                timeWindow: '1 minute',
                max: 5000
            }
        }
    }, async function (request, reply) {
        const itemId = (request.params as any).item
        const imagePath = path.join('assets', 'items', `${itemId}.webp`)

        try {
            // Check if file exists
            await fs.access(imagePath)

            // Set cache headers for 1 day
            reply.header('Cache-Control', 'public, max-age=86400')
            reply.header('Content-Type', 'image/webp')

            // Create and send the file stream
            const stream = createReadStream(imagePath)
            return reply.send(stream)
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                reply.code(404)
                return {error: 'Item not found'}
            }
            throw err
        }
    })
}

export default route
