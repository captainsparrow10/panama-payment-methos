# API Reference

Complete API documentation for `@panama-payments/cybersource`.

## Server API (`@panama-payments/cybersource/server`)

### `CyberSourceClient`

Main client class for server-side CyberSource integration.

#### Constructor

```ts
new CyberSourceClient(options: CyberSourceClientOptions)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | `string` | Yes | CyberSource merchant ID |
| `keyId` | `string` | Yes | API key ID for http_signature |
| `sharedSecretKey` | `string` | Yes | Shared secret (base64) |
| `environment` | `CyberSourceEnvironment` | Yes | API environment |
| `profileId` | `string` | No | TMS profile ID |
| `logger` | `PaymentLogger` | No | Logger instance (default: silent) |
| `retry` | `Partial<RetryConfig>` | No | Retry configuration |
| `authCache` | `ThreeDSAuthCache` | No | 3DS auth cache (default: in-memory) |

---

#### `ping(): Promise<HealthCheckResult>`

Health check against the CyberSource API.

```ts
const health = await client.ping();
// { ok: true, latencyMs: 142, provider: 'cybersource', timestamp: '...' }
```

---

#### `createCustomer(data, opts?): Promise<CustomerResponse>`

Create a customer in CyberSource TMS.

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.customerId` | `string` | Your internal customer ID |
| `data.email` | `string` | Customer email |
| `data.phone` | `string?` | Customer phone |
| `opts.idempotencyKey` | `string?` | Idempotency key |

---

#### `deleteCustomer(id): Promise<void>`

Delete a customer and all associated payment instruments.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | CyberSource customer ID |

---

#### `createInstrumentIdentifier(data): Promise<InstrumentIdentifierResponse>`

Tokenize a card number (step 1 of tokenization).

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.cardNumber` | `string` | Full card number (PAN) |
| `data.securityCode` | `string` | CVV/CVC |

Returns: `{ id, state, card: { number, type? }, securityCodeStatus? }`

---

#### `createPaymentInstrument(data, opts?): Promise<PaymentInstrumentResponse>`

Create a payment instrument (step 2 of tokenization).

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.cybersourceCustomerId` | `string` | CyberSource customer ID |
| `data.instrumentIdentifierTokenId` | `string` | From step 1 |
| `data.expirationMonth` | `string` | MM |
| `data.expirationYear` | `string` | YYYY |
| `data.type` | `string` | Card type code (e.g., '001') |
| `data.billTo` | `BillingAddress` | Billing address |

---

#### `getPaymentInstrument(id): Promise<PaymentInstrumentResponse>`

Retrieve a payment instrument by token ID.

---

#### `setupAuthentication(data): Promise<SetupAuthResponse>`

Initialize 3DS authentication (step 1 of 3DS).

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.cybersourceCustomerId` | `string` | CyberSource customer ID |
| `data.paymentInstrumentId` | `string` | Payment instrument to authenticate |
| `data.sessionId` | `string?` | Device fingerprint session |

Returns: `{ clientReferenceInformation, consumerAuthenticationInformation: { accessToken, deviceDataCollectionUrl, referenceId, token } }`

---

#### `checkEnrollment(data): Promise<EnrollmentResponse>`

Check 3DS enrollment (step 2 of 3DS).

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.referenceId` | `string` | From setup response |
| `data.cybersourceCustomerId` | `string` | CyberSource customer ID |
| `data.amount` | `string` | Transaction amount |
| `data.currency` | `string` | Currency code |
| `data.billingAddress` | `BillingAddress` | Billing address |
| `data.returnUrl` | `string` | Challenge return URL |
| `data.sessionId` | `string?` | Device fingerprint session |
| `data.deviceInfo` | `DeviceInfo?` | Browser/device info |

Returns: `EnrollmentResponse` with `status` = `AUTHENTICATION_SUCCESSFUL` | `PENDING_AUTHENTICATION` | `FAILED`

**Side effect**: Caches auth data on frictionless success.

---

#### `validateAuthentication(data): Promise<ValidateAuthResponse>`

Validate 3DS authentication (step 3, after challenge).

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.authenticationTransactionId` | `string` | From challenge |

**Side effect**: Caches auth data on success.

---

#### `processPayment(data, opts?): Promise<PaymentResponse>`

Process a payment (authorize + capture).

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.totalAmount` | `string` | Amount |
| `data.currency` | `string` | Currency |
| `data.cybersourceCustomerId` | `string` | CyberSource customer ID |
| `data.customerId` | `string` | Your internal customer ID |
| `data.sessionId` | `string` | Device fingerprint session |
| `data.auth3DSResult` | `Auth3DSResult` | 3DS authentication data |
| `data.source` | `string` | `'app'` or `'web'` |
| `data.businessId` | `string` | Business/org ID |
| `data.cardType` | `string` | Card type code |
| `data.billTo` | `object` | Billing address |
| `data.capture` | `boolean?` | Capture immediately (default: true) |

**Side effect**: Reads from auth cache if frontend fields are missing.

---

#### `refundPayment(data, opts?): Promise<PaymentResponse>`

Refund a previously captured payment.

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.paymentId` | `string` | Original payment ID |
| `data.amount` | `string` | Refund amount |
| `data.currency` | `string` | Currency |
| `data.codeReference` | `string` | Internal reference |

---

#### `voidPayment(data, opts?): Promise<{ status: string }>`

Void a previously authorized payment (before settlement).

| Parameter | Type | Description |
|-----------|------|-------------|
| `data.paymentId` | `string` | Payment ID to void |
| `data.codeReference` | `string` | Internal reference |

---

### `InMemoryThreeDSAuthCache`

In-memory cache with automatic TTL cleanup.

```ts
const cache = new InMemoryThreeDSAuthCache(5 * 60 * 1000); // 5 min TTL
cache.get(key);
cache.set(key, data);
cache.delete(key);
cache.destroy(); // Stop cleanup interval
```

---

## React API (`@panama-payments/cybersource/react`)

### `useThreeDS(options)`

State machine orchestrator for the complete 3DS flow.

**Options**: `onSetup`, `onCheckEnrollment`, `onValidate` callback functions.

**Returns**: `{ step, startAuth, completeChallenge, challengeRequired, challengeUrl, challengeJwt, isLoading, error, setupData, enrollmentData, validationData, reset }`

### `useSetupService(options)`

Hook for 3DS setup step.

**Returns**: `{ setup, data, isLoading, error, reset }`

### `useCheckEnrollment(options)`

Hook for 3DS enrollment check.

**Returns**: `{ checkEnrollment, data, isFrictionless, challengeUrl, isLoading, error, reset }`

### `useValidateAuth(options)`

Hook for 3DS validation step.

**Returns**: `{ validate, data, isLoading, error, reset }`

### `usePayment(options)`

Hook for payment processing.

**Returns**: `{ pay, result, isLoading, error, reset }`

### `usePaymentMethods(options)`

Hook for card management.

**Returns**: `{ addCard, deleteCard, result, isLoading, error, reset }`

### `ThreeDSModal`

Unstyled challenge dialog component.

| Prop | Type | Description |
|------|------|-------------|
| `challengeUrl` | `string` | Step-up URL |
| `challengeJwt` | `string` | JWT / access token |
| `onComplete` | `(result) => void` | Called on challenge completion |
| `onCancel` | `() => void` | Called on cancel |
| `className` | `string?` | CSS class |
| `iframeWidth` | `number?` | Default: 400 |
| `iframeHeight` | `number?` | Default: 600 |

---

## Enums

### `CyberSourceEnvironment`

| Value | Description |
|-------|-------------|
| `Test` | `apitest.cybersource.com` |
| `Production` | `api.cybersource.com` |

### `ThreeDSStep`

`Idle` | `Setup` | `Fingerprint` | `Enroll` | `Challenge` | `Validate` | `Ready` | `Done` | `Error`

### `ThreeDSStatus`

`AuthenticationSuccessful` | `PendingAuthentication` | `Authenticated` | `Validated` | `Failed`

### `PaymentStatus`

`Authorized` | `Declined` | `Pending` | `Voided` | `Refunded`

### `EnrollmentResult`

`Enrolled` (Y) | `NotEnrolled` (N) | `Unavailable` (U) | `Attempted` (A) | `ChallengeRequired` (C) | `Rejected` (R) | `Decoupled` (D)

### `CardType`

`Visa` (001) | `Mastercard` (002) | `Amex` (003) | `Discover` (004)
