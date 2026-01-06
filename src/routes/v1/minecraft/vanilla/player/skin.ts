import {isValidUUID} from "../../../../../utils/uuidUtil";
import axios from 'axios';
import {FastifyPluginAsync} from "fastify";
import {isValidMinecraftNickname, nicknameToUUID} from "../../../../../utils/nicknameUtil";


const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    fastify.get('/skin/:identifier', async function (request, reply) {
        const identifier: string = (request.params as any).identifier;

        const isUuid = isValidUUID(identifier)
        const isNickname = isValidMinecraftNickname(identifier)

        if (!isUuid && !isNickname) {
            return reply.status(400).send({message: 'Invalid UUID or Nickname'});
        }

        const uuid = isUuid ? identifier : await nicknameToUUID(fastify, identifier)

        // Check cache first
        const cachedSkin = (fastify as any).cache.skin.get(uuid);
        if (cachedSkin && Date.now() - cachedSkin.timestamp < CACHE_TTL) {
            reply.header('Content-Type', 'image/png');
            reply.header('Cache-Control', `public, max-age=${CACHE_TTL}`);
            return reply.send(cachedSkin.data);
        }

        try {
            const skin_url = (fastify as any).skin_url.replace("%A", uuid);
            const response = await axios.get(skin_url, {
                responseType: 'arraybuffer'
            });

            // Cache the skin data
            (fastify as any).cache.skin.set(uuid, {
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
                error: (error as any).message
            });
        }
    });
}

export default route
