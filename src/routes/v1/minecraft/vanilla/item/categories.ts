import type { FastifyPluginAsync } from 'fastify'
import { UNCATEGORIZED } from '../../../../../catalog/types'
import { useLegacyVersion } from '../../../../../utils/http'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get('/categories', {
    schema: {
      summary: 'Categories',
      tags: ['v1'],
      deprecated: true,
      description: 'Use /v2/minecraft/{version}/creative-tabs',
    },
  }, async () => {
    const { data } = await useLegacyVersion(fastify)
    return Object.fromEntries(Object.entries(data.creativeTabs).filter(([tab]) => tab !== UNCATEGORIZED))
  })
}

export default route
