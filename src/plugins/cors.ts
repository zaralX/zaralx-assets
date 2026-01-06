import fp from 'fastify-plugin'
import fastifyCors, {FastifyCorsOptions} from '@fastify/cors'

/**
 * This plugin adds cors rules
 *
 * @see https://github.com/fastify/fastify-cors
 */
export default fp<FastifyCorsOptions>(async (fastify) => {
    fastify.register(fastifyCors, {
        origin: true,
        credentials: true,
        methods: ["GET"]
    })
})
