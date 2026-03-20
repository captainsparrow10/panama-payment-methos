# @devhubpty/cmf

SDK for CMF (Banco General / CM Financiera / HNL) financing integration in Panama.

Provides a server-side client for the CMF API and React hooks/components for building payment UIs.

## Authors

- [captainsparrow10](https://github.com/captainsparrow10)
- [Reddsito](https://github.com/Reddsito)

## Features

- Full CMF API coverage: authentication, customer lookup, quota simulation, payments, OTP, transaction verification
- Typed error handling with `CMFError` extending `PaymentError`
- Automatic retry with exponential backoff for network/timeout errors
- Structured logging with PCI-safe data sanitization
- Idempotency key support for payment deduplication
- Health check via `ping()`
- React hooks for customer search, OTP, quotas, and payments
- Headless `CMFPaymentForm` component for drop-in checkout integration

## Installation

```bash
pnpm add @devhubpty/cmf @devhubpty/core
```

## Quick Start

### Server-side

```ts
import { CMFClient, CMFDocumentType } from '@devhubpty/cmf/server';

const cmf = new CMFClient({
  baseUrl: process.env.CMF_URL!,
  email: process.env.CMF_EMAIL!,
  password: process.env.CMF_PASSWORD!,
  branchOfficeCode: 'MKP',
  companyCode: 'MKP',
  createdBy: 'system',
});

await cmf.ensureAuthenticated();
const customer = await cmf.getCustomerByDocument(CMFDocumentType.Cedula, '8-123-456');
const products = await cmf.getCustomerProducts(customer.id);
const quotas = await cmf.getQuotas(products[0].customerProductId, 500);
```

### React (frontend)

```tsx
import { CMFPaymentForm } from '@devhubpty/cmf/react';

<CMFPaymentForm
  total={150.00}
  userName="Juan Perez"
  description="Order #12345"
  onSuccess={(receiptNumber) => confirmOrder(receiptNumber)}
  onError={(msg) => alert(msg)}
/>
```

## Package Exports

| Entry Point | Usage | Description |
|-------------|-------|-------------|
| `@devhubpty/cmf/server` | Node.js only | `CMFClient`, types, enums, `CMFError` |
| `@devhubpty/cmf/react` | Browser + SSR | Hooks, `CMFPaymentForm`, types, enums |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Payment Flows](./docs/flow.md) (with Mermaid diagrams)
- [Integration Guide](./docs/integration-guide.md) (Express + Next.js)
- [API Reference](./docs/api-reference.md)
- [Environment Variables](./docs/env-vars.md)
- [Database Model](./docs/database-model.md)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CMF_URL` | Yes | CMF API base URL |
| `CMF_EMAIL` | Yes | Merchant email |
| `CMF_PASSWORD` | Yes | Merchant password |
| `CMF_BRANCH_OFFICE_CODE` | Yes | Branch office code (e.g. `MKP`) |
| `CMF_COMPANY_CODE` | Yes | Company code (e.g. `MKP`) |
| `CMF_CREATED_BY` | No | Audit trail identifier (default: `system`) |

## Error Handling

```ts
import { CMFError } from '@devhubpty/cmf/server';
import { TimeoutError, NetworkError } from '@devhubpty/core';

try {
  await cmf.processPurchaseInQuotas(params);
} catch (error) {
  if (error instanceof CMFError) {
    // Business error -- not retryable
    console.error(error.message, error.statusResult);
  } else if (error instanceof TimeoutError) {
    // Timeout -- retryable
  } else if (error instanceof NetworkError) {
    // Network issue -- retryable
  }
}
```

## License

MIT
