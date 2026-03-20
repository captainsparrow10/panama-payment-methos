/**
 * @module types
 *
 * All enums and interfaces for the CyberSource payment SDK.
 *
 * These types model the CyberSource REST API for 3D Secure authentication,
 * card tokenization (TMS), payment processing, refunds, voids, and customer
 * vault management.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * CyberSource API environment.
 *
 * @example
 * ```ts
 * import { CyberSourceEnvironment } from '@panama-payments/cybersource/server';
 *
 * const env = CyberSourceEnvironment.Test; // 'apitest.cybersource.com'
 * ```
 */
export enum CyberSourceEnvironment {
  /** Sandbox / test environment */
  Test = 'apitest.cybersource.com',
  /** Production environment */
  Production = 'api.cybersource.com',
}

/**
 * Status returned by 3D Secure authentication steps.
 *
 * @example
 * ```ts
 * if (response.status === ThreeDSStatus.AuthenticationSuccessful) {
 *   // Frictionless flow completed
 * }
 * ```
 */
export enum ThreeDSStatus {
  /** Authentication completed successfully (frictionless) */
  AuthenticationSuccessful = 'AUTHENTICATION_SUCCESSFUL',
  /** Authentication is pending (challenge required) */
  PendingAuthentication = 'PENDING_AUTHENTICATION',
  /** Card has been authenticated */
  Authenticated = 'AUTHENTICATED',
  /** Authentication result has been validated */
  Validated = 'VALIDATED',
  /** Authentication failed */
  Failed = 'FAILED',
}

/**
 * Status of a payment transaction.
 *
 * @example
 * ```ts
 * if (result.status === PaymentStatus.Authorized) {
 *   // Payment was approved
 * }
 * ```
 */
export enum PaymentStatus {
  /** Payment authorized (and optionally captured) */
  Authorized = 'AUTHORIZED',
  /** Payment was declined by the processor */
  Declined = 'DECLINED',
  /** Payment is pending additional action */
  Pending = 'PENDING',
  /** Payment has been voided */
  Voided = 'VOIDED',
  /** Payment has been refunded */
  Refunded = 'REFUNDED',
}

/**
 * 3DS enrollment check result codes (veresEnrolled / transactionStatus).
 *
 * @example
 * ```ts
 * if (enrollment === EnrollmentResult.ChallengeRequired) {
 *   // Show the 3DS challenge iframe to the user
 * }
 * ```
 */
export enum EnrollmentResult {
  /** Card is enrolled in 3DS */
  Enrolled = 'Y',
  /** Card is not enrolled */
  NotEnrolled = 'N',
  /** Enrollment status unavailable */
  Unavailable = 'U',
  /** Authentication was attempted */
  Attempted = 'A',
  /** Challenge is required */
  ChallengeRequired = 'C',
  /** Authentication was rejected */
  Rejected = 'R',
  /** Decoupled authentication */
  Decoupled = 'D',
}

/**
 * CyberSource card type codes.
 *
 * @example
 * ```ts
 * const cardType = CardType.Visa; // '001'
 * ```
 */
export enum CardType {
  /** Visa */
  Visa = '001',
  /** Mastercard */
  Mastercard = '002',
  /** American Express */
  Amex = '003',
  /** Discover */
  Discover = '004',
}

/**
 * Steps in the 3DS authentication state machine used by `useThreeDS`.
 *
 * @example
 * ```ts
 * if (step === ThreeDSStep.Challenge) {
 *   // User must complete the 3DS challenge
 * }
 * ```
 */
export enum ThreeDSStep {
  /** No authentication in progress */
  Idle = 'idle',
  /** Setting up payer authentication */
  Setup = 'setup',
  /** Device fingerprinting (data collection) */
  Fingerprint = 'fingerprint',
  /** Checking enrollment */
  Enroll = 'enroll',
  /** 3DS challenge iframe is displayed */
  Challenge = 'challenge',
  /** Validating authentication result */
  Validate = 'validate',
  /** Authentication complete, ready to process payment */
  Ready = 'ready',
  /** Payment processed */
  Done = 'done',
  /** An error occurred */
  Error = 'error',
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the CyberSource client.
 *
 * @example
 * ```ts
 * const config: CyberSourceClientConfig = {
 *   merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
 *   keyId: process.env.CYBERSOURCE_KEY!,
 *   sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
 *   environment: CyberSourceEnvironment.Test,
 * };
 * ```
 */
export interface CyberSourceClientConfig {
  /** CyberSource merchant ID */
  merchantId: string;
  /** API key ID for http_signature authentication */
  keyId: string;
  /** Shared secret key (base64 encoded) */
  sharedSecretKey: string;
  /** API environment (test or production) */
  environment: CyberSourceEnvironment;
  /** Optional TMS profile ID for tokenization */
  profileId?: string;
}

// ---------------------------------------------------------------------------
// 3DS Authentication
// ---------------------------------------------------------------------------

/**
 * Request body for setting up 3DS authentication (Step 1 of 3DS flow).
 *
 * @example
 * ```ts
 * const request: SetupAuthRequest = {
 *   cybersourceCustomerId: 'ABC123',
 *   paymentInstrumentId: 'PI_xyz',
 *   sessionId: 'device-fingerprint-session',
 * };
 * ```
 */
export interface SetupAuthRequest {
  /** CyberSource customer ID (TMS) */
  cybersourceCustomerId: string;
  /** Payment instrument ID to authenticate */
  paymentInstrumentId: string;
  /** Device fingerprint session ID (optional) */
  sessionId?: string;
}

/**
 * Response from the 3DS setup authentication step.
 *
 * @example
 * ```ts
 * const { accessToken, deviceDataCollectionUrl, referenceId } = response.consumerAuthenticationInformation;
 * ```
 */
export interface SetupAuthResponse {
  /** Client reference information */
  clientReferenceInformation: {
    code: string;
  };
  /** Authentication data needed for the next steps */
  consumerAuthenticationInformation: {
    /** JWT access token for device data collection */
    accessToken: string;
    /** URL for device data collection iframe */
    deviceDataCollectionUrl: string;
    /** Reference ID for enrollment check */
    referenceId: string;
    /** Token for the authentication flow */
    token: string;
  };
}

/**
 * Billing address for 3DS enrollment and payment processing.
 *
 * @example
 * ```ts
 * const address: BillingAddress = {
 *   firstName: 'Juan',
 *   lastName: 'Perez',
 *   address1: 'Calle 50, Edificio Global',
 *   locality: 'Panama City',
 *   country: 'PA',
 *   email: 'juan@example.com',
 * };
 * ```
 */
export interface BillingAddress {
  /** First name of the cardholder */
  firstName: string;
  /** Last name of the cardholder */
  lastName: string;
  /** Street address */
  address1: string;
  /** City / locality */
  locality?: string;
  /** Administrative area / state / province */
  administrativeArea?: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
  /** Cardholder email address */
  email: string;
  /** Postal code */
  postalCode?: string;
  /** Phone number */
  phoneNumber?: string;
  /** Secondary address line */
  address2?: string;
}

/**
 * Device and browser information for 3DS enrollment check.
 *
 * @example
 * ```ts
 * const device: DeviceInfo = {
 *   fingerprintSessionId: 'session-uuid',
 *   ipAddress: '203.0.113.42',
 *   httpBrowserJavaScriptEnabled: true,
 *   userAgentBrowserValue: navigator.userAgent,
 * };
 * ```
 */
export interface DeviceInfo {
  /** Device fingerprint session ID */
  fingerprintSessionId?: string;
  /** Client IP address */
  ipAddress?: string;
  /** HTTP Accept header value */
  httpAcceptBrowserValue?: string;
  /** Browser language */
  httpBrowserLanguage?: string;
  /** Whether Java is enabled in the browser */
  httpBrowserJavaEnabled?: boolean;
  /** Whether JavaScript is enabled in the browser */
  httpBrowserJavaScriptEnabled?: boolean;
  /** Browser color depth */
  httpBrowserColorDepth?: string;
  /** Browser screen height */
  httpBrowserScreenHeight?: string;
  /** Browser screen width */
  httpBrowserScreenWidth?: string;
  /** Browser timezone difference */
  httpBrowserTimeDifference?: string;
  /** Browser user-agent string */
  userAgentBrowserValue?: string;
  /** HTTP Accept-Content header value */
  httpAcceptContent?: string;
}

/**
 * Request body for checking 3DS enrollment (Step 2 of 3DS flow).
 *
 * @example
 * ```ts
 * const request: CheckEnrollmentRequest = {
 *   referenceId: 'ref-from-setup',
 *   cybersourceCustomerId: 'ABC123',
 *   amount: '25.99',
 *   currency: 'USD',
 *   billingAddress: { firstName: 'Juan', lastName: 'Perez', ... },
 *   returnUrl: 'https://example.com/3ds-callback',
 * };
 * ```
 */
export interface CheckEnrollmentRequest {
  /** Reference ID from setup authentication response */
  referenceId: string;
  /** CyberSource customer ID */
  cybersourceCustomerId: string;
  /** Transaction amount as string */
  amount: string;
  /** Currency code (e.g., 'USD') */
  currency: string;
  /** Billing address for AVS */
  billingAddress: BillingAddress;
  /** URL where CyberSource will redirect after challenge */
  returnUrl: string;
  /** Device fingerprint session ID */
  sessionId?: string;
  /** Device and browser information */
  deviceInfo?: DeviceInfo;
}

/**
 * Consumer authentication information returned from CyberSource.
 *
 * @example
 * ```ts
 * const { cavv, xid, eciRaw, authenticationTransactionId } = response.consumerAuthenticationInformation;
 * ```
 */
export interface ConsumerAuthenticationInformation {
  /** JWT access token for 3DS2 */
  accessToken?: string;
  /** Cardholder Authentication Verification Value */
  cavv?: string;
  /** Directory Server Transaction ID */
  directoryServerTransactionId?: string;
  /** Electronic Commerce Indicator */
  ecommerceIndicator?: string;
  /** ECI value */
  eci?: string;
  /** Raw ECI value from the issuer */
  eciRaw?: string;
  /** 3DS enrollment result */
  enrollment?: string;
  /** Authentication transaction status (Y, N, A, C, R, U, D) */
  transactionStatus?: string;
  /** Transaction ID for 3DS authentication */
  xid?: string;
  /** Final authentication result */
  authenticationResult?: string;
  /** 3DS specification version (e.g., '2.1.0') */
  specificationVersion?: string;
  /** ACS URL for challenge redirect */
  acsUrl?: string;
  /** PaReq parameter (3DS1) */
  pareq?: string;
  /** 3DS2 challenge payload for POST to ACS */
  payload?: string;
  /** Authentication transaction ID */
  authenticationTransactionId?: string;
  /** Token for the authentication flow */
  token?: string;
  /** Whether challenge is required */
  challengeRequired?: string;
  /** Step-up URL for challenge iframe */
  stepUpUrl?: string;
  /** PARes status */
  paresStatus?: string;
  /** Signed PARes status reason */
  signedParesStatusReason?: string;
  /** Message to display to the cardholder */
  cardholderMessage?: string;
  /** ACS reference number */
  acsReferenceNumber?: string;
  /** 3DS Server Transaction ID */
  threeDSServerTransactionId?: string;
  /** ACS Operator ID */
  acsOperatorID?: string;
  /** ACS Transaction ID */
  acsTransactionId?: string;
  /** veres enrolled flag */
  veresEnrolled?: string;
  /** Strong authentication data */
  strongAuthentication?: Record<string, unknown>;
  /** UCAF collection indicator (for Mastercard) */
  ucafCollectionIndicator?: string;
  /** UCAF authentication data (for Mastercard) */
  ucafAuthenticationData?: string;
}

/**
 * Response from the 3DS enrollment check.
 *
 * @example
 * ```ts
 * if (response.status === ThreeDSStatus.AuthenticationSuccessful) {
 *   // Frictionless - proceed to payment
 * } else if (response.status === ThreeDSStatus.PendingAuthentication) {
 *   // Show challenge iframe
 * }
 * ```
 */
export interface EnrollmentResponse {
  /** Enrollment check transaction ID */
  id: string;
  /** Overall status of the enrollment check */
  status: string;
  /** Timestamp of the response */
  submitTimeUtc: string;
  /** Client reference information */
  clientReferenceInformation: {
    code: string;
  };
  /** Consumer authentication information */
  consumerAuthenticationInformation?: ConsumerAuthenticationInformation;
  /** Error information if the check failed */
  errorInformation?: ErrorInformation;
  /** Payment information */
  paymentInformation?: {
    card?: {
      type?: string;
    };
  };
}

/**
 * 3DS authentication result data used for payment processing.
 *
 * @example
 * ```ts
 * const auth: Auth3DSResult = {
 *   cavv: 'AAACBllleHchZTBWIGV4MAAAAAAA',
 *   xid: 'CAACCVVUlwCXUyhQNlSXAAAAAAA=',
 *   eciRaw: '05',
 *   authenticationTransactionId: 'txn-123',
 * };
 * ```
 */
export interface Auth3DSResult {
  /** Cardholder Authentication Verification Value */
  cavv: string;
  /** Transaction ID from 3DS authentication */
  xid: string;
  /** Authentication token */
  token?: string;
  /** Authentication transaction ID */
  authenticationTransactionId: string;
  /** ECI value */
  eci?: string;
  /** Raw ECI value from the issuer */
  eciRaw: string;
  /** Directory Server Transaction ID */
  directoryServerTransactionId?: string;
  /** 3DS specification version */
  specificationVersion?: string;
  /** UCAF collection indicator (Mastercard) */
  ucafCollectionIndicator?: string;
  /** UCAF authentication data (Mastercard) */
  ucafAuthenticationData?: string;
}

/**
 * Request body for validating 3DS authentication (Step 3 of challenge flow).
 *
 * @example
 * ```ts
 * const request: ValidateAuthRequest = {
 *   authenticationTransactionId: 'txn-123',
 * };
 * ```
 */
export interface ValidateAuthRequest {
  /** Authentication transaction ID to validate */
  authenticationTransactionId: string;
}

/**
 * Response from 3DS authentication validation.
 *
 * @example
 * ```ts
 * if (response.status === ThreeDSStatus.Validated) {
 *   const { cavv, eciRaw } = response.consumerAuthenticationInformation;
 * }
 * ```
 */
export interface ValidateAuthResponse {
  /** Validation transaction ID */
  id: string;
  /** Validation status */
  status: string;
  /** Timestamp of the response */
  submitTimeUtc: string;
  /** Consumer authentication information after validation */
  consumerAuthenticationInformation?: ConsumerAuthenticationInformation;
  /** Error information if validation failed */
  errorInformation?: ErrorInformation;
}

// ---------------------------------------------------------------------------
// Payment Processing
// ---------------------------------------------------------------------------

/**
 * Request body for processing a payment (authorize + capture).
 *
 * @example
 * ```ts
 * const request: ProcessPaymentRequest = {
 *   totalAmount: '25.99',
 *   currency: 'USD',
 *   cybersourceCustomerId: 'ABC123',
 *   auth3DSResult: { cavv: '...', xid: '...', eciRaw: '05', authenticationTransactionId: '...' },
 *   billTo: { firstName: 'Juan', lastName: 'Perez', address1: '...', country: 'PA', email: '...' },
 *   sessionId: 'fingerprint-session',
 * };
 * ```
 */
export interface ProcessPaymentRequest {
  /** Transaction amount as string */
  totalAmount: string;
  /** Currency code (e.g., 'USD') */
  currency: string;
  /** Payment instrument ID (optional if using default) */
  paymentInstrumentId?: string;
  /** Device fingerprint session ID */
  sessionId: string;
  /** CyberSource customer ID */
  cybersourceCustomerId: string;
  /** Internal customer ID */
  customerId: string;
  /** 3DS authentication result */
  auth3DSResult: Auth3DSResult;
  /** Transaction source ('app' or 'web') */
  source: string;
  /** Business/organization identifier */
  businessId: string;
  /** Card type code */
  cardType: string;
  /** Billing address */
  billTo: {
    /** City / locality */
    locality?: string;
    /** Last name */
    lastName: string;
    /** First name */
    firstName: string;
    /** Street address */
    address1: string;
    /** Country code */
    country: string;
    /** Email address */
    email: string;
  };
  /** Whether to capture immediately (default: true) */
  capture?: boolean;
  /** Merchant defined information fields */
  merchantDefinedInformation?: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * Response from a payment transaction (authorization, capture, refund).
 *
 * @example
 * ```ts
 * if (response.status === PaymentStatus.Authorized) {
 *   console.log('Payment approved:', response.id);
 * }
 * ```
 */
export interface PaymentResponse {
  /** Transaction ID */
  id: string;
  /** Timestamp in UTC */
  submitTimeUtc: string;
  /** Transaction status */
  status: string;
  /** Reconciliation ID */
  reconciliationId?: string;
  /** Client reference information */
  clientReferenceInformation: {
    code: string;
  };
  /** Error information if the transaction failed */
  errorInformation?: ErrorInformation;
  /** Processor-specific information */
  processorInformation?: {
    /** Approval code from the processor */
    approvalCode?: string;
    /** Processor transaction ID */
    transactionId?: string;
    /** Network transaction ID (Visa/Mastercard) */
    networkTransactionId?: string;
    /** Processor response code */
    responseCode?: string;
    /** Processor reason code */
    reasonCode?: string;
  };
  /** Payment account information */
  paymentAccountInformation?: {
    card?: {
      type?: string;
    };
  };
  /** Order information */
  orderInformation?: {
    amountDetails: {
      totalAmount: string;
      authorizedAmount?: string;
      currency: string;
    };
  };
  /** Consumer authentication information */
  consumerAuthenticationInformation?: ConsumerAuthenticationInformation;
  /** HATEOAS links (e.g., ACS redirect URL for 3DS challenge) */
  links?: Array<{
    href: string;
    method: string;
    rel: string;
  }>;
}

/**
 * Request body for refunding a payment.
 *
 * @example
 * ```ts
 * const request: RefundRequest = {
 *   paymentId: 'txn-original-123',
 *   amount: '25.99',
 *   currency: 'USD',
 *   codeReference: 'ORDER-456',
 * };
 * ```
 */
export interface RefundRequest {
  /** Original payment transaction ID to refund */
  paymentId: string;
  /** Refund amount */
  amount: string;
  /** Currency code */
  currency: string;
  /** Internal reference code */
  codeReference: string;
}

/**
 * Request body for voiding a payment.
 *
 * @example
 * ```ts
 * const request: VoidRequest = {
 *   paymentId: 'txn-to-void-123',
 *   codeReference: 'ORDER-456',
 * };
 * ```
 */
export interface VoidRequest {
  /** Payment transaction ID to void */
  paymentId: string;
  /** Internal reference code */
  codeReference: string;
}

// ---------------------------------------------------------------------------
// Customer & Vault (TMS)
// ---------------------------------------------------------------------------

/**
 * Request body for creating a CyberSource customer.
 *
 * @example
 * ```ts
 * const request: CreateCustomerRequest = {
 *   customerId: 'internal-123',
 *   email: 'juan@example.com',
 *   phone: '+5076000000',
 * };
 * ```
 */
export interface CreateCustomerRequest {
  /** Internal customer identifier */
  customerId: string;
  /** Customer email address */
  email: string;
  /** Customer phone number */
  phone?: string;
  /** Customer gender */
  gender?: string;
  /** Merchant defined information */
  merchantDefinedInformation?: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Response from creating or retrieving a CyberSource customer.
 *
 * @example
 * ```ts
 * const cybersourceId = response.id; // Store this for future requests
 * ```
 */
export interface CustomerResponse {
  /** CyberSource customer ID */
  id: string;
  /** Buyer information */
  buyerInformation: {
    merchantCustomerID: string;
    email: string;
  };
  /** Default payment instrument (if set) */
  defaultPaymentInstrument?: {
    id: string;
  };
  /** Embedded resources */
  _embedded?: {
    defaultPaymentInstrument?: {
      id: string;
      default: boolean;
      state: string;
      card: {
        expirationMonth: string;
        expirationYear: string;
        type: string;
      };
    };
  };
}

/**
 * Request body for creating an instrument identifier (card token).
 * This is step 1 of the 2-step card tokenization flow.
 *
 * @example
 * ```ts
 * const request: CreateInstrumentIdentifierRequest = {
 *   cardNumber: '4111111111111111',
 *   securityCode: '123',
 * };
 * ```
 */
export interface CreateInstrumentIdentifierRequest {
  /** Full card number (PAN) */
  cardNumber: string;
  /** Card security code (CVV/CVC) */
  securityCode: string;
}

/**
 * Response from creating an instrument identifier.
 *
 * @example
 * ```ts
 * const tokenId = response.id; // Use this for createPaymentInstrument
 * ```
 */
export interface InstrumentIdentifierResponse {
  /** Token ID for the instrument identifier */
  id: string;
  /** Object type */
  object: string;
  /** Token state (e.g., 'ACTIVE') */
  state: string;
  /** Truncated card information */
  card: {
    /** Truncated card number (e.g., 'xxxxxxxxxxxx1234') */
    number: string;
    /** Card type code */
    type?: string;
  };
  /** Security code verification status */
  securityCodeStatus?: string;
}

/**
 * Request body for creating a payment instrument (step 2 of tokenization).
 *
 * @example
 * ```ts
 * const request: CreatePaymentInstrumentRequest = {
 *   cybersourceCustomerId: 'ABC123',
 *   instrumentIdentifierTokenId: 'II_xyz',
 *   expirationMonth: '12',
 *   expirationYear: '2028',
 *   type: '001',
 *   billTo: { firstName: 'Juan', lastName: 'Perez', ... },
 * };
 * ```
 */
export interface CreatePaymentInstrumentRequest {
  /** CyberSource customer ID to associate this instrument with */
  cybersourceCustomerId: string;
  /** Instrument identifier token ID from step 1 */
  instrumentIdentifierTokenId: string;
  /** Card expiration month (MM) */
  expirationMonth: string;
  /** Card expiration year (YYYY) */
  expirationYear: string;
  /** Card type code (e.g., '001' for Visa) */
  type: string;
  /** Billing address */
  billTo: BillingAddress;
}

/**
 * Response from creating or retrieving a payment instrument.
 *
 * @example
 * ```ts
 * const instrumentId = response.id; // Use this for payments and 3DS
 * const last4 = response._embedded.instrumentIdentifier.card.number;
 * ```
 */
export interface PaymentInstrumentResponse {
  /** Payment instrument token ID */
  id: string;
  /** Token state (e.g., 'ACTIVE') */
  state: string;
  /** Card information */
  card: {
    /** Expiration month */
    expirationMonth: string;
    /** Expiration year */
    expirationYear: string;
    /** Card type code */
    type: string;
  };
  /** Billing address on file */
  billTo: {
    firstName?: string;
    lastName?: string;
    email?: string;
    address1?: string;
    locality?: string;
    administrativeArea?: string;
    country?: string;
    postalCode?: string;
    phoneNumber?: string;
  };
  /** Embedded instrument identifier */
  _embedded: {
    instrumentIdentifier: {
      id: string;
      state: string;
      card: {
        /** Truncated card number */
        number: string;
        type?: string;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Error & Utility Types
// ---------------------------------------------------------------------------

/**
 * Error information returned by CyberSource API responses.
 *
 * @example
 * ```ts
 * if (response.errorInformation) {
 *   console.error(response.errorInformation.message);
 * }
 * ```
 */
export interface ErrorInformation {
  /** Error reason code */
  reason?: string;
  /** Human-readable error message */
  message?: string;
  /** Detailed error information */
  details?: Array<{
    field?: string;
    reason?: string;
    message?: string;
  }>;
}

/**
 * Cached 3DS authentication data for fallback during payment processing.
 * Stored after successful enrollment check or challenge validation.
 *
 * @example
 * ```ts
 * const cached: ThreeDSAuthData = {
 *   cavv: 'AAACBllleHchZTBWIGV4MAAAAAAA',
 *   xid: 'CAACCVVUlwCXUyhQNlSXAAAAAAA=',
 *   eci: '05',
 *   eciRaw: '05',
 *   authenticationTransactionId: 'txn-abc',
 *   directoryServerTransactionId: 'ds-txn-123',
 *   specificationVersion: '2.1.0',
 *   timestamp: Date.now(),
 * };
 * ```
 */
export interface ThreeDSAuthData {
  /** CAVV value */
  cavv: string;
  /** XID value */
  xid: string;
  /** ECI value */
  eci: string;
  /** Raw ECI value */
  eciRaw: string;
  /** Authentication transaction ID (used as cache key) */
  authenticationTransactionId: string;
  /** Directory Server transaction ID */
  directoryServerTransactionId: string;
  /** 3DS specification version */
  specificationVersion: string;
  /** Timestamp when this data was cached (for TTL) */
  timestamp: number;
}

/**
 * Interface for caching 3DS authentication data.
 * Implementations can use in-memory, Redis, or any other storage.
 *
 * @example
 * ```ts
 * class RedisThreeDSAuthCache implements ThreeDSAuthCache {
 *   async get(key: string) { return JSON.parse(await redis.get(key)); }
 *   async set(key: string, data: ThreeDSAuthData) { await redis.set(key, JSON.stringify(data), 'EX', 300); }
 *   async delete(key: string) { await redis.del(key); }
 * }
 * ```
 */
export interface ThreeDSAuthCache {
  /** Retrieve cached 3DS auth data by key (authenticationTransactionId) */
  get(key: string): ThreeDSAuthData | undefined;
  /** Store 3DS auth data */
  set(key: string, data: ThreeDSAuthData): void;
  /** Remove cached data */
  delete(key: string): void;
}

/**
 * Raw SDK response shape from `cybersource-rest-client` callbacks.
 *
 * @example
 * ```ts
 * // Used internally by promisify wrapper
 * const response: CyberSourceSDKResponse = { status: '200', text: 'OK' };
 * ```
 */
export interface CyberSourceSDKResponse {
  /** HTTP status code as string */
  status: string;
  /** Status message or error text */
  text?: string;
  /** Raw response body */
  body?: unknown;
}

/**
 * Card input data from the frontend for tokenization.
 *
 * @example
 * ```ts
 * const card: CardInput = {
 *   cardNumber: '4111111111111111',
 *   expirationMonth: '12',
 *   expirationYear: '2028',
 *   securityCode: '123',
 *   type: '001',
 *   name: 'Juan Perez',
 * };
 * ```
 */
export interface CardInput {
  /** Full card number (PAN) */
  cardNumber: string;
  /** Expiration month (MM) */
  expirationMonth: string;
  /** Expiration year (YYYY) */
  expirationYear: string;
  /** Security code (CVV/CVC) */
  securityCode: string;
  /** Card type code (e.g., '001' for Visa) */
  type?: string;
  /** Cardholder full name */
  name?: string;
  /** Display name for the card (e.g., 'Mi Tarjeta Principal') */
  cardName?: string;
  /** Visual theme ID for UI display */
  theme?: number;
  /** Cardholder city */
  city?: string;
  /** Cardholder street address */
  address1?: string;
  /** Client IP address (for device fingerprinting) */
  customerIpAddress?: string;
  /** Client user-agent (for device fingerprinting) */
  customerUserAgent?: string;
}
