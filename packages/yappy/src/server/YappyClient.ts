/**
 * @module @panama-payments/yappy/server
 * @description Server-side Yappy API client for Node.js environments.
 *
 * IMPORTANT: This module is for server-side use ONLY. Never import or call it
 * from browser code -- it uses your secret credentials (YAPPY_MERCHANT_ID, etc.)
 * that must never be exposed to the client.
 */

import axios, { AxiosInstance } from 'axios';
import type { PaymentLogger } from '@panama-payments/core';
import { noopLogger, sanitize, withRetry } from '@panama-payments/core';
import type { RetryConfig } from '@panama-payments/core';
import {
  YappyClientConfig,
  ValidateMerchantRequest,
  ValidateMerchantResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  YappyCheckoutResult,
  YappyErrorCode,
} from '../types.js';
import { YappyError } from '../errors.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Yappy API base URLs per environment.
 *
 * @example
 * ```ts
 * const url = API_URLS['production']; // 'https://apipagosbg.bgeneral.cloud'
 * ```
 */
const API_URLS = {
  production: 'https://apipagosbg.bgeneral.cloud',
  sandbox: 'https://api-comecom-uat.yappycloud.com',
} as const;

/**
 * CDN URLs for the `<btn-yappy>` web component per environment.
 *
 * @example
 * ```ts
 * const cdnUrl = CDN_URLS['sandbox'];
 * // 'https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js'
 * ```
 */
const CDN_URLS = {
  production: 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js',
  sandbox: 'https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js',
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generates a random alphanumeric orderId of exactly 15 characters.
 *
 * Yappy requires orderIds to be:
 * - Exactly 15 alphanumeric characters (error E009 if longer)
 * - Unique per transaction (error E007 if reused)
 *
 * @returns A random 15-character uppercase alphanumeric string.
 *
 * @example
 * ```ts
 * import { generateOrderId } from '@panama-payments/yappy/server';
 *
 * const orderId = generateOrderId(); // e.g. "A3KX9MZQ1BPRY7W"
 * ```
 */
export function generateOrderId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length: 15 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

// ============================================================================
// YappyClient
// ============================================================================

/**
 * Server-side client for the Yappy (Banco General) payment API.
 *
 * Handles the two-step authentication + order creation flow required by Yappy:
 * 1. `validateMerchant()` -- exchanges credentials for a short-lived token
 * 2. `createOrder()` -- creates a payment order using the token
 * 3. `initCheckout()` -- orchestrates both steps in a single call (recommended)
 *
 * Integrates with `@panama-payments/core` for:
 * - Structured logging with PCI-safe sanitization
 * - Automatic retry with exponential backoff
 * - Typed error hierarchy via `YappyError`
 *
 * @example
 * ```ts
 * import { YappyClient } from '@panama-payments/yappy/server';
 * import { createConsoleLogger } from '@panama-payments/core';
 *
 * const yappy = new YappyClient({
 *   merchantId: process.env.YAPPY_MERCHANT_ID!,
 *   urlDomain: process.env.YAPPY_URL_DOMAIN!,
 *   environment: 'sandbox',
 *   logger: createConsoleLogger({ level: 'debug', prefix: '[yappy]' }),
 *   retry: { maxAttempts: 2 },
 * });
 *
 * // In your checkout endpoint:
 * const result = await yappy.initCheckout({
 *   ipnUrl: 'https://api.mystore.com/webhooks/yappy',
 *   total: '25.00',
 *   subtotal: '25.00',
 *   discount: '0.00',
 *   taxes: '0.00',
 *   aliasYappy: '60800011',
 * });
 * ```
 */
export class YappyClient {
  private readonly config: Required<YappyClientConfig>;
  private readonly http: AxiosInstance;
  private readonly logger: PaymentLogger;
  private readonly retryConfig: Partial<RetryConfig>;

  /** The CDN URL for the `<btn-yappy>` web component script. Use this to load the CDN. */
  public readonly cdnUrl: string;
  /** The base API URL for this environment. */
  public readonly apiUrl: string;

  /**
   * Creates a new YappyClient instance.
   *
   * @param config - Yappy merchant configuration.
   * @param options - Optional logger and retry configuration.
   *
   * @example
   * ```ts
   * import { YappyClient } from '@panama-payments/yappy/server';
   * import pino from 'pino';
   *
   * const yappy = new YappyClient(
   *   {
   *     merchantId: process.env.YAPPY_MERCHANT_ID!,
   *     urlDomain: process.env.YAPPY_URL_DOMAIN!,
   *     environment: 'production',
   *   },
   *   {
   *     logger: pino(),
   *     retry: { maxAttempts: 2, baseDelayMs: 500 },
   *   },
   * );
   * ```
   */
  constructor(
    config: YappyClientConfig,
    options?: {
      /** Optional structured logger. Falls back to a silent noop logger. */
      logger?: PaymentLogger;
      /** Override default retry behavior for API calls. */
      retry?: Partial<RetryConfig>;
    },
  ) {
    this.config = {
      environment: 'production',
      ...config,
    };

    this.logger = options?.logger ?? noopLogger;
    this.retryConfig = options?.retry ?? {};

    this.apiUrl = API_URLS[this.config.environment];
    this.cdnUrl = CDN_URLS[this.config.environment];

    this.http = axios.create({
      baseURL: this.apiUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    this.logger.info('YappyClient initialized', sanitize({
      environment: this.config.environment,
      apiUrl: this.apiUrl,
      merchantId: this.config.merchantId,
    }));
  }

  /**
   * Step 1: Validates your merchant credentials with Yappy and obtains a short-lived token.
   *
   * The token expires quickly -- always call this immediately before `createOrder()`.
   * Do NOT cache or reuse tokens across requests.
   *
   * This method is wrapped with `withRetry()` for automatic retry on transient failures.
   *
   * @returns The short-lived authorization token needed for `createOrder()`.
   * @throws {YappyError} If the merchant validation fails (invalid credentials, network error, etc.)
   *
   * @example
   * ```ts
   * const token = await yappy.validateMerchant();
   * // token is a short-lived string, use it immediately
   * ```
   */
  async validateMerchant(): Promise<string> {
    const body: ValidateMerchantRequest = {
      merchantId: this.config.merchantId,
      urlDomain: this.config.urlDomain,
    };

    this.logger.debug('validateMerchant: sending request', sanitize({ ...body }));

    return withRetry(
      async () => {
        try {
          const response = await this.http.post<ValidateMerchantResponse>(
            '/payments/validate/merchant',
            body,
          );

          const token = response.data.body?.token;
          if (!token) {
            throw new YappyError(
              `validateMerchant: missing token in response. status=${response.data.status?.code} description=${response.data.status?.description}`,
              response.data.status?.code as YappyErrorCode | undefined,
              false,
            );
          }

          this.logger.info('validateMerchant: success', {
            statusCode: response.data.status?.code,
          });

          return token;
        } catch (error: unknown) {
          if (error instanceof YappyError) throw error;

          if (axios.isAxiosError(error) && error.response) {
            const apiError = error.response.data as Partial<ValidateMerchantResponse>;
            const errorCode = apiError?.status?.code as YappyErrorCode | undefined;
            const message = `validateMerchant failed: ${apiError?.status?.description ?? error.message}`;

            this.logger.error('validateMerchant: API error', sanitize({
              statusCode: errorCode,
              description: apiError?.status?.description,
              httpStatus: error.response.status,
            }));

            throw new YappyError(message, errorCode, false);
          }

          if (axios.isAxiosError(error) && !error.response) {
            this.logger.error('validateMerchant: network error', {
              message: error.message,
              code: error.code,
            });
            throw new YappyError(
              `validateMerchant: network error - ${error.message}`,
              undefined,
              true,
            );
          }

          throw error;
        }
      },
      {
        ...this.retryConfig,
        onRetry: (err, attempt, delay) => {
          this.logger.warn('validateMerchant: retrying', {
            attempt,
            delayMs: delay,
            error: err.message,
          });
          this.retryConfig.onRetry?.(err, attempt, delay);
        },
      },
    );
  }

  /**
   * Step 2: Creates a payment order in Yappy.
   *
   * Must be called immediately after `validateMerchant()` using the fresh token.
   * The returned `{ transactionId, token, documentName }` must be passed to the
   * `<btn-yappy>` web component via `btnyappy.eventPayment(params)`.
   *
   * This method is wrapped with `withRetry()` for automatic retry on transient failures.
   *
   * @param params - Order details including amounts, orderId, and ipnUrl.
   * @param authToken - The token obtained from `validateMerchant()`.
   * @returns Checkout params for the `<btn-yappy>` web component.
   * @throws {YappyError} If order creation fails (duplicate orderId, invalid amounts, etc.)
   *
   * @example
   * ```ts
   * const token = await yappy.validateMerchant();
   * const result = await yappy.createOrder({
   *   orderId: 'ABC123XYZ789012',
   *   ipnUrl: 'https://api.mystore.com/webhooks/yappy',
   *   total: '25.00',
   *   subtotal: '25.00',
   *   discount: '0.00',
   *   taxes: '0.00',
   * }, token);
   * ```
   */
  async createOrder(
    params: Omit<CreateOrderRequest, 'merchantId' | 'domain' | 'paymentDate'> & {
      paymentDate?: number;
    },
    authToken: string,
  ): Promise<YappyCheckoutResult> {
    const body: CreateOrderRequest = {
      merchantId: this.config.merchantId,
      domain: this.config.urlDomain,
      paymentDate: params.paymentDate ?? Math.floor(Date.now() / 1000),
      orderId: params.orderId,
      ipnUrl: params.ipnUrl,
      discount: params.discount,
      taxes: params.taxes,
      subtotal: params.subtotal,
      total: params.total,
      ...(params.aliasYappy ? { aliasYappy: params.aliasYappy } : {}),
    };

    this.logger.debug('createOrder: sending request', sanitize({
      orderId: body.orderId,
      total: body.total,
      subtotal: body.subtotal,
      ipnUrl: body.ipnUrl,
      aliasYappy: body.aliasYappy,
    }));

    return withRetry(
      async () => {
        try {
          const response = await this.http.post<CreateOrderResponse>(
            '/payments/payment-wc',
            body,
            { headers: { Authorization: authToken } },
          );

          const { transactionId, token, documentName } = response.data.body ?? {};

          if (!transactionId || !token || !documentName) {
            throw new YappyError(
              `createOrder: incomplete response body. status=${response.data.status?.code} description=${response.data.status?.description}`,
              response.data.status?.code as YappyErrorCode | undefined,
              false,
            );
          }

          this.logger.info('createOrder: success', sanitize({
            orderId: body.orderId,
            transactionId,
          }));

          return { transactionId, token, documentName };
        } catch (error: unknown) {
          if (error instanceof YappyError) throw error;

          if (axios.isAxiosError(error) && error.response) {
            const apiError = error.response.data as Partial<CreateOrderResponse>;
            const errorCode = apiError?.status?.code as YappyErrorCode | undefined;
            const message = `createOrder failed [${apiError?.status?.code}]: ${apiError?.status?.description ?? error.message}`;

            this.logger.error('createOrder: API error', sanitize({
              orderId: body.orderId,
              statusCode: errorCode,
              description: apiError?.status?.description,
              httpStatus: error.response.status,
            }));

            throw new YappyError(message, errorCode, false);
          }

          if (axios.isAxiosError(error) && !error.response) {
            this.logger.error('createOrder: network error', {
              orderId: body.orderId,
              message: error.message,
              code: error.code,
            });
            throw new YappyError(
              `createOrder: network error - ${error.message}`,
              undefined,
              true,
            );
          }

          throw error;
        }
      },
      {
        ...this.retryConfig,
        onRetry: (err, attempt, delay) => {
          this.logger.warn('createOrder: retrying', {
            attempt,
            delayMs: delay,
            orderId: body.orderId,
            error: err.message,
          });
          this.retryConfig.onRetry?.(err, attempt, delay);
        },
      },
    );
  }

  /**
   * Orchestrates the full checkout flow: validateMerchant + createOrder in one call.
   *
   * This is the recommended method for your checkout endpoint. It handles the
   * two-step Yappy authentication internally so you don't have to manage tokens.
   *
   * The orderId is auto-generated if not provided.
   *
   * @param params - Order details. `orderId` is optional -- a random one is generated if omitted.
   * @returns `{ transactionId, token, documentName }` to pass to the web component,
   *          plus the `orderId` used (important: persist this to match against your webhook).
   *
   * @example
   * ```ts
   * // Express checkout endpoint:
   * app.post('/api/checkout/yappy', async (req, res) => {
   *   const { total, subtotal, aliasYappy } = req.body;
   *
   *   const result = await yappy.initCheckout({
   *     ipnUrl: `${process.env.BASE_URL}/webhooks/yappy`,
   *     total,
   *     subtotal,
   *     discount: '0.00',
   *     taxes: '0.00',
   *     aliasYappy,
   *   });
   *
   *   // IMPORTANT: Save result.orderId to your DB before responding.
   *   await db.savePendingOrder({ orderId: result.orderId, ...result });
   *
   *   res.json(result);
   * });
   * ```
   */
  async initCheckout(
    params: Omit<CreateOrderRequest, 'merchantId' | 'domain' | 'paymentDate' | 'orderId'> & {
      orderId?: string;
      paymentDate?: number;
    },
  ): Promise<YappyCheckoutResult & { orderId: string }> {
    const orderId = params.orderId ?? generateOrderId();

    this.logger.info('initCheckout: starting', sanitize({
      orderId,
      total: params.total,
      aliasYappy: params.aliasYappy,
    }));

    // Step 1: Get auth token
    const authToken = await this.validateMerchant();

    // Step 2: Create order using the fresh token
    const result = await this.createOrder(
      { ...params, orderId },
      authToken,
    );

    this.logger.info('initCheckout: complete', sanitize({
      orderId,
      transactionId: result.transactionId,
    }));

    return { ...result, orderId };
  }

  /**
   * Pings the Yappy API to verify connectivity and credentials.
   *
   * Calls `validateMerchant()` and returns `true` if a valid token is received.
   * Useful for health checks and startup verification.
   *
   * @returns `true` if the API is reachable and credentials are valid, `false` otherwise.
   *
   * @example
   * ```ts
   * const isHealthy = await yappy.ping();
   * if (!isHealthy) {
   *   console.error('Yappy API is unreachable or credentials are invalid');
   * }
   * ```
   */
  async ping(): Promise<boolean> {
    this.logger.debug('ping: checking connectivity');

    try {
      await this.validateMerchant();
      this.logger.info('ping: success');
      return true;
    } catch (error: unknown) {
      this.logger.warn('ping: failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
