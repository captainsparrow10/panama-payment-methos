# API Reference

Complete reference for all exports from `@devhubpty/yappy`.

## Server (`@devhubpty/yappy/server`)

### YappyClient

The main server-side client for interacting with the Yappy API.

```typescript
import { YappyClient } from '@devhubpty/yappy/server';
```

#### Constructor

```typescript
new YappyClient(config: YappyClientConfig, options?: {
  logger?: PaymentLogger;
  retry?: Partial<RetryConfig>;
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.merchantId` | `string` | Your Yappy merchant ID |
| `config.urlDomain` | `string` | Your registered domain URL |
| `config.environment` | `'production' \| 'sandbox'` | API environment (default: `'production'`) |
| `options.logger` | `PaymentLogger` | Structured logger instance (default: noop) |
| `options.retry` | `Partial<RetryConfig>` | Retry configuration override |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `cdnUrl` | `string` | CDN URL for the `<btn-yappy>` web component |
| `apiUrl` | `string` | Base API URL for this environment |

#### Methods

##### `validateMerchant(): Promise<string>`

Exchanges credentials for a short-lived auth token. Called automatically by `initCheckout()`.

##### `createOrder(params, authToken): Promise<YappyCheckoutResult>`

Creates a payment order using a fresh token from `validateMerchant()`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `params.orderId` | `string` | 15-char alphanumeric order ID |
| `params.ipnUrl` | `string` | Webhook endpoint URL |
| `params.total` | `string` | Total amount (e.g., `"25.00"`) |
| `params.subtotal` | `string` | Subtotal amount |
| `params.discount` | `string` | Discount amount |
| `params.taxes` | `string` | Taxes amount |
| `params.aliasYappy` | `string?` | Customer phone number |
| `authToken` | `string` | Token from `validateMerchant()` |

##### `initCheckout(params): Promise<YappyCheckoutResult & { orderId: string }>`

Orchestrates `validateMerchant()` + `createOrder()` in one call. **Recommended method.**

##### `ping(): Promise<boolean>`

Verifies API connectivity and credentials. Returns `true` if successful.

---

### Webhook Utilities

```typescript
import {
  validateYappyHash,
  parseYappyWebhook,
  generateTestWebhook,
} from '@devhubpty/yappy/server';
```

#### `validateYappyHash(query, secretKey): YappyWebhookResult`

Validates the HMAC-SHA256 hash from a Yappy webhook using `crypto.timingSafeEqual`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `Record<string, string>` | Parsed query string from the GET request |
| `secretKey` | `string` | Your `CLAVE_SECRETA` (base64-encoded) |

Returns `{ valid: boolean, status: YappyStatus, orderId: string, domain: string }`.

#### `parseYappyWebhook(query): YappyWebhookPayload`

Parses raw query params into typed `YappyWebhookPayload`. Throws if required fields are missing.

#### `generateTestWebhook(params, secretKey): { query: Record<string, string> }`

Generates a valid test webhook payload for automated testing.

| Parameter | Type | Description |
|-----------|------|-------------|
| `params.orderId` | `string` | Order ID |
| `params.status` | `YappyStatus` | Status to simulate |
| `params.domain` | `string` | Domain |
| `secretKey` | `string` | Your `CLAVE_SECRETA` |

---

### Helper Functions

#### `generateOrderId(): string`

Returns a random 15-character uppercase alphanumeric string.

---

### YappyError

```typescript
import { YappyError } from '@devhubpty/yappy/server';
```

Extends `PaymentError` from `@devhubpty/core`.

| Property | Type | Description |
|----------|------|-------------|
| `name` | `'YappyError'` | Error name |
| `yappyErrorCode` | `YappyErrorCode?` | Yappy-specific error code |
| `retryable` | `boolean` | Whether safe to retry |
| `code` | `string` | Machine-readable code |

---

## React (`@devhubpty/yappy/react`)

### Hooks

#### `useYappyWebComponent(config): UseYappyWebComponentReturn`

For the official `<btn-yappy>` web component integration.

Returns: `{ btnRef, isOnline, isLoading, isCdnLoaded, setLoading }`

#### `useYappyCheckout(config): UseYappyCheckoutReturn`

For initiating checkout from a custom UI.

Returns: `{ initPayment, isLoading, error, data, reset }`

#### `useYappyOrderStatus(config): UseYappyOrderStatusReturn`

For polling order status.

Returns: `{ data, isPolling, error, stopPolling, startPolling }`

#### `useYappyPendingCheck(config): UseYappyPendingCheckReturn`

Full orchestrator for the custom payment flow.

Returns: `{ status, timeLeft, pendingOrder, startPayment, cancelPayment, reset, isLoading, error }`

### Components

#### `<YappyButton>`

Ready-to-use wrapper around `<btn-yappy>`.

#### `<YappyPhoneInput>`

Accessible phone number input with Panamanian validation.

#### `<YappyPendingModal>`

Semantic modal for the pending payment state.

### Utility Functions

#### `validateYappyPhone(phone: string): boolean`

Validates a Panamanian phone number (8 digits, starts with 6 or 7).

---

## Vanilla (`@devhubpty/yappy/vanilla`)

#### `initYappyButton(container, options): () => void`

Initializes the `<btn-yappy>` web component on a DOM element. Returns a cleanup function.

---

## Enums

### `YappyStatus`

| Value | Code | Description |
|-------|------|-------------|
| `Executed` | `'E'` | Payment confirmed |
| `Rejected` | `'R'` | Payment rejected |
| `Cancelled` | `'C'` | Payment cancelled |
| `Expired` | `'X'` | Payment expired |

### `YappyButtonTheme`

`'blue'`, `'darkBlue'`, `'orange'`, `'dark'`, `'sky'`, `'light'`

### `YappyErrorCode`

`'E002'`, `'E005'`, `'E006'`, `'E007'`, `'E008'`, `'E009'`, `'E010'`, `'E011'`, `'E012'`, `'E100'`

### `YAPPY_ERROR_MESSAGES`

`Record<YappyErrorCode, string>` mapping error codes to user-friendly Spanish messages.
