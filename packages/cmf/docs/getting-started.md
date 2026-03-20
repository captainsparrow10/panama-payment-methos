# Getting Started

## Installation

```bash
# pnpm (recommended for monorepos)
pnpm add @panama-payments/cmf @panama-payments/core

# npm
npm install @panama-payments/cmf @panama-payments/core

# bun
bun add @panama-payments/cmf @panama-payments/core
```

## Quick Setup

### 1. Set environment variables

```env
CMF_URL=https://qa-idilw8q1smn68l4eux.cmf.com.pa/mdl03/api
CMF_EMAIL=your-merchant@email.com
CMF_PASSWORD=your-merchant-password
CMF_BRANCH_OFFICE_CODE=MKP
CMF_COMPANY_CODE=MKP
CMF_CREATED_BY=system
```

### 2. Create the client (server-side only)

```ts
import { CMFClient } from '@panama-payments/cmf/server';

const cmf = new CMFClient({
  baseUrl: process.env.CMF_URL!,
  email: process.env.CMF_EMAIL!,
  password: process.env.CMF_PASSWORD!,
  branchOfficeCode: process.env.CMF_BRANCH_OFFICE_CODE!,
  companyCode: process.env.CMF_COMPANY_CODE!,
  createdBy: process.env.CMF_CREATED_BY ?? 'system',
});
```

### 3. Add logging (optional but recommended)

```ts
import { createConsoleLogger } from '@panama-payments/core';

const cmf = new CMFClient(
  { /* config */ },
  {
    logger: createConsoleLogger({ level: 'debug', prefix: '[cmf]' }),
    retry: { maxAttempts: 3 },
  },
);
```

### 4. Make your first API call

```ts
import { CMFDocumentType } from '@panama-payments/cmf/server';

await cmf.ensureAuthenticated();
const customer = await cmf.getCustomerByDocument(CMFDocumentType.Cedula, '8-123-456');
console.log(`Found: ${customer.fullName}`);
```

### 5. Use React hooks (frontend)

```tsx
import { useCMFCustomer, CMFDocumentType } from '@panama-payments/cmf/react';

function CustomerSearch() {
  const { search, customer, products, isLoading, error } = useCMFCustomer();

  return (
    <button onClick={() => search(CMFDocumentType.Cedula, '8-123-456')}>
      {isLoading ? 'Searching...' : 'Search'}
    </button>
  );
}
```

## Next Steps

- [Complete Flow Guide](./flow.md) -- step-by-step payment flows with diagrams
- [Integration Guide](./integration-guide.md) -- Express and Next.js integration
- [API Reference](./api-reference.md) -- full CMFClient API documentation
- [Environment Variables](./env-vars.md) -- all configuration options
