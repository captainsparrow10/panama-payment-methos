# API Reference

Complete API reference for the `@devhubpty/cmf` package.

## Server (`@devhubpty/cmf/server`)

### CMFClient

The main class for interacting with the CMF API.

#### Constructor

```ts
new CMFClient(config: CMFClientConfig, options?: {
  logger?: PaymentLogger;
  retry?: Partial<RetryConfig>;
})
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `login()` | `Promise<CMFLoginResponse>` | Authenticates with CMF API, stores JWT |
| `ensureAuthenticated()` | `Promise<void>` | Calls `login()` if no token exists |
| `ping()` | `Promise<HealthCheckResult>` | Health check via login test |
| `getCustomerByDocument(docType, docNumber)` | `Promise<CMFCustomerResponse>` | Look up customer by document |
| `getCustomerByEmail(email)` | `Promise<CMFCustomerResponse>` | Look up customer by email |
| `getCustomerByPhone(phone)` | `Promise<CMFCustomerResponse>` | Look up customer by phone |
| `getCustomerProducts(customerId)` | `Promise<CMFProduct[]>` | Get customer's credit products |
| `getQuotas(customerProductId, amount)` | `Promise<CMFQuota[]>` | Simulate financing plans |
| `processPurchaseInQuotas(params, options?)` | `Promise<CMFApiResponse>` | Process installment purchase |
| `processNormalPurchase(params, options?)` | `Promise<CMFApiResponse>` | Process full card charge |
| `verifyTransaction(receiptNumber)` | `Promise<CMFApiResponse>` | Verify transaction was recorded |
| `sendOtpByEmail(email)` | `Promise<void>` | Send OTP via email |
| `verifyOtpByEmail(email, code)` | `Promise<boolean>` | Verify email OTP |
| `sendOtpByPhone(phone)` | `Promise<void>` | Send OTP via WhatsApp |
| `verifyOtpByPhone(phone, code)` | `Promise<boolean>` | Verify phone OTP |

### CMFError

Error thrown when CMF API returns `complete === false`.

```ts
class CMFError extends PaymentError {
  readonly statusResult: CMFStatusResult | null;
  static fromResponse(data): CMFError;
}
```

### Enums

| Enum | Values | Description |
|------|--------|-------------|
| `CMFDocumentType` | `Cedula`, `Licencia`, `Pasaporte`, `RUC` | Document type UUIDs |
| `CMFOtpChannel` | `Email`, `Phone` | OTP delivery channels |
| `CMFErrorCode` | `GeneralValidation` (1000), `VtcProcessError` (2006) | Known error codes |

## React (`@devhubpty/cmf/react`)

### Hooks

#### useCMFCustomer(config?)

Search for CMF customers by document.

```ts
const { search, customer, products, isLoading, error, reset } = useCMFCustomer({
  endpoint?: string; // default: '/api/cmf/customer'
});
```

#### useCMFQuotas(config?)

Fetch financing plans.

```ts
const { getQuotas, quotas, isLoading, error, reset } = useCMFQuotas({
  endpoint?: string; // default: '/api/cmf/quotas'
});
```

#### useCMFOtp(config?)

Manage OTP verification flow.

```ts
const { sendOtp, verifyOtp, channel, destination, step, isLoading, error, reset } = useCMFOtp({
  sendEndpoint?: string;   // default: '/api/cmf/otp/send'
  verifyEndpoint?: string; // default: '/api/cmf/otp/verify'
});
```

#### useCMFPayment(config?)

Process payments.

```ts
const { pay, isLoading, result, error, reset } = useCMFPayment({
  endpoint?: string; // default: '/api/cmf/pay'
});
```

### Components

#### CMFPaymentForm

Headless component implementing the complete payment flow.

```tsx
<CMFPaymentForm
  total={number}
  userName={string}
  description={string}
  onSuccess={(receiptNumber: string) => void}
  onError?: {(error: string) => void}
  className?: {string}
  apiBase?: {string} // default: '/api/cmf'
/>
```

## Types

### CMFClientConfig

```ts
interface CMFClientConfig {
  baseUrl: string;
  email: string;
  password: string;
  branchOfficeCode: string;
  companyCode: string;
  createdBy: string;
  timeoutMs?: number; // default: 60000
}
```

### CMFCustomerResponse

Full customer record with `id`, `fullName`, `email`, `phone`, and 20+ other fields. The `id` is the UUID needed for `getCustomerProducts()`.

### CMFProduct

Credit product with `customerProductId`, `productAccount` (encrypted), `productName`, and `customerAccountCards[]`.

### CMFAccountCard

Card linked to a product: `card` (encrypted for payments), `maskedCard` (for display), `account`, `isAditionalCard`.

### CMFQuota

Financing plan: `uniqueCode` (for payment), `loanTerm`, `monthlyQuota`, `effectiveInterestPct`, `totalCreditAmount`.

### CMFQuotaPurchaseRequest

Parameters for installment purchase: `AccountNumber`, `UniqueCode`, `Mto`, `BranchOfficeCode`, `CreatedBy`, `CompanyCode`, `ReceiptNumber`, `Description`, `UserName`.

### CMFNormalPurchaseRequest

Parameters for normal purchase: `CardNumber`, `MtoTran`, `MovementType: 2`, `PaymentCashAmount: 0`, `WithdrawalFee: 0`.

### CMFApiResponse<T>

Generic API wrapper: `complete`, `status`, `jsonAnswer: T`, `status_result`, `uniqueCode`, `problemPublic`.

### CMFPaymentOptions

Options for payment methods: `idempotencyKey?: string`.
