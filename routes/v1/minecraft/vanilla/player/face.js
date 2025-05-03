'use strict'

const {isValidUUID} = require("../../../../../utils/uuidUtil");
const axios = require('axios');
const sharp = require('sharp');

module.exports = async function (fastify, opts) {
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    fastify.get('/face/:uuid', async function (request, reply) {
        const uuid = request.params.uuid;

        if (!isValidUUID(uuid)) {
            return reply.status(400).send({message: 'Invalid UUID'});
        }

        // Check cache first
        const cachedSkinFace = fastify.cache.skinFace.get(uuid);
        if (cachedSkinFace && Date.now() - cachedSkinFace.timestamp < CACHE_TTL) {
            reply.header('Content-Type', 'image/png');
            reply.header('Cache-Control', `public, max-age=${CACHE_TTL}`);
            return reply.send(cachedSkinFace.data);
        }

        try {
            let skin = fastify.cache.skin.get(uuid);
            if (!skin) {
                const skin_url = fastify.skin_url.replace("%A", uuid);
                const response = await axios.get(skin_url, {
                    responseType: 'arraybuffer'
                });
                skin = response.data;
                fastify.cache.skin.set(uuid, {
                    data: response.data,
                    timestamp: Date.now()
                });
            }

            const sharpSkin = sharp(skin.data);
            const skinFace = await sharpSkin.extract({left: 8, top: 8, width: 8, height: 8})
                .resize(256, 256, {kernel: sharp.kernel.nearest})
                .toBuffer();

            // Cache the skinFace data
            fastify.cache.skinFace.set(uuid, {
                data: skinFace,
                timestamp: Date.now()
            });

            // Set response headers
            reply.header('Content-Type', 'image/png');
            reply.header('Cache-Control', `public, max-age=${CACHE_TTL}`);

            return reply.send(skinFace);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                message: 'Failed to fetch skin',
                error: error.message
            });
        }
    });
}
