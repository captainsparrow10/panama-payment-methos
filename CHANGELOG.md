# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-20

### Added

- **@panama-payments/core** — Shared utilities:
  - `PaymentError` hierarchy with 7 subclasses (ValidationError, AuthenticationError, DeclinedError, TimeoutError, RateLimitError, ConfigError, NetworkError)
  - `withRetry()` with exponential backoff + jitter
  - `PaymentLogger` interface compatible with Winston, Pino, console
  - `sanitize()` for PCI-compliant data redaction
  - `generateIdempotencyKey()` for duplicate charge prevention
  - `parseRateLimitHeaders()` + `waitForRateLimit()` for HTTP 429 handling
  - `checkHealth()` for API connectivity checks
  - `createSpan()` for optional OpenTelemetry tracing
  - `TEST_CARDS`, `generateTestOrderId()`, `generateTestWebhookPayload()` for testing

- **@panama-payments/cmf** — CMF financing SDK:
  - `CMFClient` with full API coverage (login, customer lookup, quotas, purchases, OTP, verification)
  - 4 headless React hooks (useCMFCustomer, useCMFQuotas, useCMFOtp, useCMFPayment)
  - `CMFError` with `statusResult` for CMF-specific error handling
  - Express and Next.js examples
  - 4 Mermaid flow diagrams

- **@panama-payments/yappy** — Yappy mobile payment SDK:
  - `YappyClient` with `validateMerchant()`, `createOrder()`, `initiatePayment()`
  - `validateYappyHash()` with timing-safe HMAC-SHA256 verification
  - `generateTestWebhook()` for testing webhook handlers
  - 4 headless React hooks + 3 optional components + vanilla JS integration
  - Express and Next.js examples
  - 4 Mermaid flow diagrams (official CDN + custom polling approaches)

- **@panama-payments/cybersource** — CyberSource 3DS payment SDK:
  - `CyberSourceClient` with 3DS authentication, card tokenization, vault, payments, refunds, voids
  - `InMemoryThreeDSAuthCache` with 5-minute TTL for frictionless 3DS fallback
  - `useThreeDS` orchestrator hook (state machine: setup → enroll → challenge? → validate → ready)
  - `ThreeDSModal` component for 3DS challenge iframe
  - Express, Next.js, and React Native examples
  - 5 Mermaid flow diagrams

### Contributors

- [captainsparrow10](https://github.com/captainsparrow10)
- [Reddsito](https://github.com/Reddsito)
