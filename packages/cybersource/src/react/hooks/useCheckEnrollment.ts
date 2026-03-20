/**
 * Hook for the 3DS enrollment check step.
 *
 * Wraps the server API call to check whether a card is enrolled in 3DS
 * and whether a challenge is required. Provides derived state for
 * determining if the flow is frictionless or requires user interaction.
 *
 * @example
 * ```tsx
 * import { useCheckEnrollment } from '@devhubpty/cybersource/react';
 *
 * function CheckoutPage() {
 *   const { checkEnrollment, data, isFrictionless, challengeUrl, isLoading, error } = useCheckEnrollment({
 *     onCheckEnrollment: async (payload) => {
 *       const res = await fetch('/api/cybersource/enroll', {
 *         method: 'POST',
 *         body: JSON.stringify(payload),
 *       });
 *       return res.json();
 *     },
 *   });
 *
 *   if (isFrictionless) {
 *     // Proceed directly to payment
 *   } else if (challengeUrl) {
 *     // Show challenge iframe
 *   }
 * }
 * ```
 */

import { useState, useCallback, useMemo } from 'react';
import type { EnrollmentResponse } from '../../types.js';

/**
 * Payload for the enrollment check API call.
 *
 * @example
 * ```ts
 * const payload: CheckEnrollmentPayload = {
 *   referenceId: 'ref-from-setup',
 *   paymentInstrumentId: 'PI_xyz',
 *   amount: '25.99',
 *   currency: 'USD',
 *   billingAddress: { firstName: 'Juan', ... },
 *   returnUrl: 'https://example.com/3ds-callback',
 * };
 * ```
 */
export interface CheckEnrollmentPayload {
  /** Reference ID from setup response */
  referenceId: string;
  /** Payment instrument ID */
  paymentInstrumentId: string;
  /** Transaction amount */
  amount: string;
  /** Currency code */
  currency: string;
  /** Billing address */
  billingAddress: Record<string, string>;
  /** Challenge return URL */
  returnUrl: string;
  /** Device fingerprint session ID */
  sessionId?: string;
}

/**
 * Options for the `useCheckEnrollment` hook.
 *
 * @example
 * ```ts
 * const options: UseCheckEnrollmentOptions = {
 *   onCheckEnrollment: async (payload) => {
 *     const res = await fetch('/api/cybersource/enroll', { method: 'POST', body: JSON.stringify(payload) });
 *     return res.json();
 *   },
 * };
 * ```
 */
export interface UseCheckEnrollmentOptions {
  /** Function that calls your backend enrollment endpoint */
  onCheckEnrollment: (payload: CheckEnrollmentPayload) => Promise<EnrollmentResponse>;
}

/**
 * Return type for the `useCheckEnrollment` hook.
 *
 * @example
 * ```ts
 * const { checkEnrollment, data, isFrictionless, challengeUrl, isLoading, error, reset } = useCheckEnrollment(options);
 * ```
 */
export interface UseCheckEnrollmentReturn {
  /** Trigger the enrollment check */
  checkEnrollment: (payload: CheckEnrollmentPayload) => Promise<void>;
  /** Enrollment response data */
  data: EnrollmentResponse | null;
  /** Whether the flow is frictionless (no challenge needed) */
  isFrictionless: boolean;
  /** Challenge URL for iframe (null if frictionless or not yet checked) */
  challengeUrl: string | null;
  /** Whether the enrollment check is in progress */
  isLoading: boolean;
  /** Error from the enrollment check */
  error: Error | null;
  /** Reset the hook state */
  reset: () => void;
}

/**
 * Hook for checking 3DS enrollment.
 *
 * After calling `checkEnrollment`, inspect `isFrictionless` and `challengeUrl`
 * to determine the next step:
 * - Frictionless: proceed to payment
 * - Challenge: display the challenge iframe at `challengeUrl`
 *
 * @param options - Configuration with the backend API call function
 * @returns Hook state and controls
 *
 * @example
 * ```tsx
 * const enrollment = useCheckEnrollment({
 *   onCheckEnrollment: async (payload) => {
 *     const res = await fetch('/api/cybersource/enroll', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(payload),
 *     });
 *     if (!res.ok) throw new Error('Enrollment check failed');
 *     return res.json();
 *   },
 * });
 *
 * await enrollment.checkEnrollment({ referenceId: '...', ... });
 *
 * if (enrollment.isFrictionless) {
 *   // No challenge needed, proceed to payment
 * } else if (enrollment.challengeUrl) {
 *   // Show ThreeDSModal with challengeUrl
 * }
 * ```
 */
export function useCheckEnrollment(
  options: UseCheckEnrollmentOptions,
): UseCheckEnrollmentReturn {
  const [data, setData] = useState<EnrollmentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isFrictionless = useMemo(() => {
    if (!data) return false;
    return (
      data.status === 'AUTHENTICATION_SUCCESSFUL' ||
      data.status === 'AUTHENTICATED'
    );
  }, [data]);

  const challengeUrl = useMemo(() => {
    if (!data) return null;
    if (data.status !== 'PENDING_AUTHENTICATION') return null;

    const consumerAuth = data.consumerAuthenticationInformation;
    return consumerAuth?.stepUpUrl || consumerAuth?.acsUrl || null;
  }, [data]);

  const checkEnrollment = useCallback(
    async (payload: CheckEnrollmentPayload) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await options.onCheckEnrollment(payload);
        setData(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options.onCheckEnrollment],
  );

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { checkEnrollment, data, isFrictionless, challengeUrl, isLoading, error, reset };
}
