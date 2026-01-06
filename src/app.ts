import {join} from 'node:path'
import AutoLoad, {AutoloadPluginOptions} from '@fastify/autoload'
import {FastifyPluginAsync, FastifyServerOptions} from 'fastify'
import {init} from './utils/assetsUtil'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {
}

const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (
    fastify,
    opts
): Promise<void> => {
    fastify.decorate('download_mojang_asset_url', 'https://resources.download.minecraft.net/%A/%B')

    // ASSETS VERSION - 1.21.5
    fastify.decorate('version_assets_url', 'https://piston-meta.mojang.com/v1/packages/3cd0a438b150f32a5cd8170ac19c56cb8736cfaa/24.json')

    // Mojang API has small rate limit. Mineskin - database with skins
    fastify.decorate('skin_url', 'https://mineskin.eu/skin/%A')

    fastify.decorate('cache', {
        skin: new Map(),
        skinFace: new Map(),
        skinFullFace: new Map(),
    })

    void fastify.register(AutoLoad, {
        dir: join(__dirname, 'plugins'),
        options: opts
    })

    await init(fastify as any)

    void fastify.register(AutoLoad, {
        dir: join(__dirname, 'routes'),
        routeParams: true,
        options: opts
    })
}

export default app
export {app, options}
