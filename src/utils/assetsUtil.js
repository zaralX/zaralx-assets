const path = require('path')
const fs = require('fs').promises
const axios = require("axios");

async function init(fastify) {
    if (!fastify.loaded_assets) {
        const response = await axios.get(fastify.version_assets_url)
        fastify.decorate('loaded_assets', response.data.objects)
    }

    await init_lang(fastify)
    await init_categories(fastify)
}

async function init_categories(fastify) {
    try {
        const categories = JSON.parse(
            await fs.readFile(
                path.join('assets', 'item_categories.json'),
                {encoding: 'utf8'}
            )
        )

        fastify.decorate('categories', categories)
    } catch (error) {
        fastify.log.error('Failed to initialize categories:', error)
        // Initialize with empty categories to prevent null reference errors
        fastify.decorate('categories', {})
        throw error // Re-throw to be handled by the caller
    }
}

async function init_lang(fastify) {
    fastify.decorate('lang', {})

    // Preload en_us [Note: Exported from client.jar /assets/lang]
    fastify.lang.en_us = JSON.parse(
        await fs.readFile(
            path.join('assets', 'lang', 'en_us.json'),
            {encoding: 'utf8'}
        )
    )

    await preload_lang(fastify, "ru_ru")
}

async function preload_lang(fastify, id) {
    console.log(`Preloading lang ${id}`)

    const key = `minecraft/lang/${id}.json`
    const asset_hash = fastify.loaded_assets?.[key]?.hash

    if (!asset_hash) {
        return null;
    }

    // First 2 chars of hash
    const asset_hash_part = asset_hash.substring(0, 2)

    const url = fastify.download_mojang_asset_url
        .replace("%A", asset_hash_part)
        .replace("%B", asset_hash)

    const response = await axios.get(url)
    fastify.lang[id] = response.data
    console.log(`Preloaded ${id}`)
}

module.exports = {init, preload_lang}