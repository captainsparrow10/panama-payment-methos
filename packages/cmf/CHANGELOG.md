# Changelog

All notable changes to `@devhubpty/cmf` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-20

### Added

- **CMFClient** -- server-side client with full CMF API coverage:
  - Authentication (`login`, `ensureAuthenticated`)
  - Customer lookup by document, email, and phone
  - Customer products retrieval
  - Quota simulation for financing plans
  - Installment purchase processing (`processPurchaseInQuotas`)
  - Normal card purchase processing (`processNormalPurchase`)
  - Transaction verification
  - OTP send/verify via email and WhatsApp
  - Health check via `ping()`
- **CMFError** -- typed error class extending `PaymentError` from `@devhubpty/core`, with `statusResult` for structured error details
- **Structured logging** -- optional `PaymentLogger` integration with PCI-safe data sanitization
- **Automatic retry** -- exponential backoff for network/timeout errors (not business errors)
- **Idempotency key support** -- optional `idempotencyKey` parameter for payment methods
- **React hooks**:
  - `useCMFCustomer` -- customer search
  - `useCMFQuotas` -- financing plan simulation
  - `useCMFOtp` -- OTP verification state machine (idle -> verify -> done)
  - `useCMFPayment` -- payment processing
- **CMFPaymentForm** -- headless React component implementing the complete payment flow
- **TypeScript types** -- full JSDoc coverage for all types, interfaces, and enums
- **Examples** -- Express.js routes and Next.js App Router API routes
- **Documentation** -- getting started, flow diagrams (Mermaid), integration guide, API reference, environment variables, and database model
