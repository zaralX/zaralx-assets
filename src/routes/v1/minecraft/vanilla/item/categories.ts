import {FastifyPluginAsync} from "fastify";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/categories', async function (request, reply) {
        try {
            if (!(fastify as any).categories) {
                return reply.status(503).send({
                    error: 'Categories not initialized',
                    message: 'The categories data is not yet available. Please try again in a few moments.'
                })
            }
            return reply.status(200).send((fastify as any).categories)
        } catch (error) {
            fastify.log.error(error)
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'An error occurred while retrieving categories'
            })
        }
    })
}

export default route
