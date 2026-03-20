/**
 * @module @panama-payments/cmf/server
 *
 * Server-side entry point for the CMF SDK.
 *
 * Provides the `CMFClient` for server-side API interaction, all types,
 * enums, and error classes needed to integrate CMF financing into your backend.
 *
 * **IMPORTANT**: Only import from `@panama-payments/cmf/server` in Node.js code.
 * Never use this in browser/client code -- merchant credentials must stay server-side.
 *
 * @example
 * ```ts
 * import {
 *   CMFClient,
 *   CMFDocumentType,
 *   CMFError,
 * } from '@panama-payments/cmf/server';
 *
 * const cmf = new CMFClient({
 *   baseUrl: process.env.CMF_URL!,
 *   email: process.env.CMF_EMAIL!,
 *   password: process.env.CMF_PASSWORD!,
 *   branchOfficeCode: 'MKP',
 *   companyCode: 'MKP',
 *   createdBy: 'system',
 * });
 *
 * await cmf.ensureAuthenticated();
 * const customer = await cmf.getCustomerByDocument(CMFDocumentType.Cedula, '8-123-456');
 * ```
 */

export { CMFClient } from './CMFClient.js';
export type { CMFPaymentOptions } from './CMFClient.js';

export { CMFError } from '../errors.js';

export {
  CMFDocumentType,
  CMFOtpChannel,
  CMFErrorCode,
} from '../types.js';

export type {
  CMFClientConfig,
  CMFLoginResponse,
  CMFCustomerResponse,
  CMFProduct,
  CMFAccountCard,
  CMFQuota,
  CMFQuotaPurchaseRequest,
  CMFNormalPurchaseRequest,
  CMFApiResponse,
  CMFStatusResult,
} from '../types.js';
