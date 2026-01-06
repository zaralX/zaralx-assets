import {FastifyPluginAsync} from 'fastify'

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/', {
        schema: {
            description: 'Get API information and version details',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Project information message'
                        },
                        sources: {
                            type: 'object',
                            properties: {
                                vanilla: {
                                    type: 'object',
                                    properties: {
                                        version: {
                                            type: 'string',
                                            description: 'Minecraft vanilla version',
                                            example: '1.21.5'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async function (request, reply) {
        return {
            message: "Open source project. Github: https://github.com/zaralX/zaralx-assets",
            sources: {
                vanilla: {
                    version: "1.21.5"
                }
            }
        }
    })
}

export default root
