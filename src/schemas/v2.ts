import { LANG_PATTERN } from '../catalog/paths'
import { IMAGE_FORMATS } from '../utils/images'

export const versionParam = {
  type: 'string',
  description: 'Version id, `latest` (newest release) or `latest-snapshot` (newest build of any type)',
  examples: ['latest', '26.3', '1.21.5'],
} as const

export const idParam = {
  type: 'string',
  pattern: '^[a-z0-9_][a-z0-9_.-]*$',
} as const

export const langQuery = {
  type: 'string',
  pattern: LANG_PATTERN.source,
  default: 'en_us',
  description: 'Language used for names',
  examples: ['en_us', 'ru_ru'],
} as const

export const formatQuery = {
  type: 'string',
  enum: IMAGE_FORMATS,
  default: 'webp',
} as const

export const sizeQuery = {
  type: 'integer',
  minimum: 16,
  maximum: 1024,
  description: 'Output width in pixels, scaled with nearest neighbour',
} as const

export const imageResponse = {
  200: {
    description: 'Image',
    content: {
      'image/webp': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
    },
  },
} as const

export const textureRef = {
  type: 'object',
  properties: {
    path: { type: 'string', examples: ['block/stone'] },
    url: { type: 'string' },
  },
} as const
