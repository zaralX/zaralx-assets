'use strict'

const path = require('node:path')
const AutoLoad = require('@fastify/autoload')
const assetsUtil = require('./utils/assetsUtil')

// Pass --options via CLI arguments in command to enable these options.
const options = {}

module.exports = async function (fastify, opts) {
  fastify.decorate('download_mojang_asset_url', 'https://resources.download.minecraft.net/%A/%B')

  // ASSETS VERSION - 1.21.5
  fastify.decorate('version_assets_url', 'https://piston-meta.mojang.com/v1/packages/3cd0a438b150f32a5cd8170ac19c56cb8736cfaa/24.json')

  // Mojang API has small rate limit. Mineskin - database with skins
  fastify.decorate('skin_url', 'https://mineskin.eu/skin/%A')

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  await assetsUtil.init(fastify)

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    routeParams: true,
    options: Object.assign({}, opts)
  })
}

module.exports.options = options
