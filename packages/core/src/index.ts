// ─── Error hierarchy ────────────────────────────────────────────────────────
export {
  PaymentError,
  ValidationError,
  AuthenticationError,
  DeclinedError,
  TimeoutError,
  RateLimitError,
  ConfigError,
  NetworkError,
} from './errors.js';

// ─── Retry with exponential backoff ─────────────────────────────────────────
export { withRetry, calculateRetryDelay } from './retry.js';
export type { RetryConfig } from './retry.js';

// ─── Pluggable logger ───────────────────────────────────────────────────────
export { noopLogger, createConsoleLogger } from './logger.js';
export type { PaymentLogger } from './logger.js';

// ─── PCI data redaction ─────────────────────────────────────────────────────
export { PCI_FIELDS, sanitize, maskCardNumber } from './sanitize.js';

// ─── Idempotency key generation ─────────────────────────────────────────────
export { IDEMPOTENCY_HEADER, generateIdempotencyKey } from './idempotency.js';

// ─── Rate limit handling ────────────────────────────────────────────────────
export { parseRateLimitHeaders, waitForRateLimit } from './rate-limit.js';
export type { RateLimitInfo } from './rate-limit.js';

// ─── Health check ───────────────────────────────────────────────────────────
export { checkHealth } from './health.js';
export type { HealthCheckResult } from './health.js';

// ─── OpenTelemetry opt-in ───────────────────────────────────────────────────
export { createSpan } from './telemetry.js';
export type { PaymentSpan } from './telemetry.js';

// ─── Test utilities ─────────────────────────────────────────────────────────
export {
  TEST_CARDS,
  generateTestOrderId,
  generateTestWebhookPayload,
} from './testing.js';
