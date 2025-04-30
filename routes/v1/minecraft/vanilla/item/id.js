'use strict'

const path = require('path')
const fs = require('fs').promises

// In-memory cache for item images
const imageCache = new Map()

// Preload all images into memory
async function preloadImages() {
  const itemsDir = path.join('assets', 'items')
  const files = await fs.readdir(itemsDir)

  for (const file of files) {
    if (file.endsWith('.webp')) {
      const itemId = file.replace('.webp', '')
      const imagePath = path.join(itemsDir, file)
      const buffer = await fs.readFile(imagePath)
      imageCache.set(itemId, buffer)
    }
  }
}

module.exports = async function (fastify, opts) {
  // Preload all images on server start
  await preloadImages()
  console.log(`Preloaded ${imageCache.size} item images into memory`)

  fastify.get('/:id', async function (request, reply) {
    const itemId = request.params.id

    // Get image from memory cache
    const imageBuffer = imageCache.get(itemId)

    if (!imageBuffer) {
      reply.code(404)
      return {error: 'Item not found'}
    }

    // Set cache headers for 1 day since images never change
    reply.header('Cache-Control', 'public, max-age=86400')
    reply.header('Content-Type', 'image/webp')

    return reply.send(imageBuffer)
  })
}
