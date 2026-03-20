/**
 * Next.js checkout page example using CyberSource React hooks.
 *
 * Shows the complete 3DS flow with the useThreeDS orchestrator hook
 * and ThreeDSModal component. This is a reference implementation --
 * adapt it to your own UI framework (shadcn, MUI, etc.).
 */

'use client';

import { useState } from 'react';
import {
  useThreeDS,
  usePayment,
  ThreeDSModal,
  ThreeDSStep,
  type SetupAuthResponse,
  type EnrollmentResponse,
  type ValidateAuthResponse,
  type PaymentResponse,
} from '@panama-payments/cybersource/react';

async function apiFetch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  const json = await res.json();
  return json.data;
}

export default function CheckoutPage() {
  const [paymentResult, setPaymentResult] = useState<PaymentResponse | null>(null);

  // 3DS orchestrator
  const threeDS = useThreeDS({
    onSetup: (payload) =>
      apiFetch<SetupAuthResponse>('/api/cybersource/setup', payload),
    onCheckEnrollment: (payload) =>
      apiFetch<EnrollmentResponse>('/api/cybersource/enroll', payload),
    onValidate: (payload) =>
      apiFetch<ValidateAuthResponse>('/api/cybersource/validate', payload),
  });

  // Payment
  const payment = usePayment({
    onPay: (payload) =>
      apiFetch<PaymentResponse>('/api/cybersource/payment', payload),
  });

  // Start 3DS authentication
  const handleCheckout = async () => {
    await threeDS.startAuth({
      paymentInstrumentId: 'PI_your_instrument_id',
      cybersourceId: 'CS_your_customer_id',
      amount: '25.99',
      currency: 'USD',
      billingAddress: {
        firstName: 'Juan',
        lastName: 'Perez',
        address1: 'Calle 50',
        locality: 'Panama City',
        country: 'PA',
        email: 'juan@example.com',
        phoneNumber: '+5076000000',
        postalCode: '0801',
      },
      returnUrl: `${window.location.origin}/api/cybersource/validate`,
    });
  };

  // Handle challenge completion (postMessage from iframe)
  const handleChallengeComplete = async (result: { status: string }) => {
    const authTxId =
      threeDS.enrollmentData?.consumerAuthenticationInformation
        ?.authenticationTransactionId;

    if (authTxId) {
      await threeDS.completeChallenge(authTxId);
    }
  };

  // Process payment after 3DS is ready
  const handlePay = async () => {
    const consumerAuth =
      threeDS.enrollmentData?.consumerAuthenticationInformation ??
      threeDS.validationData?.consumerAuthenticationInformation;

    await payment.pay({
      amount: '25.99',
      currency: 'USD',
      authenticationTransactionId:
        consumerAuth?.authenticationTransactionId || '',
      ecommerceIndicator: consumerAuth?.eciRaw || '',
    });

    if (payment.result) {
      setPaymentResult(payment.result);
    }
  };

  return (
    <div>
      <h1>Checkout</h1>

      {/* Step 1: Start 3DS */}
      {threeDS.step === ThreeDSStep.Idle && (
        <button onClick={handleCheckout}>
          Proceed to Payment
        </button>
      )}

      {/* Loading states */}
      {threeDS.isLoading && <p>Authenticating card...</p>}

      {/* 3DS Challenge Modal */}
      {threeDS.challengeRequired && threeDS.challengeUrl && threeDS.challengeJwt && (
        <ThreeDSModal
          challengeUrl={threeDS.challengeUrl}
          challengeJwt={threeDS.challengeJwt}
          onComplete={handleChallengeComplete}
          onCancel={() => threeDS.reset()}
          iframeWidth={400}
          iframeHeight={600}
        />
      )}

      {/* Ready to pay */}
      {threeDS.step === ThreeDSStep.Ready && (
        <div>
          <p>Card authenticated successfully!</p>
          <button onClick={handlePay} disabled={payment.isLoading}>
            {payment.isLoading ? 'Processing...' : 'Pay $25.99'}
          </button>
        </div>
      )}

      {/* Payment result */}
      {paymentResult && (
        <div>
          <h2>Payment {paymentResult.status === 'AUTHORIZED' ? 'Successful' : 'Failed'}</h2>
          <p>Transaction ID: {paymentResult.id}</p>
          <p>Status: {paymentResult.status}</p>
        </div>
      )}

      {/* Errors */}
      {threeDS.error && (
        <div style={{ color: 'red' }}>
          <p>Authentication error: {threeDS.error.message}</p>
          <button onClick={threeDS.reset}>Try Again</button>
        </div>
      )}

      {payment.error && (
        <div style={{ color: 'red' }}>
          <p>Payment error: {payment.error.message}</p>
          <button onClick={payment.reset}>Try Again</button>
        </div>
      )}
    </div>
  );
}
