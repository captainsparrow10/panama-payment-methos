# Environment Variables

Complete reference for all environment variables used by `@devhubpty/yappy`.

## Required Variables

These variables are needed for all integrations:

| Variable | Description | Example | Where to get it |
|----------|-------------|---------|-----------------|
| `YAPPY_MERCHANT_ID` | Your merchant ID from Yappy Comercial | `MID-12345` | Yappy Comercial dashboard |
| `YAPPY_URL_DOMAIN` | The domain you registered in Yappy Comercial | `https://mystore.com` | Yappy Comercial dashboard |
| `CLAVE_SECRETA` | Base64-encoded HMAC secret key for webhook verification | `dGVzdC5zZWNyZXQ=` | Yappy Comercial dashboard |

## Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `YAPPY_ENVIRONMENT` | API environment | `'production'` | Use `'sandbox'` for testing |
| `BASE_URL` | Your backend URL (used to construct `ipnUrl`) | -- | e.g., `https://api.mystore.com` |

## API URLs by Environment

| Environment | API URL | CDN URL |
|-------------|---------|---------|
| `production` | `https://apipagosbg.bgeneral.cloud` | `https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js` |
| `sandbox` | `https://api-comecom-uat.yappycloud.com` | `https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js` |

## Example `.env` File

```env
# ============================================================
# Yappy Payment Configuration
# ============================================================

# Required: Merchant credentials
YAPPY_MERCHANT_ID=your-merchant-id-here
YAPPY_URL_DOMAIN=https://mystore.com
CLAVE_SECRETA=your-base64-encoded-clave-secreta

# Optional: Environment (default: production)
YAPPY_ENVIRONMENT=sandbox

# Your backend URL (for webhook ipnUrl construction)
BASE_URL=https://api.mystore.com
```

## Next.js Configuration

In Next.js, server-only variables should NOT have the `NEXT_PUBLIC_` prefix:

```env
# Server-only (API routes / server components)
YAPPY_MERCHANT_ID=your-merchant-id
YAPPY_URL_DOMAIN=https://mystore.com
CLAVE_SECRETA=your-secret-key
YAPPY_ENVIRONMENT=sandbox

# Public (if you need to construct URLs client-side)
NEXT_PUBLIC_BASE_URL=https://mystore.com
```

## Security Notes

- **NEVER expose** `YAPPY_MERCHANT_ID`, `YAPPY_URL_DOMAIN`, or `CLAVE_SECRETA` to the browser
- These values must only be used in server-side code (API routes, server components)
- The frontend communicates with Yappy **only** through your backend endpoints
- The `CLAVE_SECRETA` is particularly sensitive -- it's used for webhook hash verification
