'use strict'

const path = require('path')
const fs = require('fs').promises
const {createReadStream} = require('fs')

module.exports = async function (fastify, opts) {
  fastify.get('/icon', async function (request, reply) {
    const itemId = request.params.item
    const imagePath = path.join('assets', 'items', `${itemId}.webp`)

    try {
      // Check if file exists
      await fs.access(imagePath)

      // Set cache headers for 1 day
      reply.header('Cache-Control', 'public, max-age=86400')
      reply.header('Content-Type', 'image/webp')

      // Create and send the file stream
      const stream = createReadStream(imagePath)
      return reply.send(stream)
    } catch (err) {
      if (err.code === 'ENOENT') {
        reply.code(404)
        return {error: 'Item not found'}
      }
      throw err
    }
  })
}
