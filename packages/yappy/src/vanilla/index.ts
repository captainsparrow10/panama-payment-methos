/**
 * @module @panama-payments/yappy/vanilla
 * @description Vanilla JS entry point for the Yappy SDK.
 *
 * Import from this subpath in non-React projects:
 * ```typescript
 * import { initYappyButton } from '@panama-payments/yappy/vanilla';
 * ```
 */

export { initYappyButton } from './initYappyButton.js';
export type { InitYappyButtonOptions } from './initYappyButton.js';

// Re-export shared types for convenience
export { YappyButtonTheme, YappyStatus, YappyErrorCode, YAPPY_ERROR_MESSAGES } from '../types.js';
export type { YappyButtonConfig, YappyPaymentParams } from '../types.js';
