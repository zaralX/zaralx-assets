'use strict'

const fp = require('fastify-plugin')

/**
 * This plugins adds cors rules
 *
 * @see https://github.com/fastify/fastify-cors
 */
module.exports = fp(async function (fastify, opts) {
    fastify.register(require('@fastify/cors'), {
        origin: true,
        credentials: true,
        methods: ['GET'],
    })
})
