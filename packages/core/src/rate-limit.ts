/**
 * Parsed rate limit information from HTTP response headers.
 *
 * @example
 * ```ts
 * const info: RateLimitInfo = { limited: true, retryAfterMs: 30000 };
 * ```
 */
export interface RateLimitInfo {
  /** Whether the request was rate limited (HTTP 429) */
  limited: boolean;
  /** Milliseconds to wait before retrying (from Retry-After header), or null if not specified */
  retryAfterMs: number | null;
}

/**
 * Parses rate limit information from HTTP response headers.
 *
 * Handles both formats of `Retry-After`:
 * - Seconds: `Retry-After: 30` -> 30000ms
 * - HTTP date: `Retry-After: Thu, 20 Mar 2026 10:30:00 GMT` -> calculated delta
 *
 * @param headers - Response headers (case-insensitive keys)
 * @param httpStatus - HTTP status code of the response
 * @returns Rate limit info with delay in milliseconds
 *
 * @example
 * ```ts
 * const info = parseRateLimitHeaders(response.headers, response.status);
 * if (info.limited && info.retryAfterMs) {
 *   await waitForRateLimit(info);
 *   // retry the request
 * }
 * ```
 */
export function parseRateLimitHeaders(
  headers: Record<string, string | undefined>,
  httpStatus: number,
): RateLimitInfo {
  if (httpStatus !== 429) {
    return { limited: false, retryAfterMs: null };
  }

  const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
  if (!retryAfter) {
    return { limited: true, retryAfterMs: null };
  }

  const seconds = Number(retryAfter);
  if (!isNaN(seconds)) {
    return { limited: true, retryAfterMs: seconds * 1000 };
  }

  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    const delayMs = Math.max(0, date.getTime() - Date.now());
    return { limited: true, retryAfterMs: delayMs };
  }

  return { limited: true, retryAfterMs: null };
}

/**
 * Waits for the duration specified in rate limit headers.
 * Falls back to 5 seconds if no retry-after is specified.
 *
 * @param info - Rate limit info from parseRateLimitHeaders
 * @param fallbackMs - Fallback delay if retryAfterMs is null (default: 5000)
 *
 * @example
 * ```ts
 * const info = parseRateLimitHeaders(headers, 429);
 * if (info.limited) {
 *   await waitForRateLimit(info);
 *   // safe to retry now
 * }
 * ```
 */
export async function waitForRateLimit(
  info: RateLimitInfo,
  fallbackMs = 5000,
): Promise<void> {
  const delayMs = info.retryAfterMs ?? fallbackMs;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
