/**
 * Hook for the 3DS setup authentication step.
 *
 * Wraps the server API call to initialize payer authentication.
 * Returns the device data collection URL and access token needed
 * for the fingerprinting step.
 *
 * @example
 * ```tsx
 * import { useSetupService } from '@devhubpty/cybersource/react';
 *
 * function CheckoutPage() {
 *   const { setup, data, isLoading, error, reset } = useSetupService({
 *     onSetup: async (payload) => {
 *       const response = await fetch('/api/cybersource/setup', {
 *         method: 'POST',
 *         body: JSON.stringify(payload),
 *       });
 *       return response.json();
 *     },
 *   });
 *
 *   const handleSetup = () => {
 *     setup({
 *       paymentInstrumentId: 'PI_xyz',
 *       cybersourceId: 'CS_abc',
 *       sessionId: 'session-123',
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleSetup} disabled={isLoading}>
 *       {isLoading ? 'Setting up...' : 'Start 3DS'}
 *     </button>
 *   );
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import type { SetupAuthResponse } from '../../types.js';

/**
 * Payload for the setup service API call.
 *
 * @example
 * ```ts
 * const payload: SetupServicePayload = {
 *   paymentInstrumentId: 'PI_xyz',
 *   cybersourceId: 'CS_abc',
 *   sessionId: 'device-session',
 * };
 * ```
 */
export interface SetupServicePayload {
  /** Payment instrument ID to authenticate */
  paymentInstrumentId: string;
  /** CyberSource customer ID */
  cybersourceId: string;
  /** Device fingerprint session ID (optional) */
  sessionId?: string;
}

/**
 * Options for the `useSetupService` hook.
 *
 * @example
 * ```ts
 * const options: UseSetupServiceOptions = {
 *   onSetup: async (payload) => {
 *     const res = await fetch('/api/cybersource/setup', { method: 'POST', body: JSON.stringify(payload) });
 *     return res.json();
 *   },
 * };
 * ```
 */
export interface UseSetupServiceOptions {
  /** Function that calls your backend setup endpoint */
  onSetup: (payload: SetupServicePayload) => Promise<SetupAuthResponse>;
}

/**
 * Return type for the `useSetupService` hook.
 *
 * @example
 * ```ts
 * const { setup, data, isLoading, error, reset } = useSetupService(options);
 * ```
 */
export interface UseSetupServiceReturn {
  /** Trigger the setup authentication call */
  setup: (payload: SetupServicePayload) => Promise<void>;
  /** Setup response data (null until successful) */
  data: SetupAuthResponse | null;
  /** Whether the setup call is in progress */
  isLoading: boolean;
  /** Error from the setup call (null if none) */
  error: Error | null;
  /** Reset the hook state */
  reset: () => void;
}

/**
 * Hook for the 3DS setup authentication step.
 *
 * @param options - Configuration with the backend API call function
 * @returns Hook state and controls
 *
 * @example
 * ```tsx
 * const { setup, data, isLoading, error, reset } = useSetupService({
 *   onSetup: async (payload) => {
 *     const res = await fetch('/api/cybersource/setup', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(payload),
 *     });
 *     if (!res.ok) throw new Error('Setup failed');
 *     return res.json();
 *   },
 * });
 * ```
 */
export function useSetupService(
  options: UseSetupServiceOptions,
): UseSetupServiceReturn {
  const [data, setData] = useState<SetupAuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setup = useCallback(
    async (payload: SetupServicePayload) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await options.onSetup(payload);
        setData(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options.onSetup],
  );

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { setup, data, isLoading, error, reset };
}
