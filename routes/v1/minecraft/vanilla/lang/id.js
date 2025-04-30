'use strict'

const path = require('path')
const fs = require('fs').promises
const {createReadStream} = require('fs')
const axios = require("axios");

const download_mojang_asset_url = "https://resources.download.minecraft.net/%A/%B"
// ASSETS VERSION - 1.21.5
const version_assets_url = "https://piston-meta.mojang.com/v1/packages/3cd0a438b150f32a5cd8170ac19c56cb8736cfaa/24.json"

let loaded_assets = null
let lang = {}

async function preload_lang(id) {
    console.log(`Preloading lang ${id}`)
    if (!loaded_assets) {
        const response = await axios.get(version_assets_url)
        loaded_assets = response.data.objects
    }

    const key = `minecraft/lang/${id}.json`
    const asset_hash = loaded_assets?.[key]?.hash

    if (!asset_hash) {
        return null;
    }

    // First 2 chars of hash
    const asset_hash_part = asset_hash.substring(0, 2)

    const url = download_mojang_asset_url
        .replace("%A", asset_hash_part)
        .replace("%B", asset_hash)

    const response = await axios.get(url)
    lang[id] = response.data
    console.log(`Preloaded ${id}`)
}

module.exports = async function (fastify, opts) {
    // Preload en_us [Note: Exported from client.jar /assets/lang]
    lang.en_us = JSON.parse(
        await fs.readFile(
            path.join('assets', 'lang', 'en_us.json'),
            {encoding: 'utf8'}
        )
    )

    await preload_lang("ru_ru")

    fastify.get('/:id', async function (request, reply) {
        const id = request.params.id
        const lang_data = lang?.[id]

        if (!lang_data) {
            return reply.status(400).send({message: "Unknown lang", lang_keys: Object.keys(lang)})
        }

        return reply.status(200).send(lang_data)
    })
}
