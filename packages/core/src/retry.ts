import { PaymentError } from './errors.js';

/**
 * Configuration for retry behavior.
 *
 * @example
 * ```ts
 * const config: RetryConfig = {
 *   maxAttempts: 3,
 *   baseDelayMs: 1000,
 *   maxDelayMs: 30000,
 *   jitter: true,
 *   onRetry: (err, attempt, delay) => console.log(`Retry ${attempt} in ${delay}ms`),
 * };
 * ```
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in milliseconds between retries (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (caps exponential growth, default: 30000) */
  maxDelayMs: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter: boolean;
  /** Custom function to determine if an error should be retried. Falls back to error.retryable. */
  retryOn?: (error: Error) => boolean;
  /** Called before each retry attempt. Useful for logging. */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true,
};

/**
 * Executes an async function with exponential backoff retry.
 *
 * Delay formula: `min(baseDelay * 2^attempt, maxDelay) + random(0, baseDelay * 0.5)`
 *
 * Only retries if:
 * 1. Custom `retryOn()` returns true, OR
 * 2. The error is a `PaymentError` with `retryable === true`
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration (all fields optional, sensible defaults provided)
 * @returns The result of the function
 * @throws The last error if all retry attempts are exhausted
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => client.processPayment(data),
 *   { maxAttempts: 3, onRetry: (err, attempt) => console.log(`Retry ${attempt}...`) }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= cfg.maxAttempts) break;

      const shouldRetry = cfg.retryOn
        ? cfg.retryOn(lastError)
        : lastError instanceof PaymentError && lastError.retryable;

      if (!shouldRetry) break;

      const exponentialDelay = Math.min(
        cfg.baseDelayMs * Math.pow(2, attempt),
        cfg.maxDelayMs,
      );
      const jitter = cfg.jitter ? Math.random() * cfg.baseDelayMs * 0.5 : 0;
      const delayMs = Math.round(exponentialDelay + jitter);

      cfg.onRetry?.(lastError, attempt + 1, delayMs);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Calculates the delay for a specific retry attempt (useful for display/logging).
 *
 * @param attempt - Zero-based attempt number
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 *
 * @example
 * ```ts
 * calculateRetryDelay(0); // ~1000ms (base delay)
 * calculateRetryDelay(1); // ~2000ms (2x base)
 * calculateRetryDelay(2); // ~4000ms (4x base)
 * ```
 */
export function calculateRetryDelay(
  attempt: number,
  config?: Partial<Pick<RetryConfig, 'baseDelayMs' | 'maxDelayMs' | 'jitter'>>,
): number {
  const base = config?.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs;
  const max = config?.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs;
  const useJitter = config?.jitter ?? DEFAULT_RETRY_CONFIG.jitter;

  const exponentialDelay = Math.min(base * Math.pow(2, attempt), max);
  const jitter = useJitter ? Math.random() * base * 0.5 : 0;
  return Math.round(exponentialDelay + jitter);
}
