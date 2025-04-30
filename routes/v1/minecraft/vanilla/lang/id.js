'use strict'

module.exports = async function (fastify, opts) {
    fastify.get('/:id', async function (request, reply) {
        const id = request.params.id
        const lang_data = fastify.lang?.[id]

        if (!lang_data) {
            return reply.status(400).send({message: "Unknown lang", lang_keys: Object.keys(fastify.lang)})
        }

        return reply.status(200).send(lang_data)
    })
}
