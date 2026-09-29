import fp from 'fastify-plugin'
import { Catalog } from '../catalog/catalog'
import { config } from '../config'

declare module 'fastify' {
  interface FastifyInstance {
    catalog: Catalog
  }
}

export default fp(async (fastify) => {
  const catalog = new Catalog(config.dataDir)
  const versions = await catalog.versions()
  if (!versions.length) fastify.log.warn(`No versions in ${config.dataDir}, run the pipeline first`)
  else fastify.log.info(`Serving ${versions.length} versions, latest ${versions[0].id}`)
  fastify.decorate('catalog', catalog)
}, { name: 'catalog' })
