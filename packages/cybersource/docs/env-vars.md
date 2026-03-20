# Environment Variables

All environment variables required for the CyberSource SDK.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CYBERSOURCE_MERCHANT_ID` | Your CyberSource merchant ID | `mtb_test` (sandbox) |
| `CYBERSOURCE_KEY` | Key ID for http_signature authentication | `08c94330-f618-42a3-b09d-e1e43be5efda` |
| `CYBERSOURCE_SHARED_SECRET_KEY` | Shared secret key (base64 encoded) | `yBJxy6LjM2TmcPGu+GaJrHtkke25fPpUX+UY6/L/1tE=` |
| `CYBERSOURCE_RUN_ENVIRONMENT` | API environment hostname | `apitest.cybersource.com` (test) or `api.cybersource.com` (production) |

## Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CYBERSOURCE_PROFILE_ID` | TMS profile ID (for tokenization scoping) | `93B32398-AD51-4CC2-A682-EA3E93614EB1` |

## Environment Values

### Test (Sandbox)

```env
CYBERSOURCE_MERCHANT_ID=mtb_test
CYBERSOURCE_KEY=08c94330-f618-42a3-b09d-e1e43be5efda
CYBERSOURCE_SHARED_SECRET_KEY=yBJxy6LjM2TmcPGu+GaJrHtkke25fPpUX+UY6/L/1tE=
CYBERSOURCE_RUN_ENVIRONMENT=apitest.cybersource.com
```

### Production

```env
CYBERSOURCE_MERCHANT_ID=your_prod_merchant_id
CYBERSOURCE_KEY=your_prod_key_id
CYBERSOURCE_SHARED_SECRET_KEY=your_prod_shared_secret
CYBERSOURCE_RUN_ENVIRONMENT=api.cybersource.com
```

## SDK Configuration Mapping

The environment variables map to the `CyberSourceClientConfig` interface:

```ts
import { CyberSourceClient, CyberSourceEnvironment } from '@devhubpty/cybersource/server';

const client = new CyberSourceClient({
  merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,       // CYBERSOURCE_MERCHANT_ID
  keyId: process.env.CYBERSOURCE_KEY!,                    // CYBERSOURCE_KEY
  sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,  // CYBERSOURCE_SHARED_SECRET_KEY
  environment: process.env.CYBERSOURCE_RUN_ENVIRONMENT === 'api.cybersource.com'
    ? CyberSourceEnvironment.Production
    : CyberSourceEnvironment.Test,                        // CYBERSOURCE_RUN_ENVIRONMENT
  profileId: process.env.CYBERSOURCE_PROFILE_ID,          // CYBERSOURCE_PROFILE_ID (optional)
});
```

## Security Notes

- **Never expose** these variables to the browser. They must remain server-side only.
- In Next.js, do **not** prefix them with `NEXT_PUBLIC_`.
- The `sharedSecretKey` is a base64-encoded HMAC secret used for API authentication.
- Rotate keys periodically via the CyberSource Business Center.
- The SDK uses `http_signature` authentication (not `jwt`).

## CyberSource Business Center

To obtain your credentials:

1. Log in to the [CyberSource Business Center](https://ebc2.cybersource.com/) (test) or [EBC](https://ebc.cybersource.com/) (production).
2. Navigate to **Payment Configuration** > **Key Management**.
3. Generate a new **REST Shared Secret Key** (http_signature type).
4. Copy the **Key ID** (UUID) and **Shared Secret** (base64).
5. Your **Merchant ID** is shown in the top-right of the dashboard.
