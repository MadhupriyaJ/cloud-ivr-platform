import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry>();

  private readonly DEFAULT_TTL_MS = 30_000; // 30 seconds default

  /**
   * Get a cached value or execute the factory function and cache the result.
   * This is the primary method — use it everywhere instead of direct DB calls.
   *
   * @param key   Unique cache key (e.g., 'domains:list', 'agents:all')
   * @param factory  Async function that fetches data from DB
   * @param ttlMs    Time-to-live in milliseconds (default 30s)
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const ttl = ttlMs ?? this.DEFAULT_TTL_MS;
    const existing = this.store.get(key);

    if (existing && existing.expiresAt > Date.now()) {
      return existing.data as T;
    }

    const start = Date.now();
    const data = await factory();
    const elapsed = Date.now() - start;

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });

    if (elapsed > 500) {
      this.logger.log(`Cache MISS [${key}]: ${elapsed}ms (TTL: ${ttl}ms)`);
    }

    return data;
  }

  /**
   * Invalidate a specific cache key (call after mutations/writes).
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix (e.g., 'domains:' clears all domain caches).
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.store.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Get cache statistics for monitoring.
   */
  getStats(): { size: number; keys: string[] } {
    const now = Date.now();
    // Clean expired entries
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}
