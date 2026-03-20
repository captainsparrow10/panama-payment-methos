# Integration Guide

Step-by-step guide for integrating `@devhubpty/cybersource` into your application.

## Architecture Overview

```
Frontend (React/Next.js/RN)          Backend (Express/Next.js API)
========================             ===========================
useThreeDS / usePayment  ------>     CyberSourceClient
ThreeDSModal                         - setupAuthentication()
                                     - checkEnrollment()
                                     - validateAuthentication()
                                     - processPayment()
```

The SDK follows a **client-server split**:
- **Server (`/server`)**: `CyberSourceClient` -- calls CyberSource APIs with credentials
- **React (`/react`)**: Hooks + components -- manages UI state, calls your backend

## Step 1: Backend Setup

### Express

```ts
import {
  CyberSourceClient,
  CyberSourceEnvironment,
} from '@devhubpty/cybersource/server';

const client = new CyberSourceClient({
  merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
  keyId: process.env.CYBERSOURCE_KEY!,
  sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
  environment: CyberSourceEnvironment.Test,
});
```

### Next.js API Routes

```ts
// app/api/cybersource/setup/route.ts
import { NextResponse } from 'next/server';
import { client } from '@/lib/cybersource'; // your shared client instance

export async function POST(request: Request) {
  const body = await request.json();
  const result = await client.setupAuthentication({
    cybersourceCustomerId: body.cybersourceId,
    paymentInstrumentId: body.paymentInstrumentId,
    sessionId: body.sessionId,
  });
  return NextResponse.json({ status: 'success', data: result });
}
```

## Step 2: Card Tokenization

Before a user can pay, their card must be tokenized into CyberSource's vault.

```ts
// 1. Create customer (once per user)
const customer = await client.createCustomer({
  customerId: 'user-123',
  email: 'juan@example.com',
});

// 2. Tokenize card (when user adds a card)
const ii = await client.createInstrumentIdentifier({
  cardNumber: '4111111111111111',
  securityCode: '123',
});

// 3. Create payment instrument
const pi = await client.createPaymentInstrument({
  cybersourceCustomerId: customer.id,
  instrumentIdentifierTokenId: ii.id,
  expirationMonth: '12',
  expirationYear: '2028',
  type: '001',
  billTo: {
    firstName: 'Juan',
    lastName: 'Perez',
    address1: 'Calle 50',
    country: 'PA',
    email: 'juan@example.com',
  },
});

// Store customer.id and pi.id in your database
```

## Step 3: 3DS Authentication (Backend)

```ts
// Setup
const setup = await client.setupAuthentication({
  cybersourceCustomerId: customer.id,
  paymentInstrumentId: pi.id,
});

// Enrollment check
const enrollment = await client.checkEnrollment({
  referenceId: setup.consumerAuthenticationInformation.referenceId,
  cybersourceCustomerId: customer.id,
  amount: '25.99',
  currency: 'USD',
  billingAddress: { ... },
  returnUrl: 'https://your-site.com/api/3ds-callback',
});

// If challenge required, frontend handles the iframe.
// After challenge, validate:
const validation = await client.validateAuthentication({
  authenticationTransactionId: '...',
});
```

## Step 4: React Integration

### Using `useThreeDS` (recommended)

```tsx
import { useThreeDS, ThreeDSModal, ThreeDSStep } from '@devhubpty/cybersource/react';

function Checkout() {
  const threeDS = useThreeDS({
    onSetup: (p) => fetch('/api/cybersource/setup', { method: 'POST', body: JSON.stringify(p) }).then(r => r.json()).then(r => r.data),
    onCheckEnrollment: (p) => fetch('/api/cybersource/enroll', { method: 'POST', body: JSON.stringify(p) }).then(r => r.json()).then(r => r.data),
    onValidate: (p) => fetch('/api/cybersource/validate', { method: 'POST', body: JSON.stringify(p) }).then(r => r.json()).then(r => r.data),
  });

  return (
    <>
      <button onClick={() => threeDS.startAuth({ ... })}>Pay</button>

      {threeDS.challengeRequired && (
        <ThreeDSModal
          challengeUrl={threeDS.challengeUrl!}
          challengeJwt={threeDS.challengeJwt!}
          onComplete={() => threeDS.completeChallenge(authTxId)}
          onCancel={() => threeDS.reset()}
        />
      )}

      {threeDS.step === ThreeDSStep.Ready && (
        <button onClick={() => processPayment()}>Confirm Payment</button>
      )}
    </>
  );
}
```

### Using individual hooks

If you need more control, use the individual step hooks:

```tsx
import { useSetupService, useCheckEnrollment, useValidateAuth, usePayment } from '@devhubpty/cybersource/react';

const setup = useSetupService({ onSetup: ... });
const enrollment = useCheckEnrollment({ onCheckEnrollment: ... });
const validation = useValidateAuth({ onValidate: ... });
const payment = usePayment({ onPay: ... });

// Orchestrate the flow manually
```

## Step 5: Payment Processing

```ts
const result = await client.processPayment({
  totalAmount: '25.99',
  currency: 'USD',
  cybersourceCustomerId: customer.id,
  customerId: 'user-123',
  sessionId: 'fingerprint-session',
  auth3DSResult: {
    cavv: enrollment.consumerAuthenticationInformation?.cavv || '',
    xid: enrollment.consumerAuthenticationInformation?.xid || '',
    eciRaw: enrollment.consumerAuthenticationInformation?.eciRaw || '',
    authenticationTransactionId: enrollment.consumerAuthenticationInformation?.authenticationTransactionId || '',
  },
  source: 'web',
  businessId: 'merkapp',
  cardType: '001',
  billTo: { firstName: 'Juan', lastName: 'Perez', address1: 'Calle 50', country: 'PA', email: 'juan@example.com' },
});
```

## 3DS Auth Cache (Fallback)

The `CyberSourceClient` automatically caches 3DS authentication data after
successful enrollment checks and challenge validations. During `processPayment`,
if the frontend does not send all required 3DS fields (common with mobile apps),
the client fills them from the cache.

```ts
// Custom cache (e.g., Redis for multi-instance deployments)
import { CyberSourceClient, type ThreeDSAuthCache } from '@devhubpty/cybersource/server';

class RedisAuthCache implements ThreeDSAuthCache {
  get(key: string) { /* redis.get */ }
  set(key: string, data) { /* redis.set with TTL */ }
  delete(key: string) { /* redis.del */ }
}

const client = new CyberSourceClient({
  ...config,
  authCache: new RedisAuthCache(),
});
```

## Error Handling

```ts
import { CyberSourceError } from '@devhubpty/cybersource/server';
import { PaymentError } from '@devhubpty/core';

try {
  await client.processPayment(data);
} catch (error) {
  if (error instanceof CyberSourceError) {
    // CyberSource-specific error
    console.log(error.processorCode); // 'PROCESSOR_DECLINED'
    console.log(error.code);          // 'DECLINED'
    console.log(error.retryable);     // false
  } else if (error instanceof PaymentError) {
    // Generic payment error (timeout, network, etc.)
    console.log(error.code);
    console.log(error.retryable);
  }
}
```
