/**
 * Base error class for all Panama payment SDK errors.
 *
 * All payment-related errors extend this class, allowing consumers to catch
 * any payment error with a single `catch (e) { if (e instanceof PaymentError) }`.
 *
 * @example
 * ```ts
 * try {
 *   await client.processPayment(data);
 * } catch (error) {
 *   if (error instanceof PaymentError) {
 *     console.log(error.code);      // e.g., 'DECLINED'
 *     console.log(error.retryable); // false for declined, true for timeout
 *   }
 * }
 * ```
 */
export class PaymentError extends Error {
  readonly name: string = 'PaymentError';

  constructor(
    message: string,
    /** Machine-readable error code (e.g., 'DECLINED', 'TIMEOUT', 'RATE_LIMITED') */
    public readonly code: string,
    /** Whether this error is safe to retry. Timeouts and network errors are retryable; declines are not. */
    public readonly retryable: boolean,
    /** HTTP status code from the payment provider, if available */
    public readonly httpStatus?: number,
    /** Provider-specific error code (e.g., CMF's 2006, Yappy's E002, CyberSource's PROCESSOR_DECLINED) */
    public readonly providerCode?: string,
    /** Detailed error information from the provider */
    public readonly details?: Array<{
      field?: string;
      reason?: string;
      message?: string;
    }>,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Input validation failed (e.g., missing required field, invalid format).
 * Never retryable.
 *
 * @example
 * ```ts
 * throw new ValidationError('Invalid card number', [
 *   { field: 'cardNumber', reason: 'Must be 13-19 digits' }
 * ]);
 * ```
 */
export class ValidationError extends PaymentError {
  override readonly name = 'ValidationError';

  constructor(
    message: string,
    details?: Array<{ field?: string; reason?: string; message?: string }>,
  ) {
    super(message, 'VALIDATION_ERROR', false, 400, undefined, details);
  }
}

/**
 * Authentication failed (e.g., invalid API key, expired token).
 * Never retryable.
 *
 * @example
 * ```ts
 * throw new AuthenticationError('Invalid API key');
 * ```
 */
export class AuthenticationError extends PaymentError {
  override readonly name = 'AuthenticationError';

  constructor(message: string, providerCode?: string) {
    super(message, 'AUTHENTICATION_ERROR', false, 401, providerCode);
  }
}

/**
 * Payment was declined by the processor or issuing bank.
 * Never retryable with the same data.
 *
 * @example
 * ```ts
 * throw new DeclinedError(
 *   'Card was declined due to insufficient funds',
 *   'insufficient_funds',
 *   'PROCESSOR_DECLINED'
 * );
 * ```
 */
export class DeclinedError extends PaymentError {
  override readonly name = 'DeclinedError';

  constructor(
    message: string,
    /** Bank-specific decline code (e.g., 'insufficient_funds', 'do_not_honor') */
    public readonly declineCode: string,
    providerCode?: string,
  ) {
    super(message, 'DECLINED', false, 402, providerCode);
  }
}

/**
 * Request timed out. Always retryable.
 *
 * @example
 * ```ts
 * throw new TimeoutError('Request timed out after 30s', 30000);
 * ```
 */
export class TimeoutError extends PaymentError {
  override readonly name = 'TimeoutError';

  constructor(
    message: string = 'Request timed out',
    /** The timeout duration in milliseconds that was exceeded */
    public readonly timeoutMs?: number,
  ) {
    super(message, 'TIMEOUT', true, 408);
  }
}

/**
 * Rate limit exceeded (HTTP 429). Retryable after the specified delay.
 *
 * @example
 * ```ts
 * throw new RateLimitError('Rate limit exceeded', 30000);
 * ```
 */
export class RateLimitError extends PaymentError {
  override readonly name = 'RateLimitError';

  constructor(
    message: string = 'Rate limit exceeded',
    /** Milliseconds to wait before retrying (from Retry-After header) */
    public readonly retryAfterMs?: number,
  ) {
    super(message, 'RATE_LIMITED', true, 429);
  }
}

/**
 * SDK configuration error (e.g., missing merchant ID, invalid environment).
 * Never retryable.
 *
 * @example
 * ```ts
 * throw new ConfigError('Missing required option: merchantId');
 * ```
 */
export class ConfigError extends PaymentError {
  override readonly name = 'ConfigError';

  constructor(message: string) {
    super(message, 'CONFIG_ERROR', false);
  }
}

/**
 * Network error (e.g., DNS resolution failure, connection refused).
 * Always retryable.
 *
 * @example
 * ```ts
 * throw new NetworkError('Could not resolve host', originalError);
 * ```
 */
export class NetworkError extends PaymentError {
  override readonly name = 'NetworkError';

  constructor(
    message: string = 'Network error',
    /** The original error that caused this network error */
    public readonly originalError?: Error,
  ) {
    super(message, 'NETWORK_ERROR', true, 0);
  }
}
