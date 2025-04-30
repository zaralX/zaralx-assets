'use strict'

const search_in = ["item.minecraft.%A", "block.minecraft.%A"]

module.exports = async function (fastify, opts) {
    fastify.get('/lang/:lang/name', async function (request, reply) {
        const item = request.params.item
        const lang = request.params.lang
        const lang_data = fastify.lang?.[lang]

        if (!lang_data) {
            return reply.status(400).send({message: "Unknown lang", lang_keys: Object.keys(fastify.lang)})
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
