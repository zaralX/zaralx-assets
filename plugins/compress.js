'use strict'

const fp = require('fastify-plugin')

/**
 * Adds compression utils to the Fastify reply object and
 * a hook to decompress requests payloads.
 * Supports gzip, deflate, and brotli.
 *
 * @see https://github.com/fastify/fastify-compress
 */
module.exports = fp(async function (fastify, opts) {
    fastify.register(require('@fastify/compress'), {
        threshold: 1024,
        encodings: ['gzip', 'deflate']
    })
})
