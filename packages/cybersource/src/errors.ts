/**
 * CyberSource-specific error class.
 *
 * Extends `PaymentError` from `@panama-payments/core` to carry CyberSource
 * processor codes and error details from the API response body.
 *
 * @example
 * ```ts
 * import { CyberSourceError } from '@panama-payments/cybersource/server';
 *
 * try {
 *   await client.processPayment(data);
 * } catch (error) {
 *   if (error instanceof CyberSourceError) {
 *     console.log(error.processorCode); // e.g., 'PROCESSOR_DECLINED'
 *     console.log(error.code);          // e.g., 'DECLINED'
 *     console.log(error.retryable);     // false
 *   }
 * }
 * ```
 */
import { PaymentError } from '@panama-payments/core';

export class CyberSourceError extends PaymentError {
  override readonly name = 'CyberSourceError';

  /**
   * Create a new CyberSource error.
   *
   * @param message - Human-readable error description
   * @param processorCode - CyberSource processor-specific reason code (e.g., 'PROCESSOR_DECLINED')
   * @param code - Machine-readable error code (defaults to 'CYBERSOURCE_ERROR')
   * @param retryable - Whether this error is safe to retry (default: false)
   * @param httpStatus - HTTP status code from the API response
   * @param details - Detailed error information from the API response
   *
   * @example
   * ```ts
   * throw new CyberSourceError(
   *   'Card was declined',
   *   'PROCESSOR_DECLINED',
   *   'DECLINED',
   *   false,
   *   402,
   * );
   * ```
   */
  constructor(
    message: string,
    public readonly processorCode?: string,
    code?: string,
    retryable = false,
    httpStatus?: number,
    details?: Array<{ field?: string; reason?: string; message?: string }>,
  ) {
    super(
      message,
      code ?? 'CYBERSOURCE_ERROR',
      retryable,
      httpStatus,
      processorCode,
      details,
    );
  }

  /**
   * Create a `CyberSourceError` from a CyberSource API response object.
   *
   * Extracts error information from the standard CyberSource error response
   * shape, making it easy to convert raw API errors into typed SDK errors.
   *
   * @param response - The CyberSource API response containing error info
   * @returns A typed CyberSourceError
   *
   * @example
   * ```ts
   * const apiResponse = {
   *   status: 'DECLINED',
   *   errorInformation: {
   *     reason: 'PROCESSOR_DECLINED',
   *     message: 'Declined - General decline of the card.',
   *     details: [{ field: 'cardNumber', reason: 'INVALID' }],
   *   },
   * };
   *
   * throw CyberSourceError.fromResponse(apiResponse);
   * ```
   */
  static fromResponse(response: {
    status?: string;
    errorInformation?: {
      reason?: string;
      message?: string;
      details?: Array<{ field?: string; reason?: string; message?: string }>;
    };
  }): CyberSourceError {
    const err = response.errorInformation;
    return new CyberSourceError(
      err?.message ?? 'CyberSource API error',
      err?.reason,
      response.status ?? 'UNKNOWN',
      false,
      undefined,
      err?.details,
    );
  }
}
