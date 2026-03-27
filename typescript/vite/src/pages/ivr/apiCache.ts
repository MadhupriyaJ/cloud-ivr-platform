/**
 * Simple in-memory cache with stale-while-revalidate pattern.
 * 
 * - First call: fetches from network, caches result
 * - Subsequent calls within TTL: returns cached data instantly (0ms)
 * - After TTL expires: returns stale data immediately, refreshes in background
 * - Mutations call invalidate() to force fresh data on next read
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>; // in-flight request deduplication
}

const cache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 30_000; // 30 seconds

/**
 * Wrap a fetch function with stale-while-revalidate caching.
 * Returns cached data instantly if available, refreshes in background after TTL.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  const entry = cache.get(key);
  const now = Date.now();

  // Cache HIT and still fresh (timestamp > 0 means data has been resolved at least once)
  if (entry && entry.timestamp > 0 && (now - entry.timestamp) < ttl) {
    return entry.data;
  }

  // Cache HIT but stale — return stale data, refresh in background
  // Only return stale data if it was actually resolved (timestamp > 0)
  if (entry && entry.timestamp > 0) {
    if (!entry.promise) {
      entry.promise = fetcher().then(data => {
        cache.set(key, { data, timestamp: Date.now() });
        return data;
      }).catch(() => entry.data); // On error, keep stale data
    }
    return entry.data;
  }

  // If entry exists but data hasn't resolved yet (timestamp === 0),
  // return the in-flight promise to avoid returning null
  if (entry?.promise) {
    return entry.promise;
  }

  // Cache MISS — first fetch
  const promise = fetcher().then(data => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });

  // Store the promise for deduplication (data is null placeholder until resolved)
  cache.set(key, { data: null as any, timestamp: 0, promise });

  return promise;
}

/**
 * Invalidate a specific cache key (call after mutations).
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all keys matching a prefix.
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
