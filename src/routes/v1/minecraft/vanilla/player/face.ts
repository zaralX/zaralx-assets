import {FastifyPluginAsync} from "fastify";
import {isValidUUID} from "../../../../../utils/uuidUtil";
import axios from 'axios';
import sharp from 'sharp';
import path from "path";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    const FULL_FACE_RESIZE = 8;

    fastify.get('/face/:uuid', async function (request, reply) {
        const uuid = (request.params as any).uuid;

        if (!isValidUUID(uuid)) {
            return reply.status(400).send({message: 'Invalid UUID'});
        }

        // Check cache first
        const cachedSkinFace = (fastify as any).cache.skinFace.get(uuid);
        if (cachedSkinFace && Date.now() - cachedSkinFace.timestamp < CACHE_TTL) {
            reply.header('Content-Type', 'image/png');
            reply.header('Cache-Control', `public, max-age=${CACHE_TTL}`);
            return reply.send(cachedSkinFace.data);
        }

        try {
            let skin = (fastify as any).cache.skin.get(uuid);
            if (!skin) {
                const skin_url = (fastify as any).skin_url.replace("%A", uuid);
                const response = await axios.get(skin_url, {
                    responseType: 'arraybuffer'
                });
                skin = {
                    data: response.data,
                    timestamp: Date.now()
                };
                (fastify as any).cache.skin.set(uuid, skin);
            }

            const sharpSkin = sharp(skin.data);
            const skinFace = await sharpSkin.extract({left: 8, top: 8, width: 8, height: 8})
                .resize(256, 256, {kernel: sharp.kernel.nearest})
                .toBuffer();

            // Cache the skinFace data
            (fastify as any).cache.skinFace.set(uuid, {
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
                error: (error as any).message
            });
        }
    });

    fastify.get('/face/:uuid/full', async function (request, reply) {
        const uuid = (request.params as any).uuid;

        if (!isValidUUID(uuid)) {
            return reply.status(400).send({message: 'Invalid UUID'});
        }

        // Check cache first
        const cachedSkinFullFace = (fastify as any).cache.skinFullFace.get(uuid);
        if (cachedSkinFullFace && Date.now() - cachedSkinFullFace.timestamp < CACHE_TTL) {
            reply.header('Content-Type', 'image/png');
            reply.header('Cache-Control', `public, max-age=${CACHE_TTL}`);
            return reply.send(cachedSkinFullFace.data);
        }

        try {
            let skin = (fastify as any).cache.skin.get(uuid);
            if (!skin) {
                const skin_url = (fastify as any).skin_url.replace("%A", uuid);
                const response = await axios.get(skin_url, {
                    responseType: 'arraybuffer'
                });
                skin = {
                    data: response.data,
                    timestamp: Date.now()
                };
                (fastify as any).cache.skin.set(uuid, skin);
            }

            const sharpSkin = sharp(skin.data);

            const layer0 = await sharpSkin.clone().extract({left: 56, top: 8, width: 8, height: 8})
                .resize(256, 256, {kernel: sharp.kernel.nearest})
                .toBuffer();

            const layer1 = await sharpSkin.clone().extract({left: 8, top: 8, width: 8, height: 8})
                .resize(256 - FULL_FACE_RESIZE, 256 - FULL_FACE_RESIZE, {kernel: sharp.kernel.nearest})
                .toBuffer();

            const layer2 = await sharpSkin.clone().extract({left: 40, top: 8, width: 8, height: 8})
                .resize(256, 256, {kernel: sharp.kernel.nearest})
                .toBuffer();

            const skinFullFace = await sharp(path.join('assets', 'empty.png'))
                .resize(256, 256)
                .composite([
                    {input: layer0, left: 0, top: 0},
                    {input: layer1, left: FULL_FACE_RESIZE / 2, top: FULL_FACE_RESIZE / 2},
                    {input: layer2, left: 0, top: 0},
                ])
                .toBuffer();

            // Cache the skinFullFace data
            (fastify as any).cache.skinFullFace.set(uuid, {
                data: skinFullFace,
                timestamp: Date.now()
            });

            // Set response headers
            reply.header('Content-Type', 'image/png');
            reply.header('Cache-Control', `public, max-age=${CACHE_TTL}`);

            return reply.send(skinFullFace);
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                message: 'Failed to fetch skin',
                error: (error as any).message
            });
        }
    });
}

export default route
