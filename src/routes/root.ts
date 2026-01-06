import {FastifyPluginAsync} from 'fastify'

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/', async function (request, reply) {
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
