# Getting Started with @devhubpty/yappy

This guide walks you through setting up Yappy payments in your application, from obtaining credentials to processing your first payment.

## Prerequisites

- A registered business in Panama
- A Banco General business account with Yappy Comercial enabled
- Node.js 18+ (server-side)
- React 18+ (optional, for React hooks/components)

## Step 1: Register in Yappy Comercial

1. Go to [Yappy Comercial](https://comercial.yappy.com.pa/)
2. Register your business using your Banco General credentials
3. Complete the business verification process

## Step 2: Create your integration

1. In the Yappy Comercial dashboard, navigate to **Integraciones**
2. Select **API de pagos** (Payment API)
3. Register your domain URL (e.g., `https://mystore.com`)

## Step 3: Obtain your credentials

After approval, you will receive:

| Credential | Description | Env Variable |
|------------|-------------|-------------|
| **Merchant ID** | Your unique merchant identifier | `YAPPY_MERCHANT_ID` |
| **URL Domain** | The domain you registered | `YAPPY_URL_DOMAIN` |
| **Clave Secreta** | Base64-encoded HMAC key for webhook verification | `CLAVE_SECRETA` |

You will also get access to:
- **Sandbox API**: `https://api-comecom-uat.yappycloud.com` (for testing)
- **Production API**: `https://apipagosbg.bgeneral.cloud` (for real transactions)

## Step 4: Install the SDK

```bash
# npm
npm install @devhubpty/yappy @devhubpty/core

# pnpm (monorepo)
pnpm add @devhubpty/yappy @devhubpty/core

# bun
bun add @devhubpty/yappy @devhubpty/core
```

## Step 5: Configure environment variables

Create a `.env` file in your project root:

```env
# Required
YAPPY_MERCHANT_ID=your-merchant-id
YAPPY_URL_DOMAIN=https://yourdomain.com
CLAVE_SECRETA=your-base64-encoded-secret

# Optional
YAPPY_ENVIRONMENT=sandbox  # 'sandbox' for testing, 'production' for real payments
BASE_URL=https://api.yourdomain.com  # Your backend URL for webhooks
```

## Step 6: Set up the server

```typescript
import { YappyClient } from '@devhubpty/yappy/server';
import { createConsoleLogger } from '@devhubpty/core';

const yappy = new YappyClient(
  {
    merchantId: process.env.YAPPY_MERCHANT_ID!,
    urlDomain: process.env.YAPPY_URL_DOMAIN!,
    environment: process.env.YAPPY_ENVIRONMENT as 'production' | 'sandbox' ?? 'sandbox',
  },
  {
    logger: createConsoleLogger({ level: 'debug', prefix: '[yappy]' }),
    retry: { maxAttempts: 2 },
  },
);

// Verify connectivity
const isHealthy = await yappy.ping();
console.log('Yappy API reachable:', isHealthy);
```

## Step 7: Process your first payment

### Server-side (checkout endpoint)

```typescript
// POST /api/yappy/checkout
const result = await yappy.initCheckout({
  ipnUrl: `${process.env.BASE_URL}/api/yappy/webhook`,
  total: '0.01',      // Use 0.01 for sandbox testing
  subtotal: '0.01',
  discount: '0.00',
  taxes: '0.00',
  aliasYappy: '60800011',  // Test phone number
});

// Save result.orderId to your database!
console.log('Order created:', result.orderId);
```

### Client-side (React)

```tsx
import { YappyButton } from '@devhubpty/yappy/react';

<YappyButton
  checkoutEndpoint="/api/yappy/checkout"
  onSuccess={(detail) => console.log('Payment success!', detail)}
  onError={(detail) => console.error('Payment failed', detail)}
  environment="sandbox"
/>
```

## Next steps

- Read the [Integration Guide](./integration-guide.md) for complete React and vanilla JS examples
- Review the [Payment Flow](./flow.md) diagrams to understand the full lifecycle
- Check the [API Reference](./api-reference.md) for all available methods and types
- Set up your [Webhook Handler](./integration-guide.md#webhook-handler) to process payment results
- See [Environment Variables](./env-vars.md) for a complete configuration reference
