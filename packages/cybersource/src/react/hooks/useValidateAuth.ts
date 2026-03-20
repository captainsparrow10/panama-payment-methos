/**
 * Hook for validating 3DS authentication after a challenge.
 *
 * Called after the user completes the 3DS challenge iframe. Sends the
 * authentication transaction ID to the backend for validation and
 * returns the final authentication status and data.
 *
 * @example
 * ```tsx
 * import { useValidateAuth } from '@devhubpty/cybersource/react';
 *
 * function CheckoutPage() {
 *   const { validate, data, isLoading, error, reset } = useValidateAuth({
 *     onValidate: async (payload) => {
 *       const res = await fetch('/api/cybersource/validate', {
 *         method: 'POST',
 *         body: JSON.stringify(payload),
 *       });
 *       return res.json();
 *     },
 *   });
 *
 *   const handleChallengeComplete = (transactionId: string) => {
 *     validate({ authenticationTransactionId: transactionId });
 *   };
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import type { ValidateAuthResponse } from '../../types.js';

/**
 * Payload for the validate authentication API call.
 *
 * @example
 * ```ts
 * const payload: ValidateAuthPayload = {
 *   authenticationTransactionId: 'txn-from-challenge',
 * };
 * ```
 */
export interface ValidateAuthPayload {
  /** Authentication transaction ID from the challenge */
  authenticationTransactionId: string;
  /** Payment instrument ID (for reference) */
  paymentInstrumentId?: string;
  /** Transaction mode */
  transactionMode?: string;
}

/**
 * Options for the `useValidateAuth` hook.
 *
 * @example
 * ```ts
 * const options: UseValidateAuthOptions = {
 *   onValidate: async (payload) => {
 *     const res = await fetch('/api/cybersource/validate', { method: 'POST', body: JSON.stringify(payload) });
 *     return res.json();
 *   },
 * };
 * ```
 */
export interface UseValidateAuthOptions {
  /** Function that calls your backend validate endpoint */
  onValidate: (payload: ValidateAuthPayload) => Promise<ValidateAuthResponse>;
}

/**
 * Return type for the `useValidateAuth` hook.
 *
 * @example
 * ```ts
 * const { validate, data, isLoading, error, reset } = useValidateAuth(options);
 * ```
 */
export interface UseValidateAuthReturn {
  /** Trigger the validation call */
  validate: (payload: ValidateAuthPayload) => Promise<void>;
  /** Validation response data */
  data: ValidateAuthResponse | null;
  /** Whether the validation call is in progress */
  isLoading: boolean;
  /** Error from the validation call */
  error: Error | null;
  /** Reset the hook state */
  reset: () => void;
}

/**
 * Hook for validating 3DS authentication after a challenge.
 *
 * @param options - Configuration with the backend API call function
 * @returns Hook state and controls
 *
 * @example
 * ```tsx
 * const { validate, data, isLoading, error } = useValidateAuth({
 *   onValidate: async (payload) => {
 *     const res = await fetch('/api/cybersource/validate', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(payload),
 *     });
 *     if (!res.ok) throw new Error('Validation failed');
 *     return res.json();
 *   },
 * });
 *
 * // After challenge iframe completes:
 * await validate({ authenticationTransactionId: 'txn-from-challenge' });
 *
 * if (data?.status === 'AUTHENTICATION_SUCCESSFUL') {
 *   // Proceed to payment
 * }
 * ```
 */
export function useValidateAuth(
  options: UseValidateAuthOptions,
): UseValidateAuthReturn {
  const [data, setData] = useState<ValidateAuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const validate = useCallback(
    async (payload: ValidateAuthPayload) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await options.onValidate(payload);
        setData(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options.onValidate],
  );

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { validate, data, isLoading, error, reset };
}
