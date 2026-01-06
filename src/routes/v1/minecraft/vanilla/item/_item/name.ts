import {FastifyPluginAsync} from "fastify";

const search_in = ["item.minecraft.%A", "block.minecraft.%A"]

const route: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.get('/lang/:lang/name', async function (request, reply) {
        const item = (request.params as any).item
        const lang = (request.params as any).lang
        const lang_data = (fastify as any).lang?.[lang]

        if (!lang_data) {
            return reply.status(400).send({message: "Unknown lang", lang_keys: Object.keys((fastify as any).lang)})
        }


        for (const search_key of search_in) {
            const key = search_key.replace("%A", item)
            const value = lang_data[key]
            if (value) {
                return reply.status(200).send(value)
            }
        }

        return reply.status(400).send({message: `Not found item name`})
    })
}

export default route
