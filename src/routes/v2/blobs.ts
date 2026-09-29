import { readFile } from 'node:fs/promises'
import type { FastifyPluginAsync } from 'fastify'
import { BLOB_EXTENSIONS, BLOB_HASH_PATTERN, blobFile, type BlobExtension } from '../../catalog/blobs'
import { imageResponse, sizeQuery } from '../../schemas/v2'
import { IMMUTABLE, sendImage } from '../../utils/http'
import { IMAGE_FORMATS, type ImageFormat } from '../../utils/images'

const CONTENT_TYPES: Record<string, string> = {
  mcmeta: 'application/json',
  json: 'application/json',
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { file: string }, Querystring: { size?: number, format?: ImageFormat } }>('/blobs/:file', {
    schema: {
      tags: ['versions'],
      description: 'A file by its sha1, as referenced by `iconBlobs` and `blob` fields. Never changes, cached for a year',
      params: {
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', pattern: `^[0-9a-f]{40}\\.(${BLOB_EXTENSIONS.join('|')})$` } },
      },
      querystring: {
        type: 'object',
        properties: { size: sizeQuery, format: { type: 'string', enum: IMAGE_FORMATS } },
      },
      response: imageResponse,
    },
    config: { rateLimit: { max: 5000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const [hash, extension] = request.params.file.split('.') as [string, BlobExtension]
    if (!BLOB_HASH_PATTERN.test(hash)) throw fastify.httpErrors.notFound()
    const file = blobFile(fastify.catalog.dataDir, hash, extension)

    if (extension === 'webp' || extension === 'png') {
      const format = request.query.format ?? extension
      try {
        return await sendImage(request, reply, { file, width: request.query.size, format }, hash, IMMUTABLE)
      }
      catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw fastify.httpErrors.notFound()
        throw err
      }
    }

    const data = await readFile(file).catch(() => undefined)
    if (!data) throw fastify.httpErrors.notFound()
    return reply.type(CONTENT_TYPES[extension]).header('Cache-Control', IMMUTABLE).send(data)
  })
}

export default route
