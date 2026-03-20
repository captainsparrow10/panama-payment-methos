# @panama-payments/yappy

SDK for [Yappy](https://www.yappy.com.pa/) (Banco General) mobile payment integration in Panama.

Part of the [`@panama-payments`](https://github.com/captainsparrow10/panama-payments) monorepo.

## Features

- **Server-side client** (`YappyClient`) with automatic retry, structured logging, and PCI-safe sanitization via `@panama-payments/core`
- **Webhook validation** with HMAC-SHA256 and `crypto.timingSafeEqual`
- **React hooks and components** for both the official web component and fully custom UIs
- **Vanilla JS** integration for Vue, Svelte, Angular, and plain HTML
- **TypeScript-first** with strict mode and full JSDoc documentation
- **Test utilities** for generating valid webhook payloads

## Installation

```bash
npm install @panama-payments/yappy @panama-payments/core
```

## Quick Start

### Server

```typescript
import { YappyClient } from '@panama-payments/yappy/server';

const yappy = new YappyClient({
  merchantId: process.env.YAPPY_MERCHANT_ID!,
  urlDomain: process.env.YAPPY_URL_DOMAIN!,
  environment: 'sandbox',
});

const result = await yappy.initCheckout({
  ipnUrl: 'https://api.mystore.com/webhooks/yappy',
  total: '25.00',
  subtotal: '25.00',
  discount: '0.00',
  taxes: '0.00',
});
```

### React (Web Component)

```tsx
import { YappyButton } from '@panama-payments/yappy/react';

<YappyButton
  checkoutEndpoint="/api/yappy/checkout"
  onSuccess={(detail) => router.push('/success')}
  environment="sandbox"
/>
```

### React (Custom UI)

```tsx
import { useYappyPendingCheck, YappyPhoneInput, YappyPendingModal } from '@panama-payments/yappy/react';

const { status, timeLeft, startPayment, cancelPayment } = useYappyPendingCheck({
  checkoutEndpoint: '/api/yappy/checkout',
  statusEndpoint: '/api/yappy/status',
  onSuccess: ({ orderId }) => router.push(`/success?order=${orderId}`),
});
```

### Webhook

```typescript
import { validateYappyHash, YappyStatus } from '@panama-payments/yappy/server';

const result = validateYappyHash(req.query, process.env.CLAVE_SECRETA!);
if (result.valid && result.status === YappyStatus.Executed) {
  await fulfillOrder(result.orderId);
}
```

## Documentation

- [Getting Started](./docs/getting-started.md) -- 7-step credential guide
- [Payment Flows](./docs/flow.md) -- Mermaid diagrams for all flows
- [Integration Guide](./docs/integration-guide.md) -- React, vanilla JS, webhooks
- [API Reference](./docs/api-reference.md) -- All exports and types
- [Environment Variables](./docs/env-vars.md) -- Configuration reference
- [Database Model](./docs/database-model.md) -- Suggested schema

## Package Exports

| Entry Point | Description |
|-------------|-------------|
| `@panama-payments/yappy/server` | `YappyClient`, webhook utilities, error classes |
| `@panama-payments/yappy/react` | React hooks and components |
| `@panama-payments/yappy/vanilla` | Framework-agnostic web component integration |

## Contributors

- [captainsparrow10](https://github.com/captainsparrow10)
- [Reddsito](https://github.com/Reddsito)

## License

MIT
