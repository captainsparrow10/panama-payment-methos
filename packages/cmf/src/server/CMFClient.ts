/**
 * @module CMFClient
 *
 * Server-side client for the CMF (Banco General / CM Financiera) financing API.
 *
 * This client handles authentication, customer lookup, quota simulation,
 * purchase processing (installment and normal), OTP verification, and
 * transaction verification.
 *
 * **IMPORTANT**: This client must only be used on the server (Node.js).
 * Never expose merchant credentials (`email`, `password`) to the browser.
 *
 * @example
 * ```ts
 * import { CMFClient, CMFDocumentType } from '@panama-payments/cmf/server';
 *
 * const cmf = new CMFClient({
 *   baseUrl: process.env.CMF_URL!,
 *   email: process.env.CMF_EMAIL!,
 *   password: process.env.CMF_PASSWORD!,
 *   branchOfficeCode: process.env.CMF_BRANCH_OFFICE_CODE!,
 *   companyCode: process.env.CMF_COMPANY_CODE!,
 *   createdBy: process.env.CMF_CREATED_BY ?? 'system',
 * });
 *
 * await cmf.ensureAuthenticated();
 * const customer = await cmf.getCustomerByDocument(CMFDocumentType.Cedula, '8-123-456');
 * ```
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import {
  AuthenticationError,
  TimeoutError,
  NetworkError,
  withRetry,
  sanitize,
  noopLogger,
} from '@panama-payments/core';
import type {
  PaymentLogger,
  RetryConfig,
  HealthCheckResult,
} from '@panama-payments/core';
import type {
  CMFClientConfig,
  CMFLoginResponse,
  CMFCustomerResponse,
  CMFProduct,
  CMFQuota,
  CMFQuotaPurchaseRequest,
  CMFNormalPurchaseRequest,
  CMFApiResponse,
} from '../types.js';
import { CMFDocumentType } from '../types.js';
import { CMFError } from '../errors.js';

/**
 * Options for payment processing methods that support idempotency.
 *
 * @example
 * ```ts
 * await cmf.processPurchaseInQuotas(params, {
 *   idempotencyKey: 'order-12345-attempt-1',
 * });
 * ```
 */
export interface CMFPaymentOptions {
  /**
   * Idempotency key to prevent duplicate transactions.
   *
   * If the same key is used for a retry, the CMF system will return
   * the original transaction result instead of processing a duplicate.
   * Recommended format: `{orderId}-{timestamp}` or a UUID v4.
   */
  idempotencyKey?: string;
}

/**
 * Client for the CMF (Banco General / HNL) financing API.
 *
 * All API calls are authenticated with a JWT obtained via `login()`.
 * The client manages the token internally and refreshes it automatically
 * by calling `login()` again when needed.
 *
 * Features:
 * - Automatic JWT token management
 * - Structured logging via `PaymentLogger`
 * - Automatic retry with exponential backoff for network/timeout errors
 * - Idempotency key support for payment methods
 * - Health check via `ping()`
 * - Typed error handling via `CMFError`, `AuthenticationError`, `TimeoutError`, `NetworkError`
 *
 * @example
 * ```ts
 * import { CMFClient, CMFDocumentType } from '@panama-payments/cmf/server';
 * import { createConsoleLogger } from '@panama-payments/core';
 *
 * const cmf = new CMFClient({
 *   baseUrl: process.env.CMF_URL!,
 *   email: process.env.CMF_EMAIL!,
 *   password: process.env.CMF_PASSWORD!,
 *   branchOfficeCode: 'MKP',
 *   companyCode: 'MKP',
 *   createdBy: 'system',
 *   logger: createConsoleLogger({ level: 'debug', prefix: '[cmf]' }),
 * });
 * ```
 */
export class CMFClient {
  private readonly http: AxiosInstance;
  /** @internal Exposed for convenience in payment parameter construction. */
  readonly config: CMFClientConfig;
  private token: string | null = null;
  private readonly logger: PaymentLogger;
  private readonly retryConfig: Partial<RetryConfig>;

  /**
   * Creates a new CMFClient instance.
   *
   * @param config - CMF API credentials and configuration
   * @param options - Optional logger and retry configuration
   *
   * @example
   * ```ts
   * const cmf = new CMFClient(
   *   {
   *     baseUrl: process.env.CMF_URL!,
   *     email: process.env.CMF_EMAIL!,
   *     password: process.env.CMF_PASSWORD!,
   *     branchOfficeCode: 'MKP',
   *     companyCode: 'MKP',
   *     createdBy: 'system',
   *   },
   *   {
   *     logger: pinoLogger,
   *     retry: { maxAttempts: 3 },
   *   },
   * );
   * ```
   */
  constructor(
    config: CMFClientConfig,
    options?: {
      /** Logger instance for structured logging. If not provided, logging is disabled. */
      logger?: PaymentLogger;
      /** Override default retry behavior. Only network/timeout errors are retried. */
      retry?: Partial<RetryConfig>;
    },
  ) {
    this.config = config;
    this.logger = options?.logger ?? noopLogger;
    this.retryConfig = {
      maxAttempts: 2,
      baseDelayMs: 1000,
      maxDelayMs: 15000,
      ...options?.retry,
      retryOn: (error: Error) => {
        // Only retry on network/timeout errors, NOT on business errors
        if (error instanceof TimeoutError) return true;
        if (error instanceof NetworkError) return true;
        if (error instanceof CMFError) return false;
        if (error instanceof AuthenticationError) return false;
        // Retry on 5xx HTTP errors
        if (error && 'httpStatus' in error) {
          const status = (error as { httpStatus?: number }).httpStatus;
          return status !== undefined && status >= 500;
        }
        return false;
      },
    };

    this.http = axios.create({
      baseURL: config.baseUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: config.timeoutMs ?? 60000,
    });
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  /**
   * Wraps an axios error into the appropriate typed error from core.
   * @internal
   */
  private wrapAxiosError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError;

      // Timeout
      if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
        throw new TimeoutError(
          `CMF ${context}: Request timed out after ${this.config.timeoutMs ?? 60000}ms`,
          this.config.timeoutMs ?? 60000,
        );
      }

      // Network error (DNS, connection refused, etc.)
      if (axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'ECONNREFUSED' || !axiosErr.response) {
        throw new NetworkError(
          `CMF ${context}: Network error - ${axiosErr.message}`,
          axiosErr,
        );
      }

      // 401 Unauthorized
      if (axiosErr.response?.status === 401) {
        throw new AuthenticationError(
          `CMF ${context}: Authentication failed - ${axiosErr.response.statusText}`,
        );
      }

      // 5xx server error - create a retryable NetworkError
      if (axiosErr.response?.status && axiosErr.response.status >= 500) {
        throw new NetworkError(
          `CMF ${context}: Server error ${axiosErr.response.status}`,
          axiosErr,
        );
      }
    }

    // Re-throw if already a PaymentError subclass
    if (error instanceof CMFError || error instanceof AuthenticationError || error instanceof TimeoutError || error instanceof NetworkError) {
      throw error;
    }

    // Unknown error
    throw new CMFError(
      `CMF ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      null,
      'CMF_UNKNOWN',
    );
  }

  // ── AUTHENTICATION ──────────────────────────────────────────────────────────

  /**
   * Authenticates the merchant with the CMF API and stores the JWT token
   * for subsequent requests.
   *
   * The token is automatically included in all subsequent API calls via the
   * `Authorization: Bearer <token>` header.
   *
   * @returns Login response including the JWT token and merchant user details
   * @throws {AuthenticationError} If authentication fails (invalid credentials)
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * const auth = await cmf.login();
   * console.log(`Logged in as ${auth.firstName} ${auth.firstSurname}`);
   * ```
   */
  async login(): Promise<CMFLoginResponse> {
    this.logger.debug('CMF login: Authenticating merchant...', sanitize({ email: this.config.email }) as Record<string, unknown>);

    try {
      const response = await this.http.post<CMFLoginResponse>('/auth/login', {
        email: this.config.email,
        password: this.config.password,
      });

      const data = response.data;
      if (!data.token) {
        throw new AuthenticationError('CMF login failed: No token in response');
      }

      this.token = data.token;
      this.http.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;

      this.logger.info('CMF login: Authenticated successfully', {
        merchantId: data.id,
        firstName: data.firstName,
      });

      return data;
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      this.wrapAxiosError(error, 'login');
    }
  }

  /**
   * Ensures the client has a valid authentication token.
   * If no token exists, calls `login()` automatically.
   *
   * Call this before making your first API request in a new client instance.
   *
   * @example
   * ```ts
   * await cmf.ensureAuthenticated();
   * const customer = await cmf.getCustomerByDocument(CMFDocumentType.Cedula, '8-123-456');
   * ```
   */
  async ensureAuthenticated(): Promise<void> {
    if (!this.token) {
      await this.login();
    }
  }

  // ── HEALTH CHECK ────────────────────────────────────────────────────────────

  /**
   * Performs a health check by attempting to log in to the CMF API.
   *
   * Returns a `HealthCheckResult` indicating whether the CMF API is reachable
   * and responding to authentication requests. Useful for monitoring dashboards
   * and readiness probes.
   *
   * @returns Health check result with reachability, latency, and optional error
   *
   * @example
   * ```ts
   * const health = await cmf.ping();
   * if (health.reachable) {
   *   console.log(`CMF API is up (${health.latencyMs}ms)`);
   * } else {
   *   console.error(`CMF API is down: ${health.error}`);
   * }
   * ```
   */
  async ping(): Promise<HealthCheckResult> {
    const start = Date.now();
    this.logger.debug('CMF ping: Checking API health...');

    try {
      await this.login();
      const latencyMs = Date.now() - start;

      this.logger.info('CMF ping: API is healthy', { latencyMs });

      return {
        reachable: true,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn('CMF ping: API health check failed', { latencyMs, error: errorMessage });

      return {
        reachable: false,
        latencyMs,
        error: errorMessage,
      };
    }
  }

  // ── CUSTOMER LOOKUP ─────────────────────────────────────────────────────────

  /**
   * Looks up a customer by their document type and number.
   *
   * Use the `CMFDocumentType` enum to get the correct UUID for the document type.
   * The returned `id` (customerId) is required for `getCustomerProducts()`.
   *
   * @param docType - Document type (use the `CMFDocumentType` enum for the correct UUID)
   * @param docNumber - Document number (e.g. '8-123-456' for a cedula)
   * @returns Customer record including the internal `id` (customerId)
   * @throws {CMFError} If customer is not found or API returns an error
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * await cmf.ensureAuthenticated();
   * const customer = await cmf.getCustomerByDocument(CMFDocumentType.Cedula, '8-123-456');
   * console.log(`Found customer: ${customer.fullName} (id: ${customer.id})`);
   * ```
   */
  async getCustomerByDocument(
    docType: CMFDocumentType,
    docNumber: string,
  ): Promise<CMFCustomerResponse> {
    this.logger.debug('CMF getCustomerByDocument: Looking up customer...', {
      docType,
      docNumber: docNumber.length > 4 ? '***' + docNumber.slice(-4) : '****',
    });

    return withRetry(async () => {
      try {
        const response = await this.http.get<CMFApiResponse<CMFCustomerResponse>>(
          `/Customers/${encodeURIComponent(docType)}/${encodeURIComponent(docNumber)}`,
        );
        const data = response.data;

        if (!data.complete || !data.jsonAnswer?.id) {
          throw CMFError.fromResponse(data);
        }

        this.logger.info('CMF getCustomerByDocument: Customer found', {
          customerId: data.jsonAnswer.id,
          fullName: data.jsonAnswer.fullName,
        });

        return data.jsonAnswer;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'getCustomerByDocument');
      }
    }, this.retryConfig);
  }

  /**
   * Looks up a customer by their registered email address.
   *
   * Only use email addresses that the customer registered with CMF.
   * Returns the full customer record including the internal `id` for `getCustomerProducts()`.
   *
   * @param email - Customer's registered CMF email address
   * @returns Customer record including the internal `id` (customerId)
   * @throws {CMFError} If customer is not found or API returns an error
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * await cmf.ensureAuthenticated();
   * const customer = await cmf.getCustomerByEmail('customer@example.com');
   * console.log(`Found: ${customer.fullName}`);
   * ```
   */
  async getCustomerByEmail(email: string): Promise<CMFCustomerResponse> {
    this.logger.debug('CMF getCustomerByEmail: Looking up customer...', sanitize({ email }) as Record<string, unknown>);

    return withRetry(async () => {
      try {
        const response = await this.http.get<CMFApiResponse<CMFCustomerResponse>>(
          `/Customers/GetCustomerInfoByEmail?email=${encodeURIComponent(email)}`,
        );
        const data = response.data;

        if (!data.complete || !data.jsonAnswer?.id) {
          throw CMFError.fromResponse(data);
        }

        this.logger.info('CMF getCustomerByEmail: Customer found', {
          customerId: data.jsonAnswer.id,
          fullName: data.jsonAnswer.fullName,
        });

        return data.jsonAnswer;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'getCustomerByEmail');
      }
    }, this.retryConfig);
  }

  /**
   * Looks up a customer by their registered phone number.
   *
   * Phone numbers should be in the format used when the customer registered with CMF.
   * For Panama numbers, omit the country code (e.g. '61234567' for a local number).
   *
   * @param phone - Customer's registered phone number
   * @returns Customer record including the internal `id` (customerId)
   * @throws {CMFError} If customer is not found or API returns an error
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * await cmf.ensureAuthenticated();
   * const customer = await cmf.getCustomerByPhone('61234567');
   * ```
   */
  async getCustomerByPhone(phone: string): Promise<CMFCustomerResponse> {
    this.logger.debug('CMF getCustomerByPhone: Looking up customer...', sanitize({ phone }) as Record<string, unknown>);

    return withRetry(async () => {
      try {
        const response = await this.http.get<CMFApiResponse<CMFCustomerResponse>>(
          `/Customers/GetCustomerInfoByPhone?phone=${encodeURIComponent(phone)}`,
        );
        const data = response.data;

        if (!data.complete || !data.jsonAnswer?.id) {
          throw CMFError.fromResponse(data);
        }

        this.logger.info('CMF getCustomerByPhone: Customer found', {
          customerId: data.jsonAnswer.id,
          fullName: data.jsonAnswer.fullName,
        });

        return data.jsonAnswer;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'getCustomerByPhone');
      }
    }, this.retryConfig);
  }

  // ── CUSTOMER PRODUCTS ───────────────────────────────────────────────────────

  /**
   * Retrieves the financing products (credit accounts) associated with a customer.
   *
   * Each product contains:
   * - `productAccount` (encrypted) -- used as `AccountNumber` in `processPurchaseInQuotas()`
   * - `customerAccountCards[]` -- each card has an encrypted `card` for `processNormalPurchase()`
   * - `customerProductId` -- used in `getQuotas()` to simulate financing plans
   *
   * @param customerId - The customer's internal CMF UUID (from any `getCustomerBy*` method)
   * @returns Array of products. Empty array if the customer has no active products.
   * @throws {CMFError} If the API returns an error
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * const products = await cmf.getCustomerProducts(customer.id);
   * if (products.length === 0) {
   *   throw new Error('Customer has no active CMF products');
   * }
   * const product = products[0];
   * console.log(`Product: ${product.productName} (${product.customerAccountCards.length} cards)`);
   * ```
   */
  async getCustomerProducts(customerId: string): Promise<CMFProduct[]> {
    this.logger.debug('CMF getCustomerProducts: Fetching products...', { customerId });

    return withRetry(async () => {
      try {
        const response = await this.http.get<CMFProduct[]>(
          `/Customers/GetProdAccountInfoByCustomerIdV2?customerId=${encodeURIComponent(customerId)}`,
        );

        const products = Array.isArray(response.data) ? response.data : [];

        this.logger.info('CMF getCustomerProducts: Products retrieved', {
          customerId,
          productCount: products.length,
        });

        return products;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'getCustomerProducts');
      }
    }, this.retryConfig);
  }

  // ── QUOTA SIMULATION ────────────────────────────────────────────────────────

  /**
   * Simulates financing quota plans for a given product and purchase amount.
   *
   * Returns multiple financing plans with different terms (6, 12, 18, 24 months, etc.).
   * Present all available plans to the customer and let them select one.
   * The selected plan's `uniqueCode` is used in `processPurchaseInQuotas()`.
   *
   * @param customerProductId - Product UUID from `CMFProduct.customerProductId`
   * @param amount - Purchase amount to finance (must be positive)
   * @returns Array of available financing plans, unsorted
   * @throws {CMFError} If simulation fails (e.g. amount too low, product inactive)
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * const quotas = await cmf.getQuotas(product.customerProductId, 500);
   * const sorted = quotas.sort((a, b) => a.loanTerm - b.loanTerm);
   * sorted.forEach(plan => {
   *   console.log(`${plan.loanTerm} months at $${plan.monthlyQuota.toFixed(2)}/month`);
   * });
   * const selectedPlan = sorted.find(q => q.loanTerm === 12);
   * ```
   */
  async getQuotas(customerProductId: string, amount: number): Promise<CMFQuota[]> {
    this.logger.debug('CMF getQuotas: Simulating financing plans...', {
      customerProductId,
      amount,
    });

    return withRetry(async () => {
      try {
        const response = await this.http.post<CMFApiResponse<CMFQuota[]>>(
          '/onboarding/Credit/SimulatorAmount',
          { customerProductId, amountoToEvaluate: amount },
        );
        const data = response.data;

        if (!data.complete) {
          throw CMFError.fromResponse(data);
        }

        const quotas = data.jsonAnswer ?? [];

        this.logger.info('CMF getQuotas: Plans retrieved', {
          customerProductId,
          amount,
          planCount: quotas.length,
        });

        return quotas;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'getQuotas');
      }
    }, this.retryConfig);
  }

  // ── PURCHASES ───────────────────────────────────────────────────────────────

  /**
   * Processes a purchase using CMF financing (installments/quotas).
   *
   * CMF automatically sends a confirmation email to the customer upon success.
   * After calling this, use `verifyTransaction()` to confirm the transaction was recorded.
   *
   * **Receipt Number**: Generate a unique receipt number per transaction.
   * Example: `` `ORDER-${Date.now()}${Math.floor(Math.random() * 1000)}` ``
   * Store this in your database to correlate with CMF records.
   *
   * @param params - Purchase parameters including encrypted account, plan code, and receipt number
   * @param options - Optional payment options (idempotency key)
   * @returns The API response. Always check `complete === true`.
   * @throws {CMFError} If the API returns an error (includes CMFErrorCode details in the message)
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * const receiptNumber = `ORDER-${Date.now()}`;
   * const result = await cmf.processPurchaseInQuotas({
   *   AccountNumber: product.productAccount,
   *   UniqueCode: selectedPlan.uniqueCode,
   *   Mto: 500,
   *   BranchOfficeCode: cmf.config.branchOfficeCode,
   *   CreatedBy: cmf.config.createdBy,
   *   CompanyCode: cmf.config.companyCode,
   *   ReceiptNumber: receiptNumber,
   *   Description: 'Purchase at My Store',
   *   UserName: customer.email,
   * });
   * ```
   */
  async processPurchaseInQuotas(
    params: CMFQuotaPurchaseRequest,
    options?: CMFPaymentOptions,
  ): Promise<CMFApiResponse> {
    this.logger.debug('CMF processPurchaseInQuotas: Processing installment purchase...', sanitize({
      ReceiptNumber: params.ReceiptNumber,
      Mto: params.Mto,
      UniqueCode: params.UniqueCode,
      UserName: params.UserName,
      idempotencyKey: options?.idempotencyKey,
    }) as Record<string, unknown>);

    return withRetry(async () => {
      try {
        const headers: Record<string, string> = {};
        if (options?.idempotencyKey) {
          headers['Idempotency-Key'] = options.idempotencyKey;
        }

        const response = await this.http.post<CMFApiResponse>(
          '/Versatec/VtcIngresarFinanciamientoCuentaWeb',
          params,
          { headers },
        );
        const data = response.data;

        if (!data.complete) {
          throw CMFError.fromResponse(data);
        }

        this.logger.info('CMF processPurchaseInQuotas: Purchase successful', {
          receiptNumber: params.ReceiptNumber,
          amount: params.Mto,
          uniqueCode: data.uniqueCode,
        });

        return data;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'processPurchaseInQuotas');
      }
    }, this.retryConfig);
  }

  /**
   * Processes a normal (non-installment) card purchase.
   *
   * Use this when the customer wants to pay the full amount at once using their
   * CMF card, without financing. CMF sends a confirmation email upon success.
   *
   * @param params - Purchase parameters including encrypted card number
   * @param options - Optional payment options (idempotency key)
   * @returns The API response. Always check `complete === true`.
   * @throws {CMFError} If the API returns an error
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * const card = product.customerAccountCards[0];
   * const result = await cmf.processNormalPurchase({
   *   BranchOfficeCode: cmf.config.branchOfficeCode,
   *   CreatedBy: cmf.config.createdBy,
   *   CompanyCode: cmf.config.companyCode,
   *   CardNumber: card.card,
   *   MtoTran: 150.00,
   *   ReceiptNumber: `ORDER-${Date.now()}`,
   *   Description: 'Purchase at My Store',
   *   UserName: customer.email,
   *   MovementType: 2,
   *   PaymentCashAmount: 0,
   *   WithdrawalFee: 0,
   * });
   * ```
   */
  async processNormalPurchase(
    params: CMFNormalPurchaseRequest,
    options?: CMFPaymentOptions,
  ): Promise<CMFApiResponse> {
    this.logger.debug('CMF processNormalPurchase: Processing normal purchase...', sanitize({
      ReceiptNumber: params.ReceiptNumber,
      MtoTran: params.MtoTran,
      UserName: params.UserName,
      idempotencyKey: options?.idempotencyKey,
    }) as Record<string, unknown>);

    return withRetry(async () => {
      try {
        const headers: Record<string, string> = {};
        if (options?.idempotencyKey) {
          headers['Idempotency-Key'] = options.idempotencyKey;
        }

        const response = await this.http.post<CMFApiResponse>(
          '/Versatec/VtcProcessTransacctionPagoWeb',
          params,
          { headers },
        );
        const data = response.data;

        if (!data.complete) {
          throw CMFError.fromResponse(data);
        }

        this.logger.info('CMF processNormalPurchase: Purchase successful', {
          receiptNumber: params.ReceiptNumber,
          amount: params.MtoTran,
          uniqueCode: data.uniqueCode,
        });

        return data;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'processNormalPurchase');
      }
    }, this.retryConfig);
  }

  // ── TRANSACTION VERIFICATION ────────────────────────────────────────────────

  /**
   * Verifies that a transaction was recorded correctly in the CMF system.
   *
   * Call this after `processPurchaseInQuotas()` or `processNormalPurchase()` to
   * confirm the transaction was stored with the correct amount and receipt number.
   * This is especially important before fulfilling an order.
   *
   * @param receiptNumber - The merchant-generated receipt number used in the purchase
   * @returns The transaction record from CMF
   * @throws {CMFError} If the transaction is not found or verification fails
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * const receiptNumber = `ORDER-${Date.now()}`;
   * await cmf.processPurchaseInQuotas({ ..., ReceiptNumber: receiptNumber });
   * const verification = await cmf.verifyTransaction(receiptNumber);
   * console.log('Transaction verified:', verification.complete);
   * ```
   */
  async verifyTransaction(receiptNumber: string): Promise<CMFApiResponse> {
    this.logger.debug('CMF verifyTransaction: Verifying transaction...', { receiptNumber });

    return withRetry(async () => {
      try {
        const response = await this.http.get<CMFApiResponse>(
          `/Versatec/GetTransacctionPagoWeb/${encodeURIComponent(receiptNumber)}`,
        );
        const data = response.data;

        if (!data.complete) {
          throw CMFError.fromResponse(data);
        }

        this.logger.info('CMF verifyTransaction: Transaction verified', {
          receiptNumber,
          complete: data.complete,
        });

        return data;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'verifyTransaction');
      }
    }, this.retryConfig);
  }

  // ── OTP ─────────────────────────────────────────────────────────────────────

  /**
   * Sends an OTP verification code to the customer's email.
   *
   * Only use email addresses registered in the CMF system.
   * After calling this, prompt the user to enter the code and call `verifyOtpByEmail()`.
   *
   * @param email - Customer's registered CMF email address
   * @throws {CMFError} If OTP send fails
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * await cmf.sendOtpByEmail(customer.email);
   * // Prompt user to enter the 6-digit code
   * const isValid = await cmf.verifyOtpByEmail(customer.email, userInput);
   * ```
   */
  async sendOtpByEmail(email: string): Promise<void> {
    this.logger.debug('CMF sendOtpByEmail: Sending OTP via email...', sanitize({ email }) as Record<string, unknown>);

    await withRetry(async () => {
      try {
        const response = await this.http.post<CMFApiResponse>(
          '/EmailServices/sendEmailverify',
          { to: email, username: '' },
        );

        if (!response.data.complete) {
          throw CMFError.fromResponse(response.data);
        }

        this.logger.info('CMF sendOtpByEmail: OTP sent successfully');
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'sendOtpByEmail');
      }
    }, this.retryConfig);
  }

  /**
   * Verifies an OTP code sent to the customer's email.
   *
   * **IMPORTANT**: Each OTP code can only be verified once. After successful
   * verification, the code is invalidated by CMF.
   *
   * @param email - Customer's email (same as used in `sendOtpByEmail()`)
   * @param code - The OTP code entered by the customer
   * @returns `true` if the code is valid
   * @throws {CMFError} If the code is invalid, expired, or already used
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * try {
   *   const isValid = await cmf.verifyOtpByEmail(customer.email, userInput);
   * } catch (err) {
   *   // Code invalid or expired -- ask user to request a new code
   * }
   * ```
   */
  async verifyOtpByEmail(email: string, code: string): Promise<boolean> {
    this.logger.debug('CMF verifyOtpByEmail: Verifying OTP code...', sanitize({ email }) as Record<string, unknown>);

    return withRetry(async () => {
      try {
        const response = await this.http.post<CMFApiResponse>(
          '/EmailServices/confirmEmailVerify',
          { to: email, code },
        );

        if (!response.data.complete) {
          throw CMFError.fromResponse(response.data);
        }

        this.logger.info('CMF verifyOtpByEmail: OTP verified successfully');
        return true;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'verifyOtpByEmail');
      }
    }, this.retryConfig);
  }

  /**
   * Sends an OTP verification code to the customer's phone via WhatsApp.
   *
   * The message is sent by CM Financiera / Banco General via WhatsApp.
   * Phone numbers should include the country code (e.g. '+50761234567' for Panama).
   *
   * **WARNING**: Multiple failed verification attempts will block the phone number
   * in the OTP provider. Implement rate limiting and a maximum attempts limit.
   *
   * @param phone - Customer phone number with country code (e.g. '+50761234567')
   * @throws {CMFError} If OTP send fails
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * await cmf.sendOtpByPhone('+50761234567');
   * const isValid = await cmf.verifyOtpByPhone('+50761234567', userInput);
   * ```
   */
  async sendOtpByPhone(phone: string): Promise<void> {
    this.logger.debug('CMF sendOtpByPhone: Sending OTP via WhatsApp...', sanitize({ phone }) as Record<string, unknown>);

    await withRetry(async () => {
      try {
        const response = await this.http.post<CMFApiResponse>(
          '/EmailServices/sendverify',
          { To: phone },
        );

        if (!response.data.complete) {
          throw CMFError.fromResponse(response.data);
        }

        this.logger.info('CMF sendOtpByPhone: OTP sent successfully via WhatsApp');
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'sendOtpByPhone');
      }
    }, this.retryConfig);
  }

  /**
   * Verifies an OTP code sent to the customer's phone.
   *
   * **WARNING**: Multiple failed attempts will block the phone number in the
   * OTP provider. Implement a maximum of 3 attempts before resetting the flow.
   *
   * @param phone - Customer phone number with country code (same as used in `sendOtpByPhone()`)
   * @param code - The OTP code entered by the customer
   * @returns `true` if the code is valid
   * @throws {CMFError} If the code is invalid or the phone number is blocked
   * @throws {TimeoutError} If the request times out
   * @throws {NetworkError} If there is a network connectivity issue
   *
   * @example
   * ```ts
   * let attempts = 0;
   * const MAX_ATTEMPTS = 3;
   * try {
   *   attempts++;
   *   const isValid = await cmf.verifyOtpByPhone('+50761234567', userInput);
   * } catch (err) {
   *   if (attempts >= MAX_ATTEMPTS) {
   *     // Reset flow -- do not retry verifyOtpByPhone for this session
   *   }
   * }
   * ```
   */
  async verifyOtpByPhone(phone: string, code: string): Promise<boolean> {
    this.logger.debug('CMF verifyOtpByPhone: Verifying OTP code...', sanitize({ phone }) as Record<string, unknown>);

    return withRetry(async () => {
      try {
        const response = await this.http.post<CMFApiResponse>(
          '/EmailServices/confirmVerify',
          { to: phone, code },
        );

        if (!response.data.complete) {
          throw CMFError.fromResponse(response.data);
        }

        this.logger.info('CMF verifyOtpByPhone: OTP verified successfully');
        return true;
      } catch (error) {
        if (error instanceof CMFError) throw error;
        this.wrapAxiosError(error, 'verifyOtpByPhone');
      }
    }, this.retryConfig);
  }
}
