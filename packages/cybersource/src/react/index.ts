/**
 * @module @devhubpty/cybersource/react
 *
 * React hooks and components for CyberSource 3DS payment integration.
 *
 * All hooks are headless (no JSX) -- they manage state and API calls only.
 * The `ThreeDSModal` is the only component, and it is unstyled by design.
 *
 * @example
 * ```tsx
 * import {
 *   useThreeDS,
 *   useSetupService,
 *   useCheckEnrollment,
 *   useValidateAuth,
 *   usePayment,
 *   usePaymentMethods,
 *   ThreeDSModal,
 * } from '@devhubpty/cybersource/react';
 * ```
 */

// Orchestrator hook
export { useThreeDS } from './hooks/useThreeDS.js';
export type {
  UseThreeDSOptions,
  UseThreeDSReturn,
  StartAuthInput,
} from './hooks/useThreeDS.js';

// Individual step hooks
export { useSetupService } from './hooks/useSetupService.js';
export type {
  UseSetupServiceOptions,
  UseSetupServiceReturn,
  SetupServicePayload,
} from './hooks/useSetupService.js';

export { useCheckEnrollment } from './hooks/useCheckEnrollment.js';
export type {
  UseCheckEnrollmentOptions,
  UseCheckEnrollmentReturn,
  CheckEnrollmentPayload,
} from './hooks/useCheckEnrollment.js';

export { useValidateAuth } from './hooks/useValidateAuth.js';
export type {
  UseValidateAuthOptions,
  UseValidateAuthReturn,
  ValidateAuthPayload,
} from './hooks/useValidateAuth.js';

export { usePayment } from './hooks/usePayment.js';
export type {
  UsePaymentOptions,
  UsePaymentReturn,
  PaymentPayload,
} from './hooks/usePayment.js';

export { usePaymentMethods } from './hooks/usePaymentMethods.js';
export type {
  UsePaymentMethodsOptions,
  UsePaymentMethodsReturn,
  AddCardPayload,
  AddCardResult,
} from './hooks/usePaymentMethods.js';

// Components
export { ThreeDSModal } from './components/ThreeDSModal.js';
export type {
  ThreeDSModalProps,
  ThreeDSChallengeResult,
} from './components/ThreeDSModal.js';

// Re-export types and enums used by React consumers
export {
  ThreeDSStep,
  ThreeDSStatus,
  PaymentStatus,
  EnrollmentResult,
  CardType,
} from '../types.js';

export type {
  SetupAuthResponse,
  EnrollmentResponse,
  ValidateAuthResponse,
  PaymentResponse,
  ConsumerAuthenticationInformation,
  Auth3DSResult,
  ErrorInformation,
  BillingAddress,
} from '../types.js';
