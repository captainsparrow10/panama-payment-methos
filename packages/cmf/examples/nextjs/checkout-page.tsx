/**
 * Example Next.js checkout page using CMFPaymentForm.
 *
 * This demonstrates the simplest possible integration: drop the
 * `<CMFPaymentForm>` component into your checkout page and handle
 * the `onSuccess` callback to confirm the order.
 *
 * @example
 * ```tsx
 * // app/checkout/page.tsx
 * import CheckoutPage from './checkout-page';
 * export default CheckoutPage;
 * ```
 */

'use client';

import React, { useState } from 'react';
import { CMFPaymentForm } from '@devhubpty/cmf/react';

export default function CheckoutPage() {
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);

  // In a real app, this would come from your cart/order state
  const total = 250.0;
  const userName = 'Juan Perez';
  const orderId = 'ORD-12345';

  if (orderConfirmed) {
    return (
      <main>
        <h1>Order Confirmed</h1>
        <p>Your order #{orderId} has been confirmed.</p>
        <p>CMF Receipt: {receiptNumber}</p>
        <p>You will receive a confirmation email from CMF shortly.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Checkout</h1>

      <section>
        <h2>Order Summary</h2>
        <p>Order #{orderId}</p>
        <p>Total: ${total.toFixed(2)}</p>
      </section>

      <section>
        <h2>Payment</h2>
        <CMFPaymentForm
          total={total}
          userName={userName}
          description={`Order ${orderId}`}
          apiBase="/api/cmf"
          onSuccess={(receipt) => {
            setReceiptNumber(receipt);
            setOrderConfirmed(true);
            // In a real app, also call your backend to confirm the order
            // confirmOrder(orderId, { cmfReceiptNumber: receipt });
          }}
          onError={(msg) => {
            // In a real app, show a toast or alert
            console.error('Payment error:', msg);
          }}
          className="mt-4 rounded-lg border p-6"
        />
      </section>
    </main>
  );
}
