'use strict'

const fp = require('fastify-plugin')

/**
 * This plugins adds some utilities for cookies
 *
 * @see https://github.com/fastify/fastify-cookie
 */
module.exports = fp(async function (fastify, opts) {
    fastify.register(require('@fastify/rate-limit'), {
        max: 250,
        timeWindow: "1 minute",
        keyGenerator: function (request) {
            try {
                return request.user.id;
            } catch (e) {
                return request.headers['x-real-ip'];
            }
        },
    })
})
