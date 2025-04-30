'use strict'

module.exports = async function (fastify, opts) {
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
