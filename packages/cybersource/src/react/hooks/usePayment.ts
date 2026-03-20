/**
 * Hook for processing a CyberSource payment.
 *
 * Wraps the server API call to authorize and capture a payment.
 * Designed to be called after 3DS authentication completes successfully.
 *
 * @example
 * ```tsx
 * import { usePayment } from '@panama-payments/cybersource/react';
 *
 * function CheckoutPage() {
 *   const { pay, result, isLoading, error, reset } = usePayment({
 *     onPay: async (payload) => {
 *       const res = await fetch('/api/cybersource/payment', {
 *         method: 'POST',
 *         body: JSON.stringify(payload),
 *       });
 *       return res.json();
 *     },
 *   });
 *
 *   const handlePay = () => {
 *     pay({
 *       amount: '25.99',
 *       currency: 'USD',
 *       authenticationTransactionId: 'txn-123',
 *       // ... other payment data
 *     });
 *   };
 *
 *   if (result?.status === 'AUTHORIZED') {
 *     return <p>Payment successful!</p>;
 *   }
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import type { PaymentResponse } from '../../types.js';

/**
 * Payload for the payment API call.
 *
 * @example
 * ```ts
 * const payload: PaymentPayload = {
 *   amount: '25.99',
 *   currency: 'USD',
 *   authenticationTransactionId: 'txn-123',
 *   ecommerceIndicator: 'vbv',
 * };
 * ```
 */
export interface PaymentPayload {
  /** Transaction amount */
  amount: string;
  /** Currency code */
  currency: string;
  /** 3DS authentication transaction ID */
  authenticationTransactionId: string;
  /** ECI / ecommerce indicator */
  ecommerceIndicator?: string;
  /** Payment instrument ID */
  paymentInstrumentId?: string;
  /** Billing address */
  billingAddress?: Record<string, string>;
  /** Additional payment data (provider-specific) */
  [key: string]: unknown;
}

/**
 * Options for the `usePayment` hook.
 *
 * @example
 * ```ts
 * const options: UsePaymentOptions = {
 *   onPay: async (payload) => {
 *     const res = await fetch('/api/cybersource/payment', { method: 'POST', body: JSON.stringify(payload) });
 *     return res.json();
 *   },
 * };
 * ```
 */
export interface UsePaymentOptions {
  /** Function that calls your backend payment endpoint */
  onPay: (payload: PaymentPayload) => Promise<PaymentResponse>;
}

/**
 * Return type for the `usePayment` hook.
 *
 * @example
 * ```ts
 * const { pay, result, isLoading, error, reset } = usePayment(options);
 * ```
 */
export interface UsePaymentReturn {
  /** Trigger the payment call */
  pay: (payload: PaymentPayload) => Promise<void>;
  /** Payment response result */
  result: PaymentResponse | null;
  /** Whether the payment call is in progress */
  isLoading: boolean;
  /** Error from the payment call */
  error: Error | null;
  /** Reset the hook state */
  reset: () => void;
}

/**
 * Hook for processing a CyberSource payment.
 *
 * @param options - Configuration with the backend API call function
 * @returns Hook state and controls
 *
 * @example
 * ```tsx
 * const { pay, result, isLoading, error, reset } = usePayment({
 *   onPay: async (payload) => {
 *     const res = await fetch('/api/cybersource/payment', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(payload),
 *     });
 *     if (!res.ok) throw new Error('Payment failed');
 *     return res.json();
 *   },
 * });
 *
 * // After 3DS completes:
 * await pay({
 *   amount: '25.99',
 *   currency: 'USD',
 *   authenticationTransactionId: 'txn-abc',
 * });
 *
 * if (result?.status === 'AUTHORIZED') {
 *   console.log('Payment approved!');
 * }
 * ```
 */
export function usePayment(options: UsePaymentOptions): UsePaymentReturn {
  const [result, setResult] = useState<PaymentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pay = useCallback(
    async (payload: PaymentPayload) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await options.onPay(payload);
        setResult(response);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options.onPay],
  );

  const reset = useCallback(() => {
    setResult(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { pay, result, isLoading, error, reset };
}
