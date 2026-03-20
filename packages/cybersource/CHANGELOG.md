# Changelog

All notable changes to `@panama-payments/cybersource` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-20

### Added

- `CyberSourceClient` class with full payment lifecycle support:
  - Customer management (`createCustomer`, `deleteCustomer`)
  - Card tokenization (`createInstrumentIdentifier`, `createPaymentInstrument`, `getPaymentInstrument`)
  - 3DS authentication (`setupAuthentication`, `checkEnrollment`, `validateAuthentication`)
  - Payment processing (`processPayment`, `refundPayment`, `voidPayment`)
  - Health check (`ping`)
- `InMemoryThreeDSAuthCache` with automatic TTL-based cleanup
- `CyberSourceError` extending `PaymentError` from `@panama-payments/core`
- `promisifySdkCall` utility for wrapping callback-based `cybersource-rest-client` APIs
- React hooks (all headless, no JSX):
  - `useThreeDS` -- state machine orchestrator for the full 3DS flow
  - `useSetupService` -- setup authentication step
  - `useCheckEnrollment` -- enrollment check with frictionless/challenge detection
  - `useValidateAuth` -- post-challenge validation
  - `usePayment` -- payment processing
  - `usePaymentMethods` -- card add/delete management
- `ThreeDSModal` component (unstyled `<dialog>` with auto-submitting form and `postMessage` listener)
- Full TypeScript types and enums (`CyberSourceEnvironment`, `ThreeDSStatus`, `PaymentStatus`, `EnrollmentResult`, `CardType`, `ThreeDSStep`)
- Examples for Express, Next.js API routes, Next.js checkout page, and React Native
- Complete documentation: getting started, flow diagrams (Mermaid), integration guide, API reference, env vars, database model
