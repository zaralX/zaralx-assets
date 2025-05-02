'use strict'

const {isValidUUID} = require("../../../../../utils/uuidUtil");
const axios = require('axios');

module.exports = async function (fastify, opts) {
    const skinCache = new Map();
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    fastify.get('/skin/:uuid', async function (request, reply) {
        const uuid = request.params.uuid;

        if (!isValidUUID(uuid)) {
            return reply.status(400).send({message: 'Invalid UUID'});
        }

        // Check cache first
        const cachedSkin = skinCache.get(uuid);
        if (cachedSkin && Date.now() - cachedSkin.timestamp < CACHE_TTL) {
            reply.header('Content-Type', 'image/png');
            reply.header('Cache-Control', `public, max-age=${CACHE_TTL}`);
            return reply.send(cachedSkin.data);
        }

        try {
            const skin_url = fastify.skin_url.replace("%A", uuid);
            const response = await axios.get(skin_url, {
                responseType: 'arraybuffer'
            });

            // Cache the skin data
            skinCache.set(uuid, {
                data: response.data,
                timestamp: Date.now()
            });

            // Set response headers
            reply.header('Content-Type', 'image/png');
            reply.header('Cache-Control', `public, max-age=${CACHE_TTL}`);

            return reply.send(response.data);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                message: 'Failed to fetch skin',
                error: error.message
            });
        }
    });
}
