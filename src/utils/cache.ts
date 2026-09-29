import type { FastifyRedis } from '@fastify/redis'
import { LruCache } from './lru'

export interface KeyValueCache {
  get(key: string): Promise<Buffer | undefined>
  set(key: string, value: Buffer, ttlSeconds: number): Promise<void>
}

export class RedisCache implements KeyValueCache {
  constructor(private readonly redis: FastifyRedis, private readonly prefix = 'zassets:') {}

  async get(key: string) {
    return (await this.redis.getBuffer(this.prefix + key)) ?? undefined
  }

  async set(key: string, value: Buffer, ttlSeconds: number) {
    await this.redis.set(this.prefix + key, value, 'EX', ttlSeconds)
  }
}

export class MemoryCache implements KeyValueCache {
  private readonly lru: LruCache<string, { value: Buffer, expires: number }>

  constructor(maxBytes = 32 * 1024 * 1024) {
    this.lru = new LruCache(maxBytes, entry => entry.value.length + 64)
  }

  async get(key: string) {
    const entry = this.lru.get(key)
    if (!entry) return undefined
    if (entry.expires < Date.now()) {
      this.lru.delete(key)
      return undefined
    }
    return entry.value
  }

  async set(key: string, value: Buffer, ttlSeconds: number) {
    this.lru.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
  }
}
