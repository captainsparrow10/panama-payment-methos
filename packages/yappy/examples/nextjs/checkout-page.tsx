/**
 * @example Next.js App Router: Complete Yappy checkout page with custom UI.
 *
 * This example demonstrates the full custom payment flow using:
 * - useYappyPendingCheck (orchestrator hook)
 * - YappyPhoneInput (phone number entry)
 * - YappyPendingModal (pending state with timer)
 *
 * For the simpler web component approach, use YappyButton instead.
 */

'use client';

import { useRouter } from 'next/navigation';
import {
  useYappyPendingCheck,
  YappyPhoneInput,
  YappyPendingModal,
} from '@devhubpty/yappy/react';

interface CheckoutPageProps {
  cartTotal: string;
  cartId: string;
}

export default function YappyCheckoutPage({ cartTotal, cartId }: CheckoutPageProps) {
  const router = useRouter();

  const {
    status,
    timeLeft,
    startPayment,
    cancelPayment,
    isLoading,
    error,
  } = useYappyPendingCheck({
    checkoutEndpoint: '/api/yappy/checkout',
    statusEndpoint: '/api/yappy/status',
    cancelEndpoint: '/api/yappy/cancel',
    onSuccess: ({ orderId }) => {
      router.push(`/checkout/success?order=${orderId}`);
    },
    onError: ({ message }) => {
      console.error('Yappy payment error:', message);
    },
    interval: 3000,
  });

  // Show pending modal when payment is in progress
  if (status === 'pending' || status === 'paid') {
    return (
      <YappyPendingModal
        status={status}
        timeLeft={timeLeft}
        onCancel={cancelPayment}
        className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      />
    );
  }

  // Show error states
  if (status === 'failed' || status === 'cancelled' || status === 'expired') {
    return (
      <YappyPendingModal
        status={status}
        onCancel={() => window.location.reload()}
        className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      />
    );
  }

  // Default: Phone input form
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Pagar con Yappy</h1>
      <p className="text-gray-600 mb-6">Total: ${cartTotal}</p>

      <YappyPhoneInput
        onSubmit={(phone) => startPayment(phone, { total: cartTotal, cartId })}
        disabled={isLoading}
        className="space-y-4"
      />

      {error && (
        <p className="mt-4 text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
