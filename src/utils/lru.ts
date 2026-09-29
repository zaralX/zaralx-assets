export class LruCache<K, V> {
  private readonly entries = new Map<K, { value: V, size: number }>()
  private total = 0

  constructor(private readonly maxSize: number, private readonly sizeOf: (value: V) => number = () => 1) {}

  get(key: K) {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: K, value: V) {
    const size = this.sizeOf(value)
    if (size > this.maxSize) return
    this.delete(key)
    this.entries.set(key, { value, size })
    this.total += size
    for (const [oldest, entry] of this.entries) {
      if (this.total <= this.maxSize) break
      this.entries.delete(oldest)
      this.total -= entry.size
    }
  }

  delete(key: K) {
    const entry = this.entries.get(key)
    if (!entry) return
    this.entries.delete(key)
    this.total -= entry.size
  }
}
