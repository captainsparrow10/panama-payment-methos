# Changelog

All notable changes to `@panama-payments/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-20

### Added

- `PaymentError` hierarchy: `ValidationError`, `AuthenticationError`, `DeclinedError`, `TimeoutError`, `RateLimitError`, `ConfigError`, `NetworkError`
- `withRetry()` — exponential backoff with jitter for transient failures
- `PaymentLogger` interface — pluggable logger compatible with Winston, Pino, console
- `sanitize()` — PCI-compliant data redaction for safe logging
- `generateIdempotencyKey()` — UUID v4 generation for duplicate prevention
- `parseRateLimitHeaders()` + `waitForRateLimit()` — HTTP 429 handling
- `checkHealth()` — API endpoint reachability check
- `createSpan()` — optional OpenTelemetry tracing integration
- `TEST_CARDS` — CyberSource sandbox test card numbers
- `generateTestOrderId()` + `generateTestWebhookPayload()` — testing utilities
