# Integration Guide

This guide covers how to integrate the CMF SDK into Express.js and Next.js applications.

## Architecture

The CMF SDK uses a client-server architecture:

- **Server** (`@devhubpty/cmf/server`): `CMFClient` holds merchant credentials and talks to the CMF API directly. Must NEVER run in the browser.
- **React** (`@devhubpty/cmf/react`): Hooks and components call your backend API, which proxies to CMF. Safe for browser use.

```
Browser (React hooks) --> Your Backend (CMFClient) --> CMF API
```

## Express.js Integration

### 1. Install dependencies

```bash
pnpm add @devhubpty/cmf @devhubpty/core axios express
pnpm add -D @types/express typescript
```

### 2. Create a shared CMFClient instance

```ts
// src/cmf.ts
import { CMFClient } from '@devhubpty/cmf/server';
import { createConsoleLogger } from '@devhubpty/core';

export const cmf = new CMFClient(
  {
    baseUrl: process.env.CMF_URL!,
    email: process.env.CMF_EMAIL!,
    password: process.env.CMF_PASSWORD!,
    branchOfficeCode: process.env.CMF_BRANCH_OFFICE_CODE!,
    companyCode: process.env.CMF_COMPANY_CODE!,
    createdBy: process.env.CMF_CREATED_BY ?? 'system',
  },
  {
    logger: createConsoleLogger({ level: 'info', prefix: '[cmf]' }),
    retry: { maxAttempts: 2 },
  },
);
```

### 3. Create API routes

See `examples/express/routes.ts` for a complete example with all endpoints.

### 4. Mount routes

```ts
import express from 'express';
import { cmfRouter } from './routes';

const app = express();
app.use(express.json());
app.use('/api/cmf', cmfRouter);
app.listen(3000);
```

## Next.js Integration (App Router)

### 1. Install dependencies

```bash
bun add @devhubpty/cmf @devhubpty/core axios
bun add -D @types/react typescript
```

### 2. Create API routes

Create the following route handlers in your `app/api/cmf/` directory:

- `app/api/cmf/customer/route.ts` -- customer lookup
- `app/api/cmf/otp/route.ts` -- OTP send/verify
- `app/api/cmf/quotas/route.ts` -- quota simulation
- `app/api/cmf/payment/route.ts` -- payment processing

See `examples/nextjs/api/` for complete implementations.

### 3. Use the payment form component

```tsx
// app/checkout/page.tsx
'use client';

import { CMFPaymentForm } from '@devhubpty/cmf/react';

export default function CheckoutPage() {
  return (
    <CMFPaymentForm
      total={250.00}
      userName="Juan Perez"
      description="Order #12345"
      apiBase="/api/cmf"
      onSuccess={(receipt) => {
        // Confirm order in your backend
        fetch('/api/orders/confirm', {
          method: 'POST',
          body: JSON.stringify({ orderId: '12345', cmfReceipt: receipt }),
        });
      }}
      onError={(msg) => alert(msg)}
    />
  );
}
```

### 4. Use individual hooks for custom UIs

If you need more control over the UI, use the hooks directly:

```tsx
'use client';

import { useCMFCustomer, useCMFOtp, useCMFQuotas, useCMFPayment } from '@devhubpty/cmf/react';
import { CMFDocumentType, CMFOtpChannel } from '@devhubpty/cmf/react';

export default function CustomCheckout() {
  const customer = useCMFCustomer();
  const otp = useCMFOtp();
  const quotas = useCMFQuotas();
  const payment = useCMFPayment();

  // Build your custom UI using these hooks
  // Each hook manages its own loading/error state
}
```

## Environment Variables

All CMF credentials must be server-side only (never prefixed with `NEXT_PUBLIC_`):

```env
# .env.local (Next.js) or .env (Express)
CMF_URL=https://qa-idilw8q1smn68l4eux.cmf.com.pa/mdl03/api
CMF_EMAIL=merchant@example.com
CMF_PASSWORD=your-secure-password
CMF_BRANCH_OFFICE_CODE=MKP
CMF_COMPANY_CODE=MKP
CMF_CREATED_BY=system
```

See [env-vars.md](./env-vars.md) for the complete list.

## Error Handling Best Practices

1. **Always wrap CMF calls in try/catch** -- even with retry, calls can still fail.
2. **Check `error instanceof CMFError`** for business errors (insufficient funds, inactive card).
3. **Show `CMFError.message` to users** -- these are human-readable messages from CMF.
4. **Log `CMFError.statusResult`** -- contains structured error details for debugging.
5. **Implement OTP attempt limits** -- max 3 failed verification attempts to avoid phone blocking.
6. **Verify transactions** -- always call `verifyTransaction()` after a successful purchase before fulfilling orders.
