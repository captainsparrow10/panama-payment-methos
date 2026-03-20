/**
 * @module @panama-payments/yappy/errors
 * @description Yappy-specific error class that extends the shared PaymentError.
 *
 * All errors thrown by the YappyClient are instances of `YappyError`, which in turn
 * extends `PaymentError` from `@panama-payments/core`. This allows you to catch
 * Yappy-specific errors while still supporting a generic `PaymentError` catch-all.
 *
 * @example
 * ```ts
 * import { YappyError } from '@panama-payments/yappy/server';
 * import { PaymentError } from '@panama-payments/core';
 *
 * try {
 *   await yappy.initCheckout({ ... });
 * } catch (error) {
 *   if (error instanceof YappyError) {
 *     console.log(error.yappyErrorCode); // e.g., 'E007'
 *   } else if (error instanceof PaymentError) {
 *     console.log(error.code); // generic payment error
 *   }
 * }
 * ```
 */

import { PaymentError } from '@panama-payments/core';
import type { YappyErrorCode } from './types.js';

/**
 * Error class for all Yappy API errors.
 *
 * Extends `PaymentError` from `@panama-payments/core` and adds the Yappy-specific
 * error code for more granular error handling.
 *
 * @example
 * ```ts
 * import { YappyError } from '@panama-payments/yappy/server';
 * import { YappyErrorCode, YAPPY_ERROR_MESSAGES } from '@panama-payments/yappy/server';
 *
 * try {
 *   await yappy.validateMerchant();
 * } catch (error) {
 *   if (error instanceof YappyError) {
 *     const userMessage = error.yappyErrorCode
 *       ? YAPPY_ERROR_MESSAGES[error.yappyErrorCode]
 *       : error.message;
 *     showToast(userMessage);
 *   }
 * }
 * ```
 */
export class YappyError extends PaymentError {
  readonly name = 'YappyError';

  constructor(
    message: string,
    /** The Yappy-specific error code (e.g., E002, E007). Undefined for network/parsing errors. */
    public readonly yappyErrorCode?: YappyErrorCode,
    /** Whether this error is safe to retry. Defaults to false. */
    retryable = false,
  ) {
    super(message, yappyErrorCode ?? 'YAPPY_ERROR', retryable, undefined, yappyErrorCode);
  }
}
