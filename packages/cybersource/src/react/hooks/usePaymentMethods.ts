/**
 * Hook for managing CyberSource payment methods (cards).
 *
 * Provides `addCard` and `deleteCard` operations for the user's
 * payment method vault. The 2-step card tokenization (instrument
 * identifier + payment instrument) is handled by the backend.
 *
 * @example
 * ```tsx
 * import { usePaymentMethods } from '@devhubpty/cybersource/react';
 *
 * function PaymentMethodsPage() {
 *   const { addCard, deleteCard, result, isLoading, error } = usePaymentMethods({
 *     onAddCard: async (cardData) => {
 *       const res = await fetch('/api/cybersource/cards', {
 *         method: 'POST',
 *         body: JSON.stringify(cardData),
 *       });
 *       return res.json();
 *     },
 *     onDeleteCard: async (cardId) => {
 *       await fetch(`/api/cybersource/cards/${cardId}`, { method: 'DELETE' });
 *     },
 *   });
 *
 *   return (
 *     <form onSubmit={(e) => { e.preventDefault(); addCard({ ... }); }}>
 *       ...
 *     </form>
 *   );
 * }
 * ```
 */

import { useState, useCallback } from 'react';

/**
 * Card data payload for adding a new payment method.
 *
 * @example
 * ```ts
 * const card: AddCardPayload = {
 *   cardNumber: '4111111111111111',
 *   expirationMonth: '12',
 *   expirationYear: '2028',
 *   securityCode: '123',
 *   type: '001',
 *   name: 'Juan Perez',
 *   email: 'juan@example.com',
 * };
 * ```
 */
export interface AddCardPayload {
  /** Full card number */
  cardNumber: string;
  /** Expiration month (MM) */
  expirationMonth: string;
  /** Expiration year (YYYY) */
  expirationYear: string;
  /** Security code (CVV) */
  securityCode: string;
  /** Card type code (e.g., '001' for Visa) */
  type?: string;
  /** Cardholder full name */
  name?: string;
  /** Cardholder email */
  email?: string;
  /** Street address */
  address1?: string;
  /** City */
  city?: string;
  /** Additional data (provider-specific) */
  [key: string]: unknown;
}

/**
 * Result from adding a card.
 *
 * @example
 * ```ts
 * const result: AddCardResult = {
 *   paymentInstrumentId: 'PI_xyz',
 *   last4: '1111',
 *   cardType: '001',
 *   expirationMonth: '12',
 *   expirationYear: '2028',
 * };
 * ```
 */
export interface AddCardResult {
  /** Payment instrument ID for future payments */
  paymentInstrumentId: string;
  /** Last 4 digits of the card */
  last4?: string;
  /** Card type code */
  cardType?: string;
  /** Expiration month */
  expirationMonth?: string;
  /** Expiration year */
  expirationYear?: string;
  /** Additional data from the response */
  [key: string]: unknown;
}

/**
 * Options for the `usePaymentMethods` hook.
 *
 * @example
 * ```ts
 * const options: UsePaymentMethodsOptions = {
 *   onAddCard: async (cardData) => {
 *     const res = await fetch('/api/cards', { method: 'POST', body: JSON.stringify(cardData) });
 *     return res.json();
 *   },
 *   onDeleteCard: async (cardId) => {
 *     await fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
 *   },
 * };
 * ```
 */
export interface UsePaymentMethodsOptions {
  /** Function that calls your backend to add a card (tokenize + create payment instrument) */
  onAddCard: (cardData: AddCardPayload) => Promise<AddCardResult>;
  /** Function that calls your backend to delete a card */
  onDeleteCard?: (paymentInstrumentId: string) => Promise<void>;
}

/**
 * Return type for the `usePaymentMethods` hook.
 *
 * @example
 * ```ts
 * const { addCard, deleteCard, result, isLoading, error, reset } = usePaymentMethods(options);
 * ```
 */
export interface UsePaymentMethodsReturn {
  /** Add a new card (tokenize and create payment instrument) */
  addCard: (cardData: AddCardPayload) => Promise<void>;
  /** Delete a card */
  deleteCard: (paymentInstrumentId: string) => Promise<void>;
  /** Result from the last add operation */
  result: AddCardResult | null;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Error from the last operation */
  error: Error | null;
  /** Reset the hook state */
  reset: () => void;
}

/**
 * Hook for managing CyberSource payment methods.
 *
 * @param options - Configuration with backend API call functions
 * @returns Hook state and controls
 *
 * @example
 * ```tsx
 * const methods = usePaymentMethods({
 *   onAddCard: async (cardData) => {
 *     const res = await fetch('/api/cybersource/cards', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(cardData),
 *     });
 *     if (!res.ok) throw new Error('Failed to add card');
 *     return res.json();
 *   },
 *   onDeleteCard: async (id) => {
 *     const res = await fetch(`/api/cybersource/cards/${id}`, { method: 'DELETE' });
 *     if (!res.ok) throw new Error('Failed to delete card');
 *   },
 * });
 *
 * // Add a card
 * await methods.addCard({
 *   cardNumber: '4111111111111111',
 *   expirationMonth: '12',
 *   expirationYear: '2028',
 *   securityCode: '123',
 *   type: '001',
 *   name: 'Juan Perez',
 *   email: 'juan@example.com',
 * });
 *
 * // Delete a card
 * await methods.deleteCard('PI_xyz');
 * ```
 */
export function usePaymentMethods(
  options: UsePaymentMethodsOptions,
): UsePaymentMethodsReturn {
  const [result, setResult] = useState<AddCardResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addCard = useCallback(
    async (cardData: AddCardPayload) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await options.onAddCard(cardData);
        setResult(response);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options.onAddCard],
  );

  const deleteCard = useCallback(
    async (paymentInstrumentId: string) => {
      if (!options.onDeleteCard) {
        throw new Error('onDeleteCard is not configured');
      }

      setIsLoading(true);
      setError(null);

      try {
        await options.onDeleteCard(paymentInstrumentId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options.onDeleteCard],
  );

  const reset = useCallback(() => {
    setResult(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { addCard, deleteCard, result, isLoading, error, reset };
}
