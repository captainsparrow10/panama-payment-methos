/**
 * @module @devhubpty/cybersource/server
 *
 * Server-side CyberSource SDK for Node.js / Express / Next.js API routes.
 *
 * Provides the `CyberSourceClient` class with methods for:
 * - Customer vault management (create, delete)
 * - Card tokenization (instrument identifiers + payment instruments)
 * - 3DS authentication (setup, enrollment, validation)
 * - Payment processing (authorize + capture, refund, void)
 *
 * @example
 * ```ts
 * import {
 *   CyberSourceClient,
 *   CyberSourceEnvironment,
 *   InMemoryThreeDSAuthCache,
 * } from '@devhubpty/cybersource/server';
 *
 * const client = new CyberSourceClient({
 *   merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
 *   keyId: process.env.CYBERSOURCE_KEY!,
 *   sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
 *   environment: CyberSourceEnvironment.Test,
 * });
 * ```
 */

export { CyberSourceClient } from './CyberSourceClient.js';
export type { CyberSourceClientOptions } from './CyberSourceClient.js';
export { InMemoryThreeDSAuthCache } from './auth-cache.js';
export { promisifySdkCall } from './promisify.js';
export type { SdkCallback, SdkResult } from './promisify.js';
export { CyberSourceError } from '../errors.js';

// Re-export all types and enums
export {
  CyberSourceEnvironment,
  ThreeDSStatus,
  PaymentStatus,
  EnrollmentResult,
  CardType,
  ThreeDSStep,
} from '../types.js';

export type {
  CyberSourceClientConfig,
  SetupAuthRequest,
  SetupAuthResponse,
  CheckEnrollmentRequest,
  EnrollmentResponse,
  BillingAddress,
  DeviceInfo,
  ConsumerAuthenticationInformation,
  Auth3DSResult,
  ProcessPaymentRequest,
  PaymentResponse,
  RefundRequest,
  VoidRequest,
  CreateCustomerRequest,
  CustomerResponse,
  CreateInstrumentIdentifierRequest,
  InstrumentIdentifierResponse,
  CreatePaymentInstrumentRequest,
  PaymentInstrumentResponse,
  ValidateAuthRequest,
  ValidateAuthResponse,
  ErrorInformation,
  ThreeDSAuthData,
  ThreeDSAuthCache,
  CyberSourceSDKResponse,
  CardInput,
} from '../types.js';
