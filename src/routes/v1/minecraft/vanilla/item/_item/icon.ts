import {FastifyPluginAsync} from "fastify";
import path from 'path';
import {createReadStream} from 'fs';

const fs = require('fs').promises

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/icon', {
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
