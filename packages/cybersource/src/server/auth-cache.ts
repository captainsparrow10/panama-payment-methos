/**
 * In-memory cache for 3DS authentication data.
 *
 * Stores authentication results (cavv, xid, eci, etc.) from successful
 * enrollment checks and challenge validations so that `processPayment`
 * can recover missing fields when the frontend does not send them.
 *
 * Entries expire after a configurable TTL (default: 5 minutes) and a
 * background cleanup runs at the same interval.
 *
 * @example
 * ```ts
 * import { InMemoryThreeDSAuthCache } from '@panama-payments/cybersource/server';
 *
 * const cache = new InMemoryThreeDSAuthCache();
 *
 * // After enrollment check (frictionless)
 * cache.set(authTransactionId, { cavv, xid, eci, ... });
 *
 * // During payment processing (fallback)
 * const cached = cache.get(authTransactionId);
 *
 * // On shutdown
 * cache.destroy();
 * ```
 */

import type { ThreeDSAuthCache, ThreeDSAuthData } from '../types.js';

/**
 * Default TTL for cached 3DS auth data: 5 minutes.
 *
 * @example
 * ```ts
 * const cache = new InMemoryThreeDSAuthCache(); // uses DEFAULT_TTL_MS
 * const cache2 = new InMemoryThreeDSAuthCache(10 * 60 * 1000); // 10 minutes
 * ```
 */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * In-memory implementation of the {@link ThreeDSAuthCache} interface.
 *
 * Uses a `Map` with automatic TTL-based eviction. A `setInterval` cleanup
 * runs every `ttlMs` milliseconds to remove expired entries.
 *
 * **For production at scale**, consider implementing a Redis-backed cache
 * that shares state across server instances.
 *
 * @example
 * ```ts
 * import { InMemoryThreeDSAuthCache } from '@panama-payments/cybersource/server';
 *
 * const cache = new InMemoryThreeDSAuthCache(5 * 60 * 1000);
 *
 * cache.set('txn-abc', {
 *   cavv: 'AAACBllleHchZTBWIGV4MAAAAAAA',
 *   xid: 'CAACCVVUlwCXUyhQNlSXAAAAAAA=',
 *   eci: '05',
 *   eciRaw: '05',
 *   authenticationTransactionId: 'txn-abc',
 *   directoryServerTransactionId: 'ds-123',
 *   specificationVersion: '2.1.0',
 *   timestamp: Date.now(),
 * });
 *
 * const data = cache.get('txn-abc');
 * console.log(data?.cavv); // 'AAACBllleHchZTBWIGV4MAAAAAAA'
 *
 * cache.destroy(); // Stop cleanup interval on shutdown
 * ```
 */
export class InMemoryThreeDSAuthCache implements ThreeDSAuthCache {
  private readonly store = new Map<string, ThreeDSAuthData>();
  private readonly ttlMs: number;
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  /**
   * Create a new in-memory 3DS auth cache.
   *
   * @param ttlMs - Time-to-live in milliseconds for each entry (default: 5 minutes)
   *
   * @example
   * ```ts
   * const cache = new InMemoryThreeDSAuthCache();          // 5 min TTL
   * const cache2 = new InMemoryThreeDSAuthCache(60_000);   // 1 min TTL
   * ```
   */
  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
    this.cleanupInterval = setInterval(() => this.cleanup(), this.ttlMs);
    // Do not block process exit
    if (typeof this.cleanupInterval === 'object' && 'unref' in this.cleanupInterval) {
      (this.cleanupInterval as { unref: () => void }).unref();
    }
  }

  /**
   * Retrieve cached 3DS authentication data.
   *
   * Returns `undefined` if the key does not exist or has expired.
   *
   * @param key - The authentication transaction ID
   * @returns The cached data, or `undefined`
   *
   * @example
   * ```ts
   * const data = cache.get('txn-abc');
   * if (data) {
   *   console.log('CAVV:', data.cavv);
   * }
   * ```
   */
  get(key: string): ThreeDSAuthData | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  /**
   * Store 3DS authentication data.
   *
   * @param key - The authentication transaction ID (cache key)
   * @param data - The 3DS auth data to cache
   *
   * @example
   * ```ts
   * cache.set('txn-abc', {
   *   cavv: 'AAAC...',
   *   xid: 'CAAC...',
   *   eci: '05',
   *   eciRaw: '05',
   *   authenticationTransactionId: 'txn-abc',
   *   directoryServerTransactionId: 'ds-123',
   *   specificationVersion: '2.1.0',
   *   timestamp: Date.now(),
   * });
   * ```
   */
  set(key: string, data: ThreeDSAuthData): void {
    this.store.set(key, data);
  }

  /**
   * Remove cached data for a given key.
   *
   * @param key - The authentication transaction ID to remove
   *
   * @example
   * ```ts
   * cache.delete('txn-abc');
   * ```
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Stop the automatic cleanup interval.
   *
   * **Must be called on server shutdown** to prevent the interval from
   * keeping the Node.js process alive.
   *
   * @example
   * ```ts
   * process.on('SIGTERM', () => {
   *   cache.destroy();
   *   process.exit(0);
   * });
   * ```
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  /**
   * Remove all expired entries from the cache.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store) {
      if (now - value.timestamp > this.ttlMs) {
        this.store.delete(key);
      }
    }
  }
}
