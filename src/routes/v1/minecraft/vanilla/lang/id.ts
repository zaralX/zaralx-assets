import {FastifyPluginAsync} from "fastify";

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/:id', async function (request, reply) {
        const id = (request.params as any).id
        const lang_data = (fastify as any).lang?.[id]

        if (!lang_data) {
            return reply.status(400).send({message: "Unknown lang", lang_keys: Object.keys((fastify as any).lang)})
        }

        return reply.status(200).send(lang_data)
    })
}

export default route
