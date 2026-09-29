import { resolve } from 'node:path'

function list(value: string | undefined, fallback: string[]) {
  return value ? value.split(',').map(v => v.trim()).filter(Boolean) : fallback
}

function int(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

// 'true', a hop count, or addresses/subnets as understood by proxy-addr; unset means the socket address is used
function trustProxy(value: string | undefined) {
  if (!value || value === 'false') return false
  if (value === 'true') return true
  if (/^\d+$/.test(value)) {
    const hops = Number(value)
    return (_address: string, hop: number) => hop < hops
  }
  return value
}

const env = process.env

export const config = {
  host: env.HOST ?? env.FASTIFY_ADDRESS ?? '0.0.0.0',
  port: int(env.PORT ?? env.FASTIFY_PORT, 3000),
  logLevel: env.LOG_LEVEL ?? env.FASTIFY_LOG_LEVEL ?? 'info',
  trustProxy: trustProxy(env.TRUST_PROXY),
  publicUrl: (env.PUBLIC_URL ?? 'https://assets.zaralx.ru/api').replace(/\/+$/, ''),
  redisUrl: env.REDIS_URL ?? (env.REDIS_HOST ? `redis://${env.REDIS_HOST}:${env.REDIS_PORT ?? 6379}` : undefined),
  dataDir: resolve(env.DATA_DIR ?? 'data'),

  pipeline: {
    // Oldest version to build; versions before 1.21.4 have no item model definitions
    minVersion: env.PIPELINE_MIN_VERSION ?? '1.21.4',
    types: list(env.PIPELINE_TYPES, ['release']),
    intervalMinutes: int(env.PIPELINE_INTERVAL_MINUTES, 60),
    keepJars: env.PIPELINE_KEEP_JARS === 'true',
  },

  // Version served by the v1 routes, which predate versioning
  legacyVersion: env.LEGACY_VERSION ?? '1.21.5',
}
