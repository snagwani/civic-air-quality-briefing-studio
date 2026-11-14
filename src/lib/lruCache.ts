interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Bounded Least-Recently-Used (LRU) cache with Time-To-Live (TTL) expiration.
 * Prevents redundant Gemini API calls and bounds client memory consumption to O(maxEntries).
 */
export class BoundedLruCache<V> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly store = new Map<string, CacheEntry<V>>();

  /**
   * Creates a new BoundedLruCache instance.
   *
   * @param maxEntries - Maximum number of entries to retain before evicting least-recently-used
   * @param ttlMs - Time-to-live in milliseconds for each cached entry
   */
  constructor(maxEntries = 30, ttlMs = 600_000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Retrieves a value from the cache if present and not expired, promoting it to most-recently-used.
   *
   * @param key - Cache lookup key
   * @param nowMs - Current timestamp in milliseconds
   * @returns Cached value or undefined if missing/expired
   */
  get(key: string, nowMs = Date.now()): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (nowMs > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /**
   * Inserts or updates a value in the cache, evicting the oldest entry if capacity is exceeded.
   *
   * @param key - Cache key
   * @param value - Value to store
   * @param nowMs - Current timestamp in milliseconds
   */
  set(key: string, value: V, nowMs = Date.now()): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: nowMs + this.ttlMs,
    });
  }

  /**
   * Clears all cached entries.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Returns current number of entries in the cache.
   *
   * @returns Entry count
   */
  size(): number {
    return this.store.size;
  }
}

/**
 * Computes a deterministic 32-bit DJB2 hash string for request payload caching.
 *
 * @param input - Serialized JSON string to hash
 * @returns Compact base-36 hash key
 */
export function hashPayloadKey(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
