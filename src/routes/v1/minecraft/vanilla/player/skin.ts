import {isValidUUID} from "../../../../../utils/uuidUtil";
import axios from 'axios';
import {FastifyPluginAsync} from "fastify";
import {isValidMinecraftNickname, nicknameToUUID} from "../../../../../utils/nicknameUtil";


const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    fastify.get('/skin/:identifier', {
        schema: {
            description: 'Get player skin image by UUID or nickname',
            params: {
                type: 'object',
                required: ['identifier'],
                properties: {
                    identifier: {
                        type: 'string',
                        description: 'Player UUID or Minecraft nickname',
                        examples: ['069a79f4-44e9-4726-a5fa-f2b5e5e5e5e5', 'Notch']
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    description: '![Example](https://assets.zaralx.ru/api/v1/minecraft/vanilla/player/skin/_zaralX_)',
                    content: {
                        'image/png': {
                            schema: {
                                type: 'string',
                                format: 'binary'
                            }
                        }
                    }
                },
                400: {
                    type: 'object',
                    description: 'Bad request - invalid UUID or nickname',
                    properties: {
                        message: {
                            type: 'string',
                            example: 'Invalid UUID or Nickname'
                        }
                    }
                },
                500: {
                    type: 'object',
                    description: 'Internal server error',
                    properties: {
                        message: {
                            type: 'string',
                            example: 'Failed to fetch skin'
                        },
                        error: {
                            type: 'string',
                            description: 'Error message'
                        }
                    }
                }
            }
        }
    }, async function (request, reply) {
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
