# @panama-payments/core

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Shared utilities for Panama payment SDKs. Provides error types, retry logic, PCI-compliant data redaction, pluggable logging, and test helpers used across all `@panama-payments/*` packages.

## Installation

```bash
npm install @panama-payments/core
# or
pnpm add @panama-payments/core
```

## Utilities

### Error Hierarchy

All SDK errors extend `PaymentError`, making it easy to catch any payment-related error in a single handler.

```ts
import {
  PaymentError,
  ValidationError,
  DeclinedError,
  TimeoutError,
} from '@panama-payments/core';

try {
  await client.processPayment(data);
} catch (error) {
  if (error instanceof DeclinedError) {
    console.log(`Declined: ${error.declineCode}`);
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out, safe to retry');
  } else if (error instanceof PaymentError) {
    console.log(`Payment error [${error.code}]: ${error.message}`);
  }
}
```

**Available errors:** `PaymentError`, `ValidationError`, `AuthenticationError`, `DeclinedError`, `TimeoutError`, `RateLimitError`, `ConfigError`, `NetworkError`

### Retry with Exponential Backoff

Automatically retries transient failures (timeouts, network errors, rate limits) with configurable exponential backoff and jitter.

```ts
import { withRetry } from '@panama-payments/core';

const result = await withRetry(() => client.processPayment(data), {
  maxAttempts: 3,
  baseDelayMs: 1000,
  onRetry: (err, attempt, delay) => {
    console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
  },
});
```

### Pluggable Logger

Works with Winston, Pino, or any logger implementing `debug/info/warn/error`. Ships with a zero-dependency console logger for development.

```ts
import { createConsoleLogger, noopLogger } from '@panama-payments/core';

// Development: console logger with timestamps
const logger = createConsoleLogger({ level: 'debug', prefix: '[cmf]' });

// Production: pass your existing logger
import pino from 'pino';
new CMFClient({ logger: pino() });

// Disable logging
new CMFClient({ logger: noopLogger });
```

### PCI Data Redaction

Sanitize sensitive fields before logging. Handles card numbers, CVVs, tokens, API keys, and Yappy secrets.

```ts
import { sanitize, maskCardNumber } from '@panama-payments/core';

const safe = sanitize({
  cardNumber: '4111111111111111',
  cvv: '123',
  name: 'Juan Perez',
});
// { cardNumber: '****1111', cvv: '****', name: 'Juan Perez' }

maskCardNumber('4111111111111111');
// '************1111'
```

### Idempotency Keys

Prevent duplicate charges on retries by attaching a unique idempotency key to each request.

```ts
import { generateIdempotencyKey, IDEMPOTENCY_HEADER } from '@panama-payments/core';

const key = generateIdempotencyKey();
headers[IDEMPOTENCY_HEADER] = key;
```

### Rate Limit Handling

Parse `Retry-After` headers and wait the appropriate duration before retrying.

```ts
import { parseRateLimitHeaders, waitForRateLimit } from '@panama-payments/core';

const info = parseRateLimitHeaders(response.headers, response.status);
if (info.limited) {
  await waitForRateLimit(info);
}
```

### Health Check

Verify API endpoint reachability with latency measurement.

```ts
import { checkHealth } from '@panama-payments/core';

const health = await checkHealth('https://apitest.cybersource.com');
if (health.reachable) {
  console.log(`API is up (${health.latencyMs}ms)`);
}
```

### OpenTelemetry (Opt-in)

Automatic tracing when `@opentelemetry/api` is installed. No-op when it is not.

```ts
import { createSpan } from '@panama-payments/core';

const span = createSpan('cybersource.processPayment', { amount: '50.00' });
try {
  const result = await processPayment(data);
  span.setAttribute('status', 'success');
  return result;
} catch (error) {
  span.setError(error);
  throw error;
} finally {
  span.end();
}
```

### Test Utilities

Sandbox test cards, unique order IDs, and webhook payload generators for integration testing.

```ts
import {
  TEST_CARDS,
  generateTestOrderId,
  generateTestWebhookPayload,
} from '@panama-payments/core';

// Use a test card in sandbox
const payment = await client.processPayment({
  cardNumber: TEST_CARDS.VISA_APPROVED.number,
  amount: '10.00',
});

// Generate a unique order ID
const orderId = generateTestOrderId('ORD'); // 'ORD-1710936000-a3f2'

// Create a signed webhook payload for testing
const { payload, signature } = generateTestWebhookPayload(
  { orderId: 'TEST-001', status: 'E' },
  secretKey,
  'TEST-001E',
);
```

## Used By

This package provides the foundation for:

- [`@panama-payments/cybersource`](../cybersource/) — CyberSource payment processing with 3DS
- [`@panama-payments/yappy`](../yappy/) — Yappy mobile payment integration
- [`@panama-payments/cmf`](../cmf/) — CMF bank payment processing

## Contributors

- [captainsparrow10](https://github.com/captainsparrow10)
- [Reddsito](https://github.com/Reddsito)

## License

[MIT](../../LICENSE)
