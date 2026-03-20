/**
 * @module @panama-payments/cmf/react
 *
 * React entry point for the CMF SDK.
 *
 * Provides hooks and components for building CMF payment UIs.
 * All hooks call your backend API -- they never contact CMF directly.
 *
 * @example
 * ```tsx
 * import {
 *   useCMFCustomer,
 *   useCMFOtp,
 *   useCMFQuotas,
 *   useCMFPayment,
 *   CMFPaymentForm,
 *   CMFDocumentType,
 *   CMFOtpChannel,
 * } from '@panama-payments/cmf/react';
 * ```
 */

// ── Hooks ───────────────────────────────────────────────────────────────────

export { useCMFCustomer } from './hooks/useCMFCustomer.js';
export { useCMFQuotas } from './hooks/useCMFQuotas.js';
export { useCMFOtp } from './hooks/useCMFOtp.js';
export { useCMFPayment } from './hooks/useCMFPayment.js';

// ── Components ──────────────────────────────────────────────────────────────

export { CMFPaymentForm } from './components/CMFPaymentForm.js';

// ── Hook types ──────────────────────────────────────────────────────────────

export type { UseCMFCustomerConfig, UseCMFCustomerReturn } from './hooks/useCMFCustomer.js';
export type { UseCMFQuotasConfig, UseCMFQuotasReturn } from './hooks/useCMFQuotas.js';
export type {
  UseCMFOtpConfig,
  UseCMFOtpReturn,
  CMFOtpStep,
} from './hooks/useCMFOtp.js';
export type {
  UseCMFPaymentConfig,
  UseCMFPaymentReturn,
  CMFPaymentParams,
  CMFPaymentMode,
  CMFQuotaPaymentParams,
  CMFNormalPaymentParams,
} from './hooks/useCMFPayment.js';

// ── Component types ─────────────────────────────────────────────────────────

export type { CMFPaymentFormProps } from './components/CMFPaymentForm.js';

// ── Shared types (re-exported for convenience) ──────────────────────────────

export type {
  CMFLoginResponse,
  CMFCustomerResponse,
  CMFProduct,
  CMFAccountCard,
  CMFQuota,
  CMFApiResponse,
  CMFStatusResult,
} from '../types.js';
export { CMFDocumentType, CMFOtpChannel, CMFErrorCode } from '../types.js';
