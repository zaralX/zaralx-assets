import {FastifyPluginAsync} from 'fastify'

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/swagger', async function (request, reply) {
        return fastify.swagger()
    })
}

export default root
