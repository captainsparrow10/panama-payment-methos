/**
 * Main CyberSource client for server-side payment processing.
 *
 * Provides a unified API for the complete CyberSource payment lifecycle:
 * - Customer management (vault)
 * - Card tokenization (2-step: instrument identifier + payment instrument)
 * - 3DS authentication (3-step: setup + enroll + validate)
 * - Payment processing (authorize + capture in one call)
 * - Refunds and voids
 *
 * Built on top of `cybersource-rest-client` SDK and `@paciolan/cybersource-sdk`,
 * converting callback-based APIs to Promise-based with proper error handling,
 * logging, and retry support.
 *
 * @example
 * ```ts
 * import { CyberSourceClient, CyberSourceEnvironment } from '@devhubpty/cybersource/server';
 * import { createConsoleLogger } from '@devhubpty/core';
 *
 * const client = new CyberSourceClient({
 *   merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
 *   keyId: process.env.CYBERSOURCE_KEY!,
 *   sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
 *   environment: CyberSourceEnvironment.Test,
 *   logger: createConsoleLogger({ level: 'debug' }),
 * });
 *
 * // Health check
 * const health = await client.ping();
 * console.log(health.ok ? 'CyberSource is reachable' : 'Unreachable');
 *
 * // Create customer -> tokenize card -> 3DS -> pay
 * const customer = await client.createCustomer({ customerId: 'user-123', email: 'juan@example.com' });
 * const ii = await client.createInstrumentIdentifier({ cardNumber: '4111111111111111', securityCode: '123' });
 * const pi = await client.createPaymentInstrument({ ... });
 * const setup = await client.setupAuthentication({ ... });
 * const enrollment = await client.checkEnrollment({ ... });
 * // If frictionless: proceed to payment
 * // If challenge: validate after user completes challenge
 * const payment = await client.processPayment({ ... });
 * ```
 */

import crypto from 'crypto';
import cybersourceRestApi from 'cybersource-rest-client';
import {
  type PaymentLogger,
  type RetryConfig,
  type HealthCheckResult,
  noopLogger,
  sanitize,
  withRetry,
} from '@devhubpty/core';
import { CyberSourceError } from '../errors.js';
import { InMemoryThreeDSAuthCache } from './auth-cache.js';
import { promisifySdkCall } from './promisify.js';
import type {
  CyberSourceClientConfig,
  SetupAuthRequest,
  SetupAuthResponse,
  CheckEnrollmentRequest,
  EnrollmentResponse,
  ValidateAuthRequest,
  ValidateAuthResponse,
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
  ThreeDSAuthCache,
  ThreeDSAuthData,
  ThreeDSStatus,
} from '../types.js';

// ---------------------------------------------------------------------------
// Internal SDK configuration adapters
// ---------------------------------------------------------------------------

/**
 * Configuration object for the `cybersource-rest-client` legacy SDK.
 * Used for callback-based APIs (instrument identifiers, payment instruments, voids).
 */
class LegacySdkConfig {
  authenticationType = 'http_Signature';
  runEnvironment: string;
  merchantID: string;
  merchantKeyId: string;
  merchantsecretKey: string;
  portfolioID?: string;
  logConfiguration = { enableLog: false };

  constructor(config: CyberSourceClientConfig) {
    this.runEnvironment = config.environment;
    this.merchantID = config.merchantId;
    this.merchantKeyId = config.keyId;
    this.merchantsecretKey = config.sharedSecretKey;
    this.portfolioID = config.profileId;
  }
}

/**
 * Configuration adapter for `@paciolan/cybersource-sdk`.
 * Used for promise-based APIs (customer, payer auth, payments, refunds).
 */
function createPaciolanConfig(config: CyberSourceClientConfig): {
  runEnvironment: string;
  merchantID: string;
  merchantKeyId: string;
  merchantsecretKey: string;
  authenticationType: string;
} {
  return {
    runEnvironment: config.environment,
    merchantID: config.merchantId,
    merchantKeyId: config.keyId,
    merchantsecretKey: config.sharedSecretKey,
    authenticationType: 'http_signature',
  };
}

// ---------------------------------------------------------------------------
// Client Options
// ---------------------------------------------------------------------------

/**
 * Options for the CyberSource client constructor.
 *
 * @example
 * ```ts
 * const client = new CyberSourceClient({
 *   merchantId: 'my_merchant',
 *   keyId: 'key-uuid',
 *   sharedSecretKey: 'base64secret==',
 *   environment: CyberSourceEnvironment.Test,
 *   logger: myPinoLogger,
 *   retry: { maxAttempts: 2 },
 *   authCache: new InMemoryThreeDSAuthCache(),
 * });
 * ```
 */
export interface CyberSourceClientOptions extends CyberSourceClientConfig {
  /** Logger instance (defaults to silent noop logger) */
  logger?: PaymentLogger;
  /** Retry configuration overrides */
  retry?: Partial<RetryConfig>;
  /** 3DS auth data cache (defaults to InMemoryThreeDSAuthCache) */
  authCache?: ThreeDSAuthCache;
}

// ---------------------------------------------------------------------------
// CyberSourceClient
// ---------------------------------------------------------------------------

export class CyberSourceClient {
  private readonly config: CyberSourceClientConfig;
  private readonly logger: PaymentLogger;
  private readonly retryConfig: Partial<RetryConfig>;
  private readonly authCache: ThreeDSAuthCache;
  private readonly legacyConfig: LegacySdkConfig;
  private readonly paciolanConfig: ReturnType<typeof createPaciolanConfig>;

  /**
   * Create a new CyberSource client.
   *
   * @param options - Client configuration including credentials, logger, retry, and auth cache
   *
   * @example
   * ```ts
   * import { CyberSourceClient, CyberSourceEnvironment } from '@devhubpty/cybersource/server';
   *
   * const client = new CyberSourceClient({
   *   merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
   *   keyId: process.env.CYBERSOURCE_KEY!,
   *   sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
   *   environment: CyberSourceEnvironment.Test,
   * });
   * ```
   */
  constructor(options: CyberSourceClientOptions) {
    const { logger, retry, authCache, ...config } = options;

    if (!config.merchantId) throw new CyberSourceError('merchantId is required', undefined, 'CONFIG_ERROR');
    if (!config.keyId) throw new CyberSourceError('keyId is required', undefined, 'CONFIG_ERROR');
    if (!config.sharedSecretKey) throw new CyberSourceError('sharedSecretKey is required', undefined, 'CONFIG_ERROR');
    if (!config.environment) throw new CyberSourceError('environment is required', undefined, 'CONFIG_ERROR');

    this.config = config;
    this.logger = logger ?? noopLogger;
    this.retryConfig = retry ?? {};
    this.authCache = authCache ?? new InMemoryThreeDSAuthCache();
    this.legacyConfig = new LegacySdkConfig(config);
    this.paciolanConfig = createPaciolanConfig(config);
  }

  // -------------------------------------------------------------------------
  // Health Check
  // -------------------------------------------------------------------------

  /**
   * Perform a health check against the CyberSource API.
   *
   * Makes a HEAD request to the API base URL to verify connectivity
   * and measure latency.
   *
   * @returns Health check result with reachability and latency
   *
   * @example
   * ```ts
   * const health = await client.ping();
   * if (health.ok) {
   *   console.log(`CyberSource is up (${health.latencyMs}ms)`);
   * }
   * ```
   */
  async ping(): Promise<HealthCheckResult> {
    const start = Date.now();
    const url = `https://${this.config.environment}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return {
        reachable: response.status < 500,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        reachable: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Customer Management
  // -------------------------------------------------------------------------

  /**
   * Create a new customer in the CyberSource Token Management Service (TMS).
   *
   * The returned customer ID is used for all subsequent operations (tokenization,
   * 3DS authentication, and payments). Store it in your database.
   *
   * @param data - Customer creation data
   * @param opts - Optional idempotency key
   * @returns The created customer
   * @throws {CyberSourceError} If the API call fails
   *
   * @example
   * ```ts
   * const customer = await client.createCustomer({
   *   customerId: 'user-123',
   *   email: 'juan@example.com',
   *   phone: '+5076000000',
   * });
   * console.log('CyberSource ID:', customer.id);
   * ```
   */
  async createCustomer(
    data: CreateCustomerRequest,
    opts?: { idempotencyKey?: string },
  ): Promise<CustomerResponse> {
    this.logger.info('Creating CyberSource customer', sanitize({
      customerId: data.customerId,
      email: data.email,
    }));

    const payload = {
      buyerInformation: {
        email: data.email,
        merchantCustomerID: data.customerId,
      },
      clientReferenceInformation: {
        code: data.customerId,
      },
      merchantDefinedInformation: data.merchantDefinedInformation ?? [
        { name: 'data1', value: this.config.merchantId.toUpperCase() },
        { name: 'data2', value: 'PENDIENTE' },
        { name: 'data3', value: 'PENDIENTE' },
        { name: 'data4', value: 'GROCERY' },
      ],
    };

    try {
      const result = await withRetry(
        async () => {
          // Dynamic import to support both SDK versions
          const { CustomerApi } = await import('@paciolan/cybersource-sdk');
          const customerApi = new CustomerApi(this.paciolanConfig as never);
          const response = await customerApi.postCustomer(
            payload as never,
            undefined,
            this.paciolanConfig as never,
          );
          return response.data as CustomerResponse;
        },
        {
          ...this.retryConfig,
          onRetry: (err, attempt, delay) => {
            this.logger.warn(`Retrying createCustomer (attempt ${attempt}, delay ${delay}ms)`, {
              error: err.message,
            });
          },
        },
      );

      this.logger.info('Customer created successfully', { cybersourceId: result.id });
      return result;
    } catch (error) {
      this.logger.error('Failed to create CyberSource customer', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to create customer',
            undefined,
            'CREATE_CUSTOMER_FAILED',
          );
    }
  }

  /**
   * Delete a customer from CyberSource TMS.
   *
   * This also removes all associated payment instruments.
   *
   * @param cybersourceCustomerId - The CyberSource customer ID to delete
   * @throws {CyberSourceError} If the API call fails
   *
   * @example
   * ```ts
   * await client.deleteCustomer('ABC123');
   * ```
   */
  async deleteCustomer(cybersourceCustomerId: string): Promise<void> {
    this.logger.info('Deleting CyberSource customer', { cybersourceCustomerId });

    try {
      const { CustomerApi } = await import('@paciolan/cybersource-sdk');
      const customerApi = new CustomerApi(this.paciolanConfig as never);
      await customerApi.deleteCustomer(
        cybersourceCustomerId,
        undefined,
        this.paciolanConfig as never,
      );

      this.logger.info('Customer deleted successfully', { cybersourceCustomerId });
    } catch (error) {
      this.logger.error('Failed to delete CyberSource customer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        cybersourceCustomerId,
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to delete customer',
            undefined,
            'DELETE_CUSTOMER_FAILED',
          );
    }
  }

  // -------------------------------------------------------------------------
  // Card Tokenization (2-step)
  // -------------------------------------------------------------------------

  /**
   * Create an instrument identifier (step 1 of card tokenization).
   *
   * Tokenizes the raw card number and security code into a reusable token.
   * The card number is not stored -- only the token is returned.
   *
   * This must be followed by {@link createPaymentInstrument} to create a
   * fully usable payment method.
   *
   * @param data - Card number and security code
   * @returns The instrument identifier with truncated card number
   * @throws {CyberSourceError} If tokenization fails
   *
   * @example
   * ```ts
   * const ii = await client.createInstrumentIdentifier({
   *   cardNumber: '4111111111111111',
   *   securityCode: '123',
   * });
   * console.log('Token:', ii.id);
   * console.log('Card:', ii.card.number); // 'xxxxxxxxxxxx1111'
   * ```
   */
  async createInstrumentIdentifier(
    data: CreateInstrumentIdentifierRequest,
  ): Promise<InstrumentIdentifierResponse> {
    this.logger.info('Creating instrument identifier', {
      cardLastFour: data.cardNumber.slice(-4),
    });

    try {
      const result = await withRetry(
        async () => {
          const apiClient = new cybersourceRestApi.ApiClient();
          const requestObj = new cybersourceRestApi.PostInstrumentIdentifierRequest();
          const opts: Record<string, unknown> = {};

          if (this.config.profileId) {
            opts['profileId'] = this.config.profileId;
          }

          const card = new cybersourceRestApi.TmsEmbeddedInstrumentIdentifierCard();
          card.number = data.cardNumber;
          card.securityCode = data.securityCode;

          requestObj.card = card;
          requestObj.type = 'enrollable card';

          const instance = new cybersourceRestApi.InstrumentIdentifierApi(
            this.legacyConfig,
            apiClient,
          );

          return promisifySdkCall<InstrumentIdentifierResponse>(
            (callback) => instance.postInstrumentIdentifier(requestObj, opts, callback),
          );
        },
        {
          ...this.retryConfig,
          onRetry: (err, attempt, delay) => {
            this.logger.warn(`Retrying createInstrumentIdentifier (attempt ${attempt}, delay ${delay}ms)`, {
              error: err.message,
            });
          },
        },
      );

      this.logger.info('Instrument identifier created', {
        instrumentId: result.data.id,
        state: result.data.state,
      });

      return result.data;
    } catch (error) {
      this.logger.error('Failed to create instrument identifier', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to create instrument identifier',
            undefined,
            'CREATE_INSTRUMENT_IDENTIFIER_FAILED',
          );
    }
  }

  /**
   * Create a payment instrument (step 2 of card tokenization).
   *
   * Associates an instrument identifier with a customer, billing address,
   * and card expiration data. The resulting payment instrument ID is used
   * for 3DS authentication and payment processing.
   *
   * @param data - Payment instrument creation data
   * @param opts - Optional idempotency key
   * @returns The created payment instrument
   * @throws {CyberSourceError} If the API call fails
   *
   * @example
   * ```ts
   * const pi = await client.createPaymentInstrument({
   *   cybersourceCustomerId: 'ABC123',
   *   instrumentIdentifierTokenId: 'II_xyz',
   *   expirationMonth: '12',
   *   expirationYear: '2028',
   *   type: '001',
   *   billTo: {
   *     firstName: 'Juan',
   *     lastName: 'Perez',
   *     address1: 'Calle 50',
   *     country: 'PA',
   *     email: 'juan@example.com',
   *   },
   * });
   * console.log('Payment instrument:', pi.id);
   * ```
   */
  async createPaymentInstrument(
    data: CreatePaymentInstrumentRequest,
    opts?: { idempotencyKey?: string },
  ): Promise<PaymentInstrumentResponse> {
    this.logger.info('Creating payment instrument', {
      cybersourceCustomerId: data.cybersourceCustomerId,
      instrumentIdentifierTokenId: data.instrumentIdentifierTokenId,
    });

    if (!data.cybersourceCustomerId) {
      throw new CyberSourceError(
        'cybersourceCustomerId is required',
        undefined,
        'VALIDATION_ERROR',
      );
    }

    const payload = {
      card: {
        expirationMonth: data.expirationMonth,
        expirationYear: data.expirationYear,
        type: data.type,
      },
      billTo: {
        firstName: data.billTo.firstName,
        lastName: data.billTo.lastName,
        address1: (data.billTo.address1 || 'Panama').slice(0, 56),
        locality: data.billTo.locality || 'Panama',
        administrativeArea: data.billTo.administrativeArea || 'Panama',
        country: data.billTo.country || 'PA',
        email: data.billTo.email,
      },
      instrumentIdentifier: {
        id: data.instrumentIdentifierTokenId,
      },
    };

    try {
      const result = await withRetry(
        async () => {
          const { CustomerPaymentInstrumentApi } = await import('@paciolan/cybersource-sdk');
          const apiPayment = new CustomerPaymentInstrumentApi();
          const response = await apiPayment.postCustomerPaymentInstrument(
            payload as never,
            data.cybersourceCustomerId,
            undefined,
            this.paciolanConfig as never,
          );
          return response.data as PaymentInstrumentResponse;
        },
        {
          ...this.retryConfig,
          onRetry: (err, attempt, delay) => {
            this.logger.warn(`Retrying createPaymentInstrument (attempt ${attempt}, delay ${delay}ms)`, {
              error: err.message,
            });
          },
        },
      );

      this.logger.info('Payment instrument created', {
        instrumentId: result.id,
        state: result.state,
        cardType: result.card?.type,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create payment instrument', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to create payment instrument',
            undefined,
            'CREATE_PAYMENT_INSTRUMENT_FAILED',
          );
    }
  }

  /**
   * Retrieve a payment instrument by its token ID.
   *
   * @param paymentInstrumentId - The payment instrument token ID
   * @returns The payment instrument data
   * @throws {CyberSourceError} If the API call fails
   *
   * @example
   * ```ts
   * const pi = await client.getPaymentInstrument('PI_xyz');
   * console.log('Card type:', pi.card.type);
   * console.log('Last four:', pi._embedded.instrumentIdentifier.card.number);
   * ```
   */
  async getPaymentInstrument(
    paymentInstrumentId: string,
  ): Promise<PaymentInstrumentResponse> {
    this.logger.info('Retrieving payment instrument', { paymentInstrumentId });

    try {
      const apiClient = new cybersourceRestApi.ApiClient();
      const opts: Record<string, unknown> = {};

      if (this.config.profileId) {
        opts['profileId'] = this.config.profileId;
      }

      const instance = new cybersourceRestApi.PaymentInstrumentApi(
        this.legacyConfig,
        apiClient,
      );

      const result = await promisifySdkCall<PaymentInstrumentResponse>(
        (callback) => instance.getPaymentInstrument(paymentInstrumentId, opts, callback),
      );

      this.logger.info('Payment instrument retrieved', {
        instrumentId: result.data.id,
        state: result.data.state,
      });

      return result.data;
    } catch (error) {
      this.logger.error('Failed to retrieve payment instrument', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentInstrumentId,
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to retrieve payment instrument',
            undefined,
            'GET_PAYMENT_INSTRUMENT_FAILED',
          );
    }
  }

  // -------------------------------------------------------------------------
  // 3DS Authentication (3-step)
  // -------------------------------------------------------------------------

  /**
   * Set up payer authentication (step 1 of 3DS flow).
   *
   * Initializes the 3DS authentication process. The response contains:
   * - `accessToken`: JWT for the device data collection iframe
   * - `deviceDataCollectionUrl`: URL for the fingerprinting iframe
   * - `referenceId`: ID to pass to `checkEnrollment`
   *
   * Before setup, the customer's default payment instrument is updated
   * to the specified `paymentInstrumentId`.
   *
   * @param data - Setup authentication request
   * @returns Setup response with device data collection info
   * @throws {CyberSourceError} If setup fails
   *
   * @example
   * ```ts
   * const setup = await client.setupAuthentication({
   *   cybersourceCustomerId: 'ABC123',
   *   paymentInstrumentId: 'PI_xyz',
   *   sessionId: 'fingerprint-session-id',
   * });
   *
   * // Use in frontend:
   * // 1. Load deviceDataCollectionUrl in a hidden iframe
   * // 2. Pass accessToken as JWT to the iframe
   * // 3. Use referenceId for the enrollment check
   * ```
   */
  async setupAuthentication(
    data: SetupAuthRequest,
  ): Promise<SetupAuthResponse> {
    this.logger.info('Setting up 3DS authentication', sanitize({
      cybersourceCustomerId: data.cybersourceCustomerId,
      paymentInstrumentId: data.paymentInstrumentId,
    }));

    try {
      // First, set the default payment instrument on the customer
      const { CustomerApi, PayerAuthenticationApi } = await import('@paciolan/cybersource-sdk');

      const customerApi = new CustomerApi();
      const customerBody = {
        defaultPaymentInstrument: {
          id: data.paymentInstrumentId,
        },
      };

      await customerApi.patchCustomer(
        customerBody as never,
        data.cybersourceCustomerId,
        undefined,
        undefined,
        this.paciolanConfig as never,
      );

      // Then, set up payer authentication
      const payerApi = new PayerAuthenticationApi();
      const body: Record<string, unknown> = {
        paymentInformation: {
          customer: {
            customerId: data.cybersourceCustomerId,
          },
        },
      };

      if (data.sessionId) {
        body['deviceInformation'] = {
          fingerprintSessionId: data.sessionId,
        };
      }

      const response = await payerApi.payerAuthSetup(
        body as never,
        this.paciolanConfig as never,
      );

      this.logger.info('3DS setup completed', {
        status: response.status,
      });

      return response.data as SetupAuthResponse;
    } catch (error) {
      this.logger.error('Failed to set up 3DS authentication', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to set up authentication',
            undefined,
            'SETUP_AUTH_FAILED',
          );
    }
  }

  /**
   * Check 3DS enrollment (step 2 of 3DS flow).
   *
   * Determines whether the card is enrolled in 3DS and whether a challenge
   * is required. The result can be:
   *
   * - **Frictionless** (`AUTHENTICATION_SUCCESSFUL` / `AUTHENTICATED`):
   *   No user interaction needed. Auth data is automatically cached for
   *   payment processing fallback. Proceed directly to `processPayment`.
   *
   * - **Challenge required** (`PENDING_AUTHENTICATION`):
   *   The user must complete a challenge in an iframe using the `stepUpUrl`
   *   and `accessToken` from the response. After the challenge, call
   *   `validateAuthentication`.
   *
   * @param data - Enrollment check request with billing and device info
   * @returns Enrollment response with authentication status
   * @throws {CyberSourceError} If the enrollment check fails
   *
   * @example
   * ```ts
   * const enrollment = await client.checkEnrollment({
   *   referenceId: setup.consumerAuthenticationInformation.referenceId,
   *   cybersourceCustomerId: 'ABC123',
   *   amount: '25.99',
   *   currency: 'USD',
   *   billingAddress: { firstName: 'Juan', lastName: 'Perez', ... },
   *   returnUrl: 'https://example.com/api/3ds-callback',
   * });
   *
   * if (enrollment.status === 'AUTHENTICATION_SUCCESSFUL') {
   *   // Frictionless - proceed to payment
   * } else if (enrollment.status === 'PENDING_AUTHENTICATION') {
   *   // Show challenge iframe with stepUpUrl + accessToken
   * }
   * ```
   */
  async checkEnrollment(
    data: CheckEnrollmentRequest,
  ): Promise<EnrollmentResponse> {
    this.logger.info('Checking 3DS enrollment', sanitize({
      referenceId: data.referenceId,
      cybersourceCustomerId: data.cybersourceCustomerId,
      amount: data.amount,
      currency: data.currency,
    }));

    try {
      const { PayerAuthenticationApi } = await import('@paciolan/cybersource-sdk');
      const payerApi = new PayerAuthenticationApi();

      const payload: Record<string, unknown> = {
        consumerAuthenticationInformation: {
          deviceChannel: 'browser',
          referenceId: data.referenceId,
          returnUrl: data.returnUrl,
        },
        orderInformation: {
          amountDetails: {
            currency: data.currency,
            totalAmount: data.amount,
          },
          billTo: { ...data.billingAddress },
        },
        paymentInformation: {
          customer: {
            customerId: data.cybersourceCustomerId,
          },
        },
        deviceInformation: {
          ...(data.sessionId && { fingerprintSessionId: data.sessionId }),
          ...(data.deviceInfo?.ipAddress && { ipAddress: data.deviceInfo.ipAddress }),
          ...(data.deviceInfo?.httpAcceptBrowserValue && { httpAcceptBrowserValue: data.deviceInfo.httpAcceptBrowserValue }),
          ...(data.deviceInfo?.httpBrowserLanguage && { httpBrowserLanguage: data.deviceInfo.httpBrowserLanguage }),
          httpBrowserJavaEnabled: data.deviceInfo?.httpBrowserJavaEnabled ?? false,
          httpBrowserJavaScriptEnabled: data.deviceInfo?.httpBrowserJavaScriptEnabled ?? true,
          httpBrowserColorDepth: data.deviceInfo?.httpBrowserColorDepth ?? '24',
          httpBrowserScreenHeight: data.deviceInfo?.httpBrowserScreenHeight ?? '1080',
          httpBrowserScreenWidth: data.deviceInfo?.httpBrowserScreenWidth ?? '1920',
          httpBrowserTimeDifference: data.deviceInfo?.httpBrowserTimeDifference ?? '0',
          ...(data.deviceInfo?.userAgentBrowserValue && { userAgentBrowserValue: data.deviceInfo.userAgentBrowserValue }),
          ...(data.deviceInfo?.httpAcceptContent && { httpAcceptContent: data.deviceInfo.httpAcceptContent }),
        },
      };

      const response = await payerApi.checkPayerAuthEnrollment(
        payload as never,
        this.paciolanConfig as never,
      );

      const enrollmentResponse = response.data as EnrollmentResponse;

      this.logger.info('3DS enrollment check completed', {
        status: enrollmentResponse.status,
        hasConsumerAuth: !!enrollmentResponse.consumerAuthenticationInformation,
      });

      // Cache frictionless 3DS auth data for processPayment fallback
      const enrollStatus = enrollmentResponse.status;
      const consumerAuth = enrollmentResponse.consumerAuthenticationInformation;
      const authTxId = consumerAuth?.authenticationTransactionId;

      if (
        (enrollStatus === 'AUTHENTICATION_SUCCESSFUL' || enrollStatus === 'AUTHENTICATED') &&
        consumerAuth &&
        authTxId
      ) {
        const authData: ThreeDSAuthData = {
          cavv: consumerAuth.cavv || '',
          xid: consumerAuth.xid || '',
          eci: consumerAuth.eci || '',
          eciRaw: consumerAuth.eciRaw || '',
          authenticationTransactionId: authTxId,
          directoryServerTransactionId: consumerAuth.directoryServerTransactionId || '',
          specificationVersion: consumerAuth.specificationVersion || '',
          timestamp: Date.now(),
        };
        this.authCache.set(authTxId, authData);
        this.logger.info('Frictionless 3DS auth data cached', {
          authenticationTransactionId: authTxId,
        });
      }

      return enrollmentResponse;
    } catch (error) {
      this.logger.error('3DS enrollment check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to check enrollment',
            undefined,
            'CHECK_ENROLLMENT_FAILED',
          );
    }
  }

  /**
   * Validate 3DS authentication result (step 3 of challenge flow).
   *
   * Called after the user completes a 3DS challenge. Validates the
   * authentication result with CyberSource and caches the auth data
   * for the subsequent `processPayment` call.
   *
   * @param data - Validation request with the authentication transaction ID
   * @returns Validation response with final authentication data
   * @throws {CyberSourceError} If validation fails
   *
   * @example
   * ```ts
   * const validation = await client.validateAuthentication({
   *   authenticationTransactionId: 'txn-from-challenge',
   * });
   *
   * if (validation.status === 'AUTHENTICATION_SUCCESSFUL' || validation.status === 'VALIDATED') {
   *   // Proceed to payment
   *   const { cavv, eciRaw } = validation.consumerAuthenticationInformation;
   * }
   * ```
   */
  async validateAuthentication(
    data: ValidateAuthRequest,
  ): Promise<ValidateAuthResponse> {
    this.logger.info('Validating 3DS authentication', {
      authenticationTransactionId: data.authenticationTransactionId,
    });

    try {
      const { PayerAuthenticationApi } = await import('@paciolan/cybersource-sdk');
      const payerApi = new PayerAuthenticationApi();

      const payload = {
        consumerAuthenticationInformation: {
          authenticationTransactionId: data.authenticationTransactionId,
        },
      };

      const response = await payerApi.validateAuthenticationResults(
        payload as never,
        this.paciolanConfig as never,
      );

      const validateResponse = response.data as ValidateAuthResponse;

      this.logger.info('3DS validation completed', {
        status: validateResponse.status,
      });

      // Cache challenge auth data for processPayment fallback
      const consumerAuth = validateResponse.consumerAuthenticationInformation;
      const status = validateResponse.status;

      if (
        data.authenticationTransactionId &&
        (status === 'AUTHENTICATION_SUCCESSFUL' || status === 'VALIDATED')
      ) {
        const authData: ThreeDSAuthData = {
          cavv: consumerAuth?.cavv || '',
          xid: consumerAuth?.xid || '',
          eci: consumerAuth?.eci || '',
          eciRaw: consumerAuth?.eciRaw || '',
          authenticationTransactionId: data.authenticationTransactionId,
          directoryServerTransactionId: consumerAuth?.directoryServerTransactionId || '',
          specificationVersion: consumerAuth?.specificationVersion || '',
          timestamp: Date.now(),
        };
        this.authCache.set(data.authenticationTransactionId, authData);
        this.logger.info('Challenge 3DS auth data cached', {
          authenticationTransactionId: data.authenticationTransactionId,
        });
      }

      return validateResponse;
    } catch (error) {
      this.logger.error('3DS validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to validate authentication',
            undefined,
            'VALIDATE_AUTH_FAILED',
          );
    }
  }

  // -------------------------------------------------------------------------
  // Payment Processing
  // -------------------------------------------------------------------------

  /**
   * Process a payment (authorize + capture in a single call).
   *
   * Uses the 3DS authentication result to process the payment. If the
   * frontend did not send all required 3DS fields, the client automatically
   * fills them from the internal auth cache (populated by `checkEnrollment`
   * or `validateAuthentication`).
   *
   * The payment uses `capture: true` by default (authorize + capture),
   * matching the standard Merkapp flow.
   *
   * @param data - Payment request data
   * @param opts - Optional idempotency key
   * @returns Payment response with transaction status
   * @throws {CyberSourceError} If the payment fails
   *
   * @example
   * ```ts
   * const payment = await client.processPayment({
   *   totalAmount: '25.99',
   *   currency: 'USD',
   *   cybersourceCustomerId: 'ABC123',
   *   customerId: 'user-123',
   *   sessionId: 'fingerprint-session',
   *   auth3DSResult: {
   *     cavv: 'AAACBllleHchZTBWIGV4MAAAAAAA',
   *     xid: 'CAACCVVUlwCXUyhQNlSXAAAAAAA=',
   *     eciRaw: '05',
   *     authenticationTransactionId: 'txn-abc',
   *   },
   *   source: 'web',
   *   businessId: 'org1',
   *   cardType: '001',
   *   billTo: {
   *     firstName: 'Juan',
   *     lastName: 'Perez',
   *     address1: 'Calle 50',
   *     country: 'PA',
   *     email: 'juan@example.com',
   *   },
   * });
   *
   * if (payment.status === 'AUTHORIZED') {
   *   console.log('Payment approved:', payment.id);
   * }
   * ```
   */
  async processPayment(
    data: ProcessPaymentRequest,
    opts?: { idempotencyKey?: string },
  ): Promise<PaymentResponse> {
    this.logger.info('Processing payment', sanitize({
      totalAmount: data.totalAmount,
      currency: data.currency,
      cybersourceCustomerId: data.cybersourceCustomerId,
      customerId: data.customerId,
      cardType: data.cardType,
      source: data.source,
    }));

    // Fallback: fill missing 3DS fields from auth cache
    const authTxId = data.auth3DSResult.authenticationTransactionId;
    const cachedAuth = authTxId ? this.authCache.get(authTxId) : undefined;

    if (cachedAuth) {
      const auth = data.auth3DSResult;
      let usedCache = false;

      if (!auth.cavv && cachedAuth.cavv) { auth.cavv = cachedAuth.cavv; usedCache = true; }
      if (!auth.xid && cachedAuth.xid) { auth.xid = cachedAuth.xid; usedCache = true; }
      if (!auth.eci && cachedAuth.eci) { auth.eci = cachedAuth.eci; usedCache = true; }
      if (!auth.eciRaw && cachedAuth.eciRaw) { auth.eciRaw = cachedAuth.eciRaw; usedCache = true; }
      if (!auth.authenticationTransactionId && cachedAuth.authenticationTransactionId) {
        auth.authenticationTransactionId = cachedAuth.authenticationTransactionId;
        usedCache = true;
      }
      if (!auth.directoryServerTransactionId && cachedAuth.directoryServerTransactionId) {
        auth.directoryServerTransactionId = cachedAuth.directoryServerTransactionId;
        usedCache = true;
      }
      if (!auth.specificationVersion && cachedAuth.specificationVersion) {
        auth.specificationVersion = cachedAuth.specificationVersion;
        usedCache = true;
      }

      if (usedCache) {
        this.logger.info('Filled missing 3DS fields from auth cache', {
          authenticationTransactionId: authTxId,
        });
      }

      // Clean up used cache entry
      this.authCache.delete(authTxId);
    }

    try {
      // Update customer with merchant defined information
      const { CustomerApi, PaymentsApi } = await import('@paciolan/cybersource-sdk');

      const apiCustomer = new CustomerApi();
      const payloadCustomer = {
        merchantDefinedInformation: [
          { name: 'data1', value: this.config.merchantId.toUpperCase() },
          { name: 'data2', value: data.source === 'app' ? 'MOBILE' : 'WEB' },
          { name: 'data3', value: data.businessId.toUpperCase() },
          { name: 'data4', value: 'GROCERY' },
        ],
      };

      await apiCustomer.patchCustomer(
        payloadCustomer as never,
        data.cybersourceCustomerId,
        undefined,
        undefined,
        this.paciolanConfig as never,
      );

      // Process payment
      const paymentApi = new PaymentsApi();
      const auth3DS = data.auth3DSResult;

      const payload: Record<string, unknown> = {
        clientReferenceInformation: {
          code: crypto.randomUUID(),
        },
        deviceInformation: {
          fingerprintSessionId: data.sessionId,
        },
        processingInformation: {
          capture: data.capture ?? true,
          authorizationOptions: {
            initiator: {
              type: 'customer',
              storedCredentialUsed: true,
            },
          },
        },
        orderInformation: {
          amountDetails: {
            totalAmount: data.totalAmount,
            currency: data.currency,
          },
          billTo: {
            locality: data.billTo.locality || 'Panama City',
            lastName: data.billTo.lastName,
            firstName: data.billTo.firstName,
            address1: data.billTo.address1,
            country: data.billTo.country,
            email: data.billTo.email,
          },
        },
        merchantDefinedInformation: data.merchantDefinedInformation ?? [
          { key: '1', value: this.config.merchantId.toUpperCase() },
          { key: '2', value: data.source === 'app' ? 'MOBILE' : 'WEB' },
          { key: '3', value: data.businessId.toUpperCase() },
          { key: '4', value: 'GROCERY' },
          { key: '5', value: `${data.billTo.firstName} ${data.billTo.lastName}` },
          { key: '6', value: 'GROCERY' },
          { key: '7', value: data.customerId },
          { key: '8', value: 'NO' },
        ],
        paymentInformation: {
          customer: {
            customerId: data.cybersourceCustomerId,
          },
        },
        consumerAuthenticationInformation: {
          ...(auth3DS.authenticationTransactionId && {
            authenticationTransactionId: auth3DS.authenticationTransactionId,
          }),
          ...(auth3DS.eciRaw && { eciRaw: auth3DS.eciRaw }),
          ...(auth3DS.directoryServerTransactionId && {
            directoryServerTransactionId: auth3DS.directoryServerTransactionId,
          }),
          ...(auth3DS.specificationVersion && {
            paSpecificationVersion: auth3DS.specificationVersion,
          }),
          ...(auth3DS.ucafCollectionIndicator && {
            ucafCollectionIndicator: auth3DS.ucafCollectionIndicator,
          }),
          ...(auth3DS.ucafAuthenticationData && {
            ucafAuthenticationData: auth3DS.ucafAuthenticationData,
          }),
          cavvAlgorithm: '2',
        },
      };

      const response = await paymentApi.createPayment(
        payload as never,
        this.paciolanConfig as never,
      );

      const paymentResponse = response.data as PaymentResponse;

      this.logger.info('Payment processed', {
        httpStatus: response.status,
        paymentStatus: paymentResponse.status,
        paymentId: paymentResponse.id,
      });

      return paymentResponse;
    } catch (error) {
      this.logger.error('Payment processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to process payment',
            undefined,
            'PROCESS_PAYMENT_FAILED',
          );
    }
  }

  /**
   * Refund a previously captured payment.
   *
   * @param data - Refund request with original payment ID and amount
   * @param opts - Optional idempotency key
   * @returns Payment response for the refund transaction
   * @throws {CyberSourceError} If the refund fails
   *
   * @example
   * ```ts
   * const refund = await client.refundPayment({
   *   paymentId: 'original-payment-123',
   *   amount: '10.00',
   *   currency: 'USD',
   *   codeReference: 'REFUND-ORDER-456',
   * });
   * console.log('Refund status:', refund.status);
   * ```
   */
  async refundPayment(
    data: RefundRequest,
    opts?: { idempotencyKey?: string },
  ): Promise<PaymentResponse> {
    this.logger.info('Processing refund', {
      paymentId: data.paymentId,
      amount: data.amount,
      currency: data.currency,
    });

    if (!data.paymentId) {
      throw new CyberSourceError(
        'paymentId is required for refund',
        undefined,
        'VALIDATION_ERROR',
      );
    }

    try {
      const { RefundApi } = await import('@paciolan/cybersource-sdk');
      const refundApi = new RefundApi();

      const payload = {
        clientReferenceInformation: {
          code: data.codeReference,
        },
        orderInformation: {
          amountDetails: {
            totalAmount: data.amount,
            currency: data.currency,
          },
        },
      };

      const response = await refundApi.refundPayment(
        payload as never,
        data.paymentId,
        this.paciolanConfig as never,
      );

      const refundResponse = response.data as PaymentResponse;

      this.logger.info('Refund processed', {
        status: refundResponse.status,
        refundId: refundResponse.id,
      });

      return refundResponse;
    } catch (error) {
      this.logger.error('Refund failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: data.paymentId,
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to process refund',
            undefined,
            'REFUND_FAILED',
          );
    }
  }

  /**
   * Void a previously authorized payment (before capture settlement).
   *
   * Uses the `cybersource-rest-client` legacy SDK via the callback-to-promise wrapper.
   *
   * @param data - Void request with the payment transaction ID
   * @param opts - Optional idempotency key
   * @returns Object with the void status
   * @throws {CyberSourceError} If the void fails
   *
   * @example
   * ```ts
   * const result = await client.voidPayment({
   *   paymentId: 'authorized-payment-123',
   *   codeReference: 'VOID-ORDER-456',
   * });
   * console.log('Void status:', result.status);
   * ```
   */
  async voidPayment(
    data: VoidRequest,
    opts?: { idempotencyKey?: string },
  ): Promise<{ status: string }> {
    this.logger.info('Voiding payment', {
      paymentId: data.paymentId,
      codeReference: data.codeReference,
    });

    if (!data.paymentId) {
      throw new CyberSourceError(
        'paymentId is required for void',
        undefined,
        'VALIDATION_ERROR',
      );
    }

    try {
      const apiClient = new cybersourceRestApi.ApiClient();
      const requestObj = new cybersourceRestApi.VoidPaymentRequest();

      const clientReferenceInformation =
        new cybersourceRestApi.Ptsv2paymentsidreversalsClientReferenceInformation();
      clientReferenceInformation.code = data.codeReference;
      requestObj.clientReferenceInformation = clientReferenceInformation;

      const instance = new cybersourceRestApi.VoidApi(
        this.legacyConfig,
        apiClient,
      );

      const result = await promisifySdkCall<{ status: string }>(
        (callback) => instance.voidPayment(requestObj, data.paymentId, callback),
      );

      this.logger.info('Payment voided', {
        status: result.status,
        paymentId: data.paymentId,
      });

      return { status: result.status };
    } catch (error) {
      this.logger.error('Void failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: data.paymentId,
      });
      throw error instanceof CyberSourceError
        ? error
        : new CyberSourceError(
            error instanceof Error ? error.message : 'Failed to void payment',
            undefined,
            'VOID_FAILED',
          );
    }
  }
}
