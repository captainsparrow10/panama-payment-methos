/**
 * 3DS authentication state machine orchestrator hook.
 *
 * Manages the complete 3DS authentication flow as a finite state machine:
 *
 * ```
 * idle -> setup -> fingerprint -> enroll -> [challenge -> validate] -> ready -> done | error
 * ```
 *
 * - **Frictionless path**: idle -> setup -> fingerprint -> enroll -> ready -> done
 * - **Challenge path**: idle -> setup -> fingerprint -> enroll -> challenge -> validate -> ready -> done
 *
 * All API calls are delegated to callback functions provided by the consumer,
 * making this hook transport-agnostic (works with fetch, axios, tRPC, etc.).
 *
 * @example
 * ```tsx
 * import { useThreeDS } from '@panama-payments/cybersource/react';
 *
 * function CheckoutPage() {
 *   const threeDS = useThreeDS({
 *     onSetup: async (payload) => {
 *       const res = await fetch('/api/cybersource/setup', { method: 'POST', body: JSON.stringify(payload) });
 *       return res.json();
 *     },
 *     onCheckEnrollment: async (payload) => {
 *       const res = await fetch('/api/cybersource/enroll', { method: 'POST', body: JSON.stringify(payload) });
 *       return res.json();
 *     },
 *     onValidate: async (payload) => {
 *       const res = await fetch('/api/cybersource/validate', { method: 'POST', body: JSON.stringify(payload) });
 *       return res.json();
 *     },
 *   });
 *
 *   // Start the 3DS flow
 *   const handle3DS = async () => {
 *     await threeDS.startAuth({
 *       paymentInstrumentId: 'PI_xyz',
 *       cybersourceId: 'CS_abc',
 *       amount: '25.99',
 *       currency: 'USD',
 *       billingAddress: { ... },
 *       returnUrl: 'https://example.com/3ds-callback',
 *     });
 *   };
 *
 *   // After user completes challenge (from postMessage)
 *   const handleChallengeComplete = () => {
 *     threeDS.completeChallenge('txn-from-challenge');
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handle3DS} disabled={threeDS.isLoading}>
 *         Authenticate Card
 *       </button>
 *       {threeDS.challengeRequired && (
 *         <ThreeDSModal
 *           challengeUrl={threeDS.challengeUrl!}
 *           challengeJwt={threeDS.challengeJwt!}
 *           onComplete={handleChallengeComplete}
 *         />
 *       )}
 *       {threeDS.step === 'ready' && <p>Card authenticated, ready to pay</p>}
 *       {threeDS.error && <p>Error: {threeDS.error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import { ThreeDSStep } from '../../types.js';
import type { SetupAuthResponse, EnrollmentResponse, ValidateAuthResponse } from '../../types.js';

/**
 * Input data for starting the 3DS authentication flow.
 *
 * @example
 * ```ts
 * const input: StartAuthInput = {
 *   paymentInstrumentId: 'PI_xyz',
 *   cybersourceId: 'CS_abc',
 *   amount: '25.99',
 *   currency: 'USD',
 *   billingAddress: { firstName: 'Juan', lastName: 'Perez', ... },
 *   returnUrl: 'https://example.com/3ds-callback',
 * };
 * ```
 */
export interface StartAuthInput {
  /** Payment instrument ID to authenticate */
  paymentInstrumentId: string;
  /** CyberSource customer ID */
  cybersourceId: string;
  /** Transaction amount */
  amount: string;
  /** Currency code (e.g., 'USD') */
  currency: string;
  /** Billing address */
  billingAddress: Record<string, string>;
  /** 3DS challenge return URL */
  returnUrl: string;
  /** Device fingerprint session ID */
  sessionId?: string;
}

/**
 * Options for the `useThreeDS` orchestrator hook.
 *
 * @example
 * ```ts
 * const options: UseThreeDSOptions = {
 *   onSetup: async (payload) => { ... },
 *   onCheckEnrollment: async (payload) => { ... },
 *   onValidate: async (payload) => { ... },
 * };
 * ```
 */
export interface UseThreeDSOptions {
  /** Function that calls your backend setup endpoint */
  onSetup: (payload: {
    paymentInstrumentId: string;
    cybersourceId: string;
    sessionId?: string;
  }) => Promise<SetupAuthResponse>;

  /** Function that calls your backend enrollment check endpoint */
  onCheckEnrollment: (payload: {
    referenceId: string;
    paymentInstrumentId: string;
    amount: string;
    currency: string;
    billingAddress: Record<string, string>;
    returnUrl: string;
    sessionId?: string;
  }) => Promise<EnrollmentResponse>;

  /** Function that calls your backend validate endpoint */
  onValidate: (payload: {
    authenticationTransactionId: string;
  }) => Promise<ValidateAuthResponse>;
}

/**
 * Return type for the `useThreeDS` orchestrator hook.
 *
 * @example
 * ```ts
 * const { step, startAuth, completeChallenge, challengeRequired, challengeUrl, challengeJwt, isLoading, error, reset } = useThreeDS(options);
 * ```
 */
export interface UseThreeDSReturn {
  /** Current step in the 3DS state machine */
  step: ThreeDSStep;
  /** Start the 3DS authentication flow */
  startAuth: (input: StartAuthInput) => Promise<void>;
  /** Complete the challenge after user interaction */
  completeChallenge: (authenticationTransactionId: string) => Promise<void>;
  /** Whether a challenge is required and pending */
  challengeRequired: boolean;
  /** Challenge URL for the iframe (null if no challenge) */
  challengeUrl: string | null;
  /** Challenge JWT / access token for the iframe form submission */
  challengeJwt: string | null;
  /** Whether any operation is in progress */
  isLoading: boolean;
  /** Error from any step (null if none) */
  error: Error | null;
  /** Setup response data (for device data collection) */
  setupData: SetupAuthResponse | null;
  /** Enrollment response data */
  enrollmentData: EnrollmentResponse | null;
  /** Validation response data */
  validationData: ValidateAuthResponse | null;
  /** Reset the entire state machine */
  reset: () => void;
}

/**
 * 3DS authentication state machine orchestrator.
 *
 * Manages the complete authentication flow, transitioning through states:
 * `idle -> setup -> fingerprint -> enroll -> [challenge -> validate] -> ready -> done | error`
 *
 * @param options - Callback functions for each backend API call
 * @returns State machine controls and current state
 *
 * @example
 * ```tsx
 * const threeDS = useThreeDS({
 *   onSetup: async (payload) => {
 *     const res = await fetch('/api/cybersource/setup', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(payload),
 *     });
 *     return res.json();
 *   },
 *   onCheckEnrollment: async (payload) => {
 *     const res = await fetch('/api/cybersource/enroll', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(payload),
 *     });
 *     return res.json();
 *   },
 *   onValidate: async (payload) => {
 *     const res = await fetch('/api/cybersource/validate', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(payload),
 *     });
 *     return res.json();
 *   },
 * });
 *
 * // Start auth -> automatic frictionless or challenge
 * await threeDS.startAuth({
 *   paymentInstrumentId: 'PI_xyz',
 *   cybersourceId: 'CS_abc',
 *   amount: '25.99',
 *   currency: 'USD',
 *   billingAddress: { firstName: 'Juan', lastName: 'Perez', address1: 'Calle 50', ... },
 *   returnUrl: 'https://example.com/3ds-callback',
 * });
 *
 * // If challenge required, wait for user, then:
 * if (threeDS.challengeRequired) {
 *   // Show ThreeDSModal, then on postMessage:
 *   await threeDS.completeChallenge('txn-from-challenge');
 * }
 *
 * // When step === 'ready', proceed to payment
 * ```
 */
export function useThreeDS(options: UseThreeDSOptions): UseThreeDSReturn {
  const [step, setStep] = useState<ThreeDSStep>(ThreeDSStep.Idle);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [setupData, setSetupData] = useState<SetupAuthResponse | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentResponse | null>(null);
  const [validationData, setValidationData] = useState<ValidateAuthResponse | null>(null);
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [challengeJwt, setChallengeJwt] = useState<string | null>(null);

  const inputRef = useRef<StartAuthInput | null>(null);

  const startAuth = useCallback(
    async (input: StartAuthInput) => {
      inputRef.current = input;
      setIsLoading(true);
      setError(null);
      setChallengeRequired(false);
      setChallengeUrl(null);
      setChallengeJwt(null);

      try {
        // Step 1: Setup
        setStep(ThreeDSStep.Setup);
        const setup = await options.onSetup({
          paymentInstrumentId: input.paymentInstrumentId,
          cybersourceId: input.cybersourceId,
          sessionId: input.sessionId,
        });
        setSetupData(setup);

        // Step 2: Fingerprint (conceptual -- handled by frontend iframe)
        setStep(ThreeDSStep.Fingerprint);
        const referenceId = setup.consumerAuthenticationInformation.referenceId;

        // Step 3: Enrollment check
        setStep(ThreeDSStep.Enroll);
        const enrollment = await options.onCheckEnrollment({
          referenceId,
          paymentInstrumentId: input.paymentInstrumentId,
          amount: input.amount,
          currency: input.currency,
          billingAddress: input.billingAddress,
          returnUrl: input.returnUrl,
          sessionId: input.sessionId,
        });
        setEnrollmentData(enrollment);

        // Determine if frictionless or challenge
        const status = enrollment.status;
        const consumerAuth = enrollment.consumerAuthenticationInformation;

        if (
          status === 'AUTHENTICATION_SUCCESSFUL' ||
          status === 'AUTHENTICATED'
        ) {
          // Frictionless -- ready to pay
          setStep(ThreeDSStep.Ready);
          setIsLoading(false);
          return;
        }

        if (status === 'PENDING_AUTHENTICATION') {
          // Challenge required
          const url = consumerAuth?.stepUpUrl || consumerAuth?.acsUrl || null;
          const jwt = consumerAuth?.accessToken || null;

          if (url) {
            setChallengeRequired(true);
            setChallengeUrl(url);
            setChallengeJwt(jwt);
            setStep(ThreeDSStep.Challenge);
            setIsLoading(false);
            return;
          }
        }

        // Unexpected status
        throw new Error(
          `Unexpected enrollment status: ${status}. ` +
          `Error: ${enrollment.errorInformation?.message || 'Unknown'}`,
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setStep(ThreeDSStep.Error);
        setIsLoading(false);
      }
    },
    [options],
  );

  const completeChallenge = useCallback(
    async (authenticationTransactionId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // Step 5: Validate authentication
        setStep(ThreeDSStep.Validate);
        const validation = await options.onValidate({
          authenticationTransactionId,
        });
        setValidationData(validation);

        const status = validation.status;
        if (
          status === 'AUTHENTICATION_SUCCESSFUL' ||
          status === 'VALIDATED'
        ) {
          setStep(ThreeDSStep.Ready);
          setChallengeRequired(false);
          setIsLoading(false);
          return;
        }

        throw new Error(
          `Authentication validation failed with status: ${status}. ` +
          `Error: ${validation.errorInformation?.message || 'Unknown'}`,
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setStep(ThreeDSStep.Error);
        setIsLoading(false);
      }
    },
    [options],
  );

  const reset = useCallback(() => {
    setStep(ThreeDSStep.Idle);
    setIsLoading(false);
    setError(null);
    setSetupData(null);
    setEnrollmentData(null);
    setValidationData(null);
    setChallengeRequired(false);
    setChallengeUrl(null);
    setChallengeJwt(null);
    inputRef.current = null;
  }, []);

  return {
    step,
    startAuth,
    completeChallenge,
    challengeRequired,
    challengeUrl,
    challengeJwt,
    isLoading,
    error,
    setupData,
    enrollmentData,
    validationData,
    reset,
  };
}
