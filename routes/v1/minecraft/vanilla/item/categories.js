'use strict'

const path = require('path')
const fs = require('fs').promises
const {createReadStream} = require('fs')

let categories = {}

module.exports = async function (fastify, opts) {
    // Preload categories
    categories = JSON.parse(
        await fs.readFile(
            path.join('assets', 'item_categories.json'),
            {encoding: 'utf8'}
        )
    )

    fastify.get('/categories', async function (request, reply) {
        reply.send(categories)
    })
}
