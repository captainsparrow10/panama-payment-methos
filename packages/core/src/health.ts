/**
 * Result of a health check against a payment API endpoint.
 *
 * @example
 * ```ts
 * const result: HealthCheckResult = {
 *   reachable: true,
 *   latencyMs: 142,
 * };
 * ```
 */
export interface HealthCheckResult {
  /** Whether the API endpoint is reachable */
  reachable: boolean;
  /** Round-trip latency in milliseconds */
  latencyMs: number;
  /** Error message if the check failed */
  error?: string;
}

/**
 * Performs a simple health check against a payment API endpoint.
 *
 * Makes a HEAD request (or GET if HEAD is not supported) to the base URL
 * and measures the response time. Returns `reachable: true` for any
 * status code below 500 (even 4xx, which indicates the server is responding).
 *
 * @param baseUrl - The API base URL to check
 * @param timeoutMs - Maximum time to wait for a response (default: 5000)
 * @returns Health check result with reachability and latency
 *
 * @example
 * ```ts
 * const health = await checkHealth('https://apitest.cybersource.com');
 * if (health.reachable) {
 *   console.log(`API is up (${health.latencyMs}ms)`);
 * }
 * ```
 */
export async function checkHealth(
  baseUrl: string,
  timeoutMs = 5000,
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(baseUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return {
      reachable: response.status < 500,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      reachable: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
