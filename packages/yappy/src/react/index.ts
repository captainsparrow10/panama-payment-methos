/**
 * @module @devhubpty/yappy/react
 * @description React hooks and components for Yappy payment integration.
 *
 * Import from this subpath in React / Next.js client code:
 * ```typescript
 * import { useYappyWebComponent, YappyButton } from '@devhubpty/yappy/react';
 * ```
 *
 * This module does NOT export server-side utilities (YappyClient, webhook validators).
 * For server-side code, use `@devhubpty/yappy/server`.
 */

// Hooks
export { useYappyWebComponent } from './hooks/useYappyWebComponent.js';
export { useYappyCheckout } from './hooks/useYappyCheckout.js';
export { useYappyOrderStatus } from './hooks/useYappyOrderStatus.js';
export { useYappyPendingCheck } from './hooks/useYappyPendingCheck.js';

// Components (optional UI)
export { YappyButton } from './components/YappyButton.js';
export { YappyPhoneInput, validateYappyPhone } from './components/YappyPhoneInput.js';
export { YappyPendingModal } from './components/YappyPendingModal.js';

// Hook config types
export type { UseYappyWebComponentConfig, UseYappyWebComponentReturn } from './hooks/useYappyWebComponent.js';
export type { UseYappyCheckoutConfig, UseYappyCheckoutReturn } from './hooks/useYappyCheckout.js';
export type { UseYappyOrderStatusConfig, UseYappyOrderStatusReturn, YappyOrderStatusData } from './hooks/useYappyOrderStatus.js';
export type {
  UseYappyPendingCheckConfig,
  UseYappyPendingCheckReturn,
  YappyPendingStatus,
  YappyPendingOrderData,
} from './hooks/useYappyPendingCheck.js';

// Component prop types
export type { YappyButtonProps } from './components/YappyButton.js';
export type { YappyPhoneInputProps } from './components/YappyPhoneInput.js';
export type { YappyPendingModalProps } from './components/YappyPendingModal.js';

// Re-export shared types for convenience
export { YappyButtonTheme, YappyStatus, YappyErrorCode, YAPPY_ERROR_MESSAGES } from '../types.js';
export type { YappyButtonConfig, YappyPaymentParams } from '../types.js';
