/**
 * @module @panama-payments/yappy/server
 * @description Server-side exports for the Yappy payment SDK.
 *
 * Import from this subpath in Node.js / server-side code:
 * ```typescript
 * import { YappyClient, validateYappyHash, generateOrderId } from '@panama-payments/yappy/server';
 * ```
 *
 * This module does NOT export React hooks or browser-side components.
 * For client-side code, use `@panama-payments/yappy/react` or `@panama-payments/yappy/vanilla`.
 */

// Client
export { YappyClient, generateOrderId } from './YappyClient.js';

// Webhook utilities
export {
  validateYappyHash,
  parseYappyWebhook,
  generateTestWebhook,
} from './webhook.js';

// Error class
export { YappyError } from '../errors.js';

// Types & enums (re-exported for convenience)
export {
  YappyStatus,
  YappyButtonTheme,
  YappyErrorCode,
  YAPPY_ERROR_MESSAGES,
} from '../types.js';

export type {
  YappyClientConfig,
  ValidateMerchantRequest,
  ValidateMerchantResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  YappyCheckoutResult,
  YappyWebhookPayload,
  YappyWebhookResult,
  YappyButtonConfig,
  YappyPaymentParams,
} from '../types.js';
