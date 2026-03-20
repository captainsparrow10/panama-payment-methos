# @panama-payments/cybersource

SDK for CyberSource 3DS payment integration with card tokenization, vaulting, and payment processing.

Built for Panama e-commerce platforms. Supports the complete CyberSource payment lifecycle:
3D Secure authentication (frictionless + challenge), card tokenization (TMS), authorize + capture
payments, refunds, and voids.

## Installation

```bash
pnpm add @panama-payments/cybersource @panama-payments/core
```

## Quick Start

### Server (Node.js / Express / Next.js API)

```ts
import {
  CyberSourceClient,
  CyberSourceEnvironment,
} from '@panama-payments/cybersource/server';

const client = new CyberSourceClient({
  merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
  keyId: process.env.CYBERSOURCE_KEY!,
  sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
  environment: CyberSourceEnvironment.Test,
});

// Create customer
const customer = await client.createCustomer({ customerId: 'user-123', email: 'juan@example.com' });

// Tokenize card (2-step)
const ii = await client.createInstrumentIdentifier({ cardNumber: '4111111111111111', securityCode: '123' });
const pi = await client.createPaymentInstrument({ cybersourceCustomerId: customer.id, instrumentIdentifierTokenId: ii.id, ... });

// 3DS authentication (3-step)
const setup = await client.setupAuthentication({ cybersourceCustomerId: customer.id, paymentInstrumentId: pi.id });
const enrollment = await client.checkEnrollment({ referenceId: setup.consumerAuthenticationInformation.referenceId, ... });
// If challenge: const validation = await client.validateAuthentication({ authenticationTransactionId: '...' });

// Process payment
const payment = await client.processPayment({ totalAmount: '25.99', currency: 'USD', auth3DSResult: { ... }, ... });
```

### React (Browser)

```tsx
import { useThreeDS, ThreeDSModal, ThreeDSStep } from '@panama-payments/cybersource/react';

function Checkout() {
  const threeDS = useThreeDS({
    onSetup: (p) => fetch('/api/cybersource/setup', { method: 'POST', body: JSON.stringify(p) }).then(r => r.json()).then(r => r.data),
    onCheckEnrollment: (p) => fetch('/api/cybersource/enroll', { method: 'POST', body: JSON.stringify(p) }).then(r => r.json()).then(r => r.data),
    onValidate: (p) => fetch('/api/cybersource/validate', { method: 'POST', body: JSON.stringify(p) }).then(r => r.json()).then(r => r.data),
  });

  return (
    <>
      <button onClick={() => threeDS.startAuth({ paymentInstrumentId: '...', cybersourceId: '...', amount: '25.99', currency: 'USD', billingAddress: { ... }, returnUrl: '...' })}>
        Pay
      </button>

      {threeDS.challengeRequired && (
        <ThreeDSModal
          challengeUrl={threeDS.challengeUrl!}
          challengeJwt={threeDS.challengeJwt!}
          onComplete={() => threeDS.completeChallenge('...')}
          onCancel={() => threeDS.reset()}
        />
      )}

      {threeDS.step === ThreeDSStep.Ready && <p>Authenticated! Ready to pay.</p>}
    </>
  );
}
```

## Package Exports

| Import | Environment | Description |
|--------|-------------|-------------|
| `@panama-payments/cybersource/server` | Node.js | `CyberSourceClient`, cache, promisify, types |
| `@panama-payments/cybersource/react` | Browser | Hooks, `ThreeDSModal`, types |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Flow Diagrams](./docs/flow.md) (Mermaid)
- [Integration Guide](./docs/integration-guide.md)
- [API Reference](./docs/api-reference.md)
- [Environment Variables](./docs/env-vars.md)
- [Database Model](./docs/database-model.md)

## Examples

- [Express routes](./examples/express/routes.ts)
- [Express 3DS flow](./examples/express/three-ds-flow.ts)
- [Next.js API routes](./examples/nextjs/api/)
- [Next.js checkout page](./examples/nextjs/checkout-page.tsx)
- [React Native 3DS challenge](./examples/react-native/three-ds-challenge.md)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CYBERSOURCE_MERCHANT_ID` | Merchant ID |
| `CYBERSOURCE_KEY` | Key ID (UUID) for http_signature |
| `CYBERSOURCE_SHARED_SECRET_KEY` | Shared secret (base64) |
| `CYBERSOURCE_RUN_ENVIRONMENT` | `apitest.cybersource.com` or `api.cybersource.com` |

## License

MIT

## Contributors

- [captainsparrow10](https://github.com/captainsparrow10)
- [Reddsito](https://github.com/Reddsito)
