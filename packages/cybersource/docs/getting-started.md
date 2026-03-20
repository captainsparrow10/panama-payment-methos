# Getting Started

## Installation

```bash
# With pnpm (recommended for monorepos)
pnpm add @devhubpty/cybersource @devhubpty/core

# With npm
npm install @devhubpty/cybersource @devhubpty/core

# With bun
bun add @devhubpty/cybersource @devhubpty/core
```

## Quick Setup

### 1. Set environment variables

```env
CYBERSOURCE_MERCHANT_ID=your_merchant_id
CYBERSOURCE_KEY=your_key_id_uuid
CYBERSOURCE_SHARED_SECRET_KEY=your_base64_shared_secret
CYBERSOURCE_RUN_ENVIRONMENT=apitest.cybersource.com
```

### 2. Create the client (server-side)

```ts
import {
  CyberSourceClient,
  CyberSourceEnvironment,
} from '@devhubpty/cybersource/server';
import { createConsoleLogger } from '@devhubpty/core';

const client = new CyberSourceClient({
  merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
  keyId: process.env.CYBERSOURCE_KEY!,
  sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
  environment: CyberSourceEnvironment.Test,
  logger: createConsoleLogger({ level: 'debug' }),
});
```

### 3. Verify connectivity

```ts
const health = await client.ping();
console.log(health.ok ? 'Connected' : 'Unreachable');
```

### 4. Use React hooks (client-side)

```tsx
import { useThreeDS, ThreeDSModal } from '@devhubpty/cybersource/react';

const threeDS = useThreeDS({
  onSetup: async (payload) => {
    const res = await fetch('/api/cybersource/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return (await res.json()).data;
  },
  onCheckEnrollment: async (payload) => {
    const res = await fetch('/api/cybersource/enroll', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return (await res.json()).data;
  },
  onValidate: async (payload) => {
    const res = await fetch('/api/cybersource/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return (await res.json()).data;
  },
});
```

## Package Exports

| Import path | Environment | Contains |
|-------------|-------------|----------|
| `@devhubpty/cybersource/server` | Node.js | `CyberSourceClient`, auth cache, types, enums |
| `@devhubpty/cybersource/react` | Browser | Hooks, `ThreeDSModal`, types, enums |

## Next Steps

- [Flow diagrams](./flow.md) -- visual overview of all payment flows
- [Integration guide](./integration-guide.md) -- step-by-step integration instructions
- [API reference](./api-reference.md) -- complete method documentation
- [Environment variables](./env-vars.md) -- required configuration
