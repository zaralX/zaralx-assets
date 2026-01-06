import path from 'path'
import { promises as fs } from 'fs'
import axios from 'axios'
import { FastifyInstance } from 'fastify'

type AssetObject = {
    hash: string
}

type LoadedAssets = Record<string, AssetObject>

export async function init(fastify: FastifyInstance & {
    loaded_assets?: LoadedAssets
    version_assets_url: string
}) {
    if (!fastify.loaded_assets) {
        const response = await axios.get<{ objects: LoadedAssets }>(
            fastify.version_assets_url
        )
        fastify.decorate('loaded_assets', response.data.objects)
    }

    await init_lang(fastify)
    await init_categories(fastify)
}

async function init_categories(fastify: FastifyInstance) {
    try {
        const categories = JSON.parse(
            await fs.readFile(
                path.join('assets', 'item_categories.json'),
                { encoding: 'utf8' }
            )
        )

        fastify.decorate('categories', categories)
    } catch (error) {
        fastify.log.error('Failed to initialize categories:', error)
        fastify.decorate('categories', {})
        throw error
    }
}

async function init_lang(fastify: FastifyInstance & {
    lang?: Record<string, any>
}) {
    fastify.decorate('lang', {})

    fastify.lang!.en_us = JSON.parse(
        await fs.readFile(
            path.join('assets', 'lang', 'en_us.json'),
            { encoding: 'utf8' }
        )
    )

    await preload_lang(fastify as any, 'ru_ru')
}

export async function preload_lang(
    fastify: FastifyInstance & {
        lang?: Record<string, any>
        loaded_assets?: LoadedAssets
        download_mojang_asset_url: string
    },
    id: string
) {
    console.log(`Preloading lang ${id}`)

    const key = `minecraft/lang/${id}.json`
    const asset_hash = fastify.loaded_assets?.[key]?.hash

    if (!asset_hash) {
        return null
    }

    const asset_hash_part = asset_hash.substring(0, 2)

    const url = fastify.download_mojang_asset_url
        .replace('%A', asset_hash_part)
        .replace('%B', asset_hash)

    const response = await axios.get(url)
    fastify.lang![id] = response.data

    console.log(`Preloaded ${id}`)
}
