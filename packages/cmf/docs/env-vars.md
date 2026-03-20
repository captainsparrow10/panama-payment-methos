# Environment Variables

All CMF credentials are server-side only. **Never expose them to the browser.**

In Next.js, do NOT prefix these with `NEXT_PUBLIC_`.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CMF_URL` | CMF API base URL (without trailing slash) | `https://qa-idilw8q1smn68l4eux.cmf.com.pa/mdl03/api` |
| `CMF_EMAIL` | Merchant email for CMF API authentication | `merchant@example.com` |
| `CMF_PASSWORD` | Merchant password for CMF API authentication | `SecureP@ss123` |
| `CMF_BRANCH_OFFICE_CODE` | Branch office code assigned by CMF | `MKP` |
| `CMF_COMPANY_CODE` | Company code assigned by CMF | `MKP` |

## Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CMF_CREATED_BY` | Operator identifier for audit trail | `system` |
| `CMF_TIMEOUT_MS` | Request timeout in milliseconds | `60000` |

## Environments

### QA (Testing)

```env
CMF_URL=https://qa-idilw8q1smn68l4eux.cmf.com.pa/mdl03/api
CMF_EMAIL=your-qa-merchant@email.com
CMF_PASSWORD=your-qa-password
CMF_BRANCH_OFFICE_CODE=MKP
CMF_COMPANY_CODE=MKP
CMF_CREATED_BY=system
```

### Production

Production credentials are provided by Banco General / CM Financiera upon merchant activation. The production URL differs from the QA URL.

```env
CMF_URL=https://production-url-from-cmf.cmf.com.pa/mdl03/api
CMF_EMAIL=your-prod-merchant@email.com
CMF_PASSWORD=your-prod-password
CMF_BRANCH_OFFICE_CODE=MKP
CMF_COMPANY_CODE=MKP
CMF_CREATED_BY=system
```

## Security Notes

1. **Never commit credentials** to version control. Use `.env.local` or secrets management.
2. **Rotate passwords regularly** -- CMF merchant passwords should be rotated every 90 days.
3. **Restrict access** -- only your backend server should have access to these credentials.
4. **Use environment-specific credentials** -- separate QA and production credentials.
