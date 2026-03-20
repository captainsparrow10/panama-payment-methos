/**
 * @module errors
 *
 * CMF-specific error class that extends the base `PaymentError` from core.
 *
 * All CMF API errors (business logic failures where `complete === false`)
 * are wrapped in `CMFError` with the original `status_result` attached.
 *
 * @example
 * ```ts
 * import { CMFError } from '@devhubpty/cmf/server';
 *
 * try {
 *   await cmf.processPurchaseInQuotas(params);
 * } catch (error) {
 *   if (error instanceof CMFError) {
 *     console.log(error.statusResult?.code);      // e.g., 2006
 *     console.log(error.statusResult?.errorType);  // e.g., 'Vtc_ErrorProcessTransacction'
 *     console.log(error.statusResult?.message);    // Human-readable message
 *   }
 * }
 * ```
 */

import { PaymentError } from '@devhubpty/core';
import type { CMFStatusResult } from './types.js';

/**
 * Error thrown when the CMF API returns a business-logic failure (`complete === false`).
 *
 * Unlike network or timeout errors, CMF business errors are **not retryable**
 * because the CMF server explicitly rejected the request (e.g., insufficient funds,
 * inactive card, invalid amount).
 *
 * Use `statusResult` to inspect the structured error details from CMF.
 *
 * @example
 * ```ts
 * try {
 *   await cmf.processNormalPurchase(params);
 * } catch (error) {
 *   if (error instanceof CMFError) {
 *     console.error(`CMF error [${error.code}]: ${error.message}`);
 *     console.error('Status result:', error.statusResult);
 *   }
 * }
 * ```
 */
export class CMFError extends PaymentError {
  override readonly name = 'CMFError';

  constructor(
    message: string,
    /** The structured status result from the CMF API response */
    public readonly statusResult: CMFStatusResult | null,
    code?: string,
    retryable = false,
  ) {
    super(message, code ?? 'CMF_ERROR', retryable, undefined, statusResult?.code?.toString());
  }

  /**
   * Creates a `CMFError` from a CMF API response where `complete === false`.
   *
   * Extracts the error message and code from `status_result` and wraps them
   * in a typed error object for consistent error handling.
   *
   * @param data - The CMF API response data
   * @returns A new `CMFError` instance
   *
   * @example
   * ```ts
   * if (!response.complete) {
   *   throw CMFError.fromResponse(response);
   * }
   * ```
   */
  static fromResponse(data: { complete: boolean; status_result: CMFStatusResult | null; problemPublic?: string | null }): CMFError {
    const message = data.status_result?.message ?? data.problemPublic ?? 'CMF API error';
    const code = `CMF_${data.status_result?.code ?? 'UNKNOWN'}`;
    return new CMFError(message, data.status_result, code, false);
  }
}
