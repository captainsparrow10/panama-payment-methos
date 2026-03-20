# Changelog

All notable changes to `@panama-payments/yappy` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-20

### Added

- **Server**
  - `YappyClient` class with `validateMerchant()`, `createOrder()`, `initCheckout()`, and `ping()` methods
  - Integration with `@panama-payments/core` for structured logging (`PaymentLogger`), PCI-safe sanitization (`sanitize()`), and automatic retry (`withRetry()`)
  - `YappyError` class extending `PaymentError` from `@panama-payments/core`, with Yappy-specific error codes
  - `validateYappyHash()` with HMAC-SHA256 and `crypto.timingSafeEqual` for webhook verification
  - `parseYappyWebhook()` for parsing and typing raw webhook query params
  - `generateTestWebhook()` static utility for generating valid test webhook payloads
  - `generateOrderId()` helper for 15-character alphanumeric order IDs

- **React**
  - `useYappyWebComponent` hook for official `<btn-yappy>` CDN integration
  - `useYappyCheckout` hook for initiating payments from custom UIs
  - `useYappyOrderStatus` hook for polling payment status
  - `useYappyPendingCheck` orchestrator hook with timer, localStorage persistence, and lifecycle callbacks
  - `YappyButton` component wrapping the official web component
  - `YappyPhoneInput` accessible phone input with Panamanian number validation
  - `YappyPendingModal` semantic dialog for pending payment state

- **Vanilla JS**
  - `initYappyButton()` for framework-agnostic web component integration (Vue, Svelte, Angular, plain HTML)

- **Types**
  - `YappyStatus` enum (`E`, `R`, `C`, `X`)
  - `YappyButtonTheme` enum (6 themes)
  - `YappyErrorCode` enum with `YAPPY_ERROR_MESSAGES` mapping
  - Full TypeScript types for all API requests, responses, and configurations

- **Documentation**
  - Getting started guide (7-step credential setup)
  - Payment flow diagrams (Mermaid: web component flow, custom polling flow, webhook states, hook state machine)
  - Integration guide (React, vanilla JS, webhook handler, testing)
  - API reference
  - Environment variables reference
  - Database model reference (PostgreSQL, Sequelize, Prisma)

- **Examples**
  - Express.js checkout endpoint and webhook handler
  - Next.js App Router API routes (checkout, webhook, status, cancel)
  - Next.js checkout page with custom UI
