import { createHash } from 'node:crypto';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Bounded LRU + TTL cache for validated Gemini responses on the serverless tier.
 * Identical requests (same payload hash) are served in O(1) without spending LLM tokens again.
 */
export class ServerResponseCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  /**
   * Creates a bounded cache.
   * @param maxEntries - Maximum retained entries before least-recently-used eviction
   * @param ttlMs - Time-to-live for each entry in milliseconds
   */
  constructor(maxEntries = 50, ttlMs = 10 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Reads an entry, refreshing its recency. Expired entries are evicted.
   * @param key - Cache key
   * @param nowMs - Current time in milliseconds
   * @returns Cached value or undefined
   */
  get(key: string, nowMs = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= nowMs) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /**
   * Stores an entry, evicting the least recently used item when full.
   * @param key - Cache key
   * @param value - Value to store
   * @param nowMs - Current time in milliseconds
   */
  set(key: string, value: T, nowMs = Date.now()): void {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: nowMs + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /**
   * Number of entries currently retained.
   * @returns Entry count
   */
  get size(): number {
    return this.store.size;
  }
}

/**
 * Produces a stable SHA-256 key for a request payload.
 * @param text - Serialized request payload
 * @returns Hex digest string
 */
export function hashRequestKey(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
