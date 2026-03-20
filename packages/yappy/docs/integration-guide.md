# Integration Guide

Complete guide for integrating Yappy payments into your application using `@panama-payments/yappy`.

## Table of Contents

- [Choose your approach](#choose-your-approach)
- [Server setup](#server-setup)
- [Approach 1: Web Component (CDN)](#approach-1-web-component-cdn)
- [Approach 2: Custom UI (Polling)](#approach-2-custom-ui-polling)
- [Approach 3: Vanilla JS](#approach-3-vanilla-js)
- [Webhook handler](#webhook-handler)
- [Testing webhooks](#testing-webhooks)
- [TypeScript setup](#typescript-setup)
- [Error handling](#error-handling)

---

## Choose your approach

| Approach | Best for | Complexity |
|----------|----------|------------|
| **Web Component (CDN)** | Quick integration, Banco General's recommended approach | Low |
| **Custom UI (Polling)** | Full control over UI, custom pending modal | Medium |
| **Vanilla JS** | Non-React projects (Vue, Svelte, Angular, plain HTML) | Low |

---

## Server setup

All approaches share the same server-side setup. Your backend needs:

1. A **checkout endpoint** that creates the Yappy order
2. A **webhook endpoint** that receives payment results from Yappy
3. (For custom UI) A **status endpoint** for polling and a **cancel endpoint**

```typescript
// server.ts
import { YappyClient } from '@panama-payments/yappy/server';
import { createConsoleLogger } from '@panama-payments/core';

export const yappy = new YappyClient(
  {
    merchantId: process.env.YAPPY_MERCHANT_ID!,
    urlDomain: process.env.YAPPY_URL_DOMAIN!,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  },
  {
    logger: createConsoleLogger({ level: 'info', prefix: '[yappy]' }),
    retry: { maxAttempts: 2, baseDelayMs: 500 },
  },
);
```

---

## Approach 1: Web Component (CDN)

### React

```tsx
'use client';

import { YappyButton } from '@panama-payments/yappy/react';

export function CheckoutPage() {
  return (
    <YappyButton
      checkoutEndpoint="/api/yappy/checkout"
      checkoutPayload={{ total: '25.00', cartId: 'abc' }}
      onSuccess={(detail) => {
        // Redirect to success page
        window.location.href = '/checkout/success';
      }}
      onError={(detail) => {
        console.error('Yappy payment error:', detail);
      }}
      theme="blue"
      rounded={true}
      renderOffline={<p>Yappy no esta disponible en este momento.</p>}
      environment="sandbox"
    />
  );
}
```

### Using the hook directly

For more control over the button rendering:

```tsx
'use client';

import { useYappyWebComponent } from '@panama-payments/yappy/react';

export function CustomCheckout() {
  const { btnRef, isOnline, isLoading, isCdnLoaded } = useYappyWebComponent({
    checkoutEndpoint: '/api/yappy/checkout',
    checkoutPayload: { total: '25.00' },
    onSuccess: (detail) => console.log('Success!', detail),
    onError: (detail) => console.error('Error:', detail),
    environment: 'sandbox',
  });

  if (!isOnline) return <p>Yappy offline</p>;
  if (!isCdnLoaded) return <p>Cargando Yappy...</p>;

  return (
    <div className="my-checkout-wrapper">
      <btn-yappy ref={btnRef} theme="blue" rounded="true" />
      {isLoading && <p>Procesando...</p>}
    </div>
  );
}
```

---

## Approach 2: Custom UI (Polling)

### Full custom flow with useYappyPendingCheck

```tsx
'use client';

import {
  useYappyPendingCheck,
  YappyPhoneInput,
  YappyPendingModal,
} from '@panama-payments/yappy/react';

export function CustomYappyCheckout({ total }: { total: string }) {
  const {
    status,
    timeLeft,
    startPayment,
    cancelPayment,
    isLoading,
    error,
  } = useYappyPendingCheck({
    checkoutEndpoint: '/api/yappy/checkout',
    statusEndpoint: '/api/yappy/status',
    cancelEndpoint: '/api/yappy/cancel',
    onSuccess: ({ orderId }) => {
      window.location.href = `/success?order=${orderId}`;
    },
    onError: ({ status, message }) => {
      console.error(`Payment ${status}:`, message);
    },
    interval: 3000,
  });

  if (status !== 'idle') {
    return (
      <YappyPendingModal
        status={status}
        timeLeft={timeLeft}
        onCancel={cancelPayment}
        error={error}
      />
    );
  }

  return (
    <div>
      <h2>Pagar ${total} con Yappy</h2>
      <YappyPhoneInput
        onSubmit={(phone) => startPayment(phone, { total })}
        disabled={isLoading}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

### Step-by-step with separate hooks

```tsx
import { useYappyCheckout, useYappyOrderStatus } from '@panama-payments/yappy/react';

function StepByStepCheckout() {
  const checkout = useYappyCheckout({ checkoutEndpoint: '/api/yappy/checkout' });

  const orderStatus = useYappyOrderStatus({
    statusEndpoint: '/api/yappy/status',
    orderId: checkout.data?.orderId ?? null,
    interval: 3000,
    expiresAt: checkout.data?.expiresAt,
  });

  // Handle checkout.data, orderStatus.data, etc.
}
```

---

## Approach 3: Vanilla JS

For Vue, Svelte, Angular, or plain HTML projects:

```typescript
import { initYappyButton } from '@panama-payments/yappy/vanilla';

const container = document.getElementById('yappy-container')!;

const cleanup = initYappyButton(container, {
  checkoutEndpoint: '/api/yappy/checkout',
  checkoutPayload: { total: '25.00' },
  theme: 'blue',
  rounded: true,
  onSuccess: (detail) => {
    window.location.href = '/success';
  },
  onError: (detail) => {
    alert('Pago fallido. Intenta nuevamente.');
  },
  onAvailabilityChange: (isOnline) => {
    if (!isOnline) {
      document.getElementById('yappy-offline-msg')!.style.display = 'block';
    }
  },
  environment: 'sandbox',
});

// When your view is destroyed:
// cleanup();
```

---

## Webhook handler

Your webhook endpoint receives GET requests from Yappy with payment results.

### Express.js

```typescript
import { validateYappyHash, YappyStatus } from '@panama-payments/yappy/server';

app.get('/api/yappy/webhook', async (req, res) => {
  const result = validateYappyHash(
    req.query as Record<string, string>,
    process.env.CLAVE_SECRETA!,
  );

  if (!result.valid) {
    return res.status(400).json({ error: 'Invalid hash' });
  }

  switch (result.status) {
    case YappyStatus.Executed:
      await fulfillOrder(result.orderId);
      break;
    case YappyStatus.Rejected:
    case YappyStatus.Cancelled:
    case YappyStatus.Expired:
      await markOrderFailed(result.orderId, result.status);
      break;
  }

  res.status(200).json({ received: true });
});
```

### Next.js App Router

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateYappyHash, YappyStatus } from '@panama-payments/yappy/server';

export async function GET(request: NextRequest) {
  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((v, k) => { query[k] = v; });

  const result = validateYappyHash(query, process.env.CLAVE_SECRETA!);

  if (!result.valid) {
    return NextResponse.json({ error: 'Invalid hash' }, { status: 400 });
  }

  // Process the payment...
  return NextResponse.json({ received: true });
}
```

---

## Testing webhooks

Use `generateTestWebhook()` to create valid webhook payloads for testing:

```typescript
import {
  generateTestWebhook,
  validateYappyHash,
  YappyStatus,
} from '@panama-payments/yappy/server';

const secretKey = process.env.CLAVE_SECRETA!;

// Generate a test webhook for a successful payment
const { query } = generateTestWebhook(
  {
    orderId: 'TEST123ABC456DE',
    status: YappyStatus.Executed,
    domain: 'https://mystore.com',
  },
  secretKey,
);

// Verify it passes validation
const result = validateYappyHash(query, secretKey);
console.log(result.valid);  // true
console.log(result.status); // 'E'

// Use it in automated tests
const response = await fetch(
  `/api/yappy/webhook?${new URLSearchParams(query).toString()}`,
);
```

---

## TypeScript setup

### JSX IntrinsicElements for `<btn-yappy>`

If you use the `useYappyWebComponent` hook directly (not the `YappyButton` component), you need to declare the custom element type:

```typescript
// global.d.ts or env.d.ts
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'btn-yappy': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        theme?: string;
        rounded?: string;
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}
```

The `YappyButton` component includes this declaration automatically.

---

## Error handling

All server-side errors are instances of `YappyError`, which extends `PaymentError` from `@panama-payments/core`:

```typescript
import { YappyError, YappyErrorCode, YAPPY_ERROR_MESSAGES } from '@panama-payments/yappy/server';
import { PaymentError } from '@panama-payments/core';

try {
  await yappy.initCheckout({ ... });
} catch (error) {
  if (error instanceof YappyError) {
    // Yappy-specific error
    console.log(error.yappyErrorCode); // e.g., 'E007'
    console.log(error.retryable);      // false for most Yappy errors

    // Get user-friendly message
    const message = error.yappyErrorCode
      ? YAPPY_ERROR_MESSAGES[error.yappyErrorCode]
      : error.message;

  } else if (error instanceof PaymentError) {
    // Generic payment error (network, timeout, etc.)
    console.log(error.code);      // e.g., 'NETWORK_ERROR'
    console.log(error.retryable); // true for network errors
  }
}
```
