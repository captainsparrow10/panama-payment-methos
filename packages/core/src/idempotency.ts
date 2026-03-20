import { randomUUID } from 'crypto';

/**
 * Standard HTTP header name for idempotency keys.
 *
 * @example
 * ```ts
 * headers[IDEMPOTENCY_HEADER] = generateIdempotencyKey();
 * // Sets 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000'
 * ```
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key' as const;

/**
 * Generates a UUID v4 idempotency key for payment requests.
 *
 * Idempotency keys prevent duplicate charges when the same request is sent
 * multiple times (e.g., due to network timeouts or retries). The payment
 * provider uses this key to deduplicate requests within a 24-48 hour window.
 *
 * @returns A UUID v4 string (e.g., '550e8400-e29b-41d4-a716-446655440000')
 *
 * @example
 * ```ts
 * const key = generateIdempotencyKey();
 * await client.processPayment(data, { idempotencyKey: key });
 * // If this fails due to timeout, retrying with the same key is safe
 * ```
 */
export function generateIdempotencyKey(): string {
  return randomUUID();
}
