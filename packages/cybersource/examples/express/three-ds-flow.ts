/**
 * Complete 3DS flow example for Express.
 *
 * Shows the full end-to-end flow from card tokenization through 3DS
 * authentication to final payment processing. This is a reference
 * implementation -- adapt it to your own Express app structure.
 */

import {
  CyberSourceClient,
  CyberSourceEnvironment,
  type PaymentResponse,
} from '@panama-payments/cybersource/server';
import { createConsoleLogger } from '@panama-payments/core';

const client = new CyberSourceClient({
  merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
  keyId: process.env.CYBERSOURCE_KEY!,
  sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
  environment: CyberSourceEnvironment.Test,
  logger: createConsoleLogger({ level: 'info' }),
});

/**
 * Full flow: tokenize card -> 3DS setup -> enroll -> payment
 *
 * In a real app, these steps happen across multiple HTTP requests.
 * This example shows them sequentially for clarity.
 */
async function fullPaymentFlow(): Promise<PaymentResponse> {
  // 1. Create customer (or use existing CyberSource customer ID)
  const customer = await client.createCustomer({
    customerId: 'user-123',
    email: 'juan@example.com',
    phone: '+5076000000',
  });
  console.log('Customer created:', customer.id);

  // 2. Tokenize card (step 1: instrument identifier)
  const instrumentIdentifier = await client.createInstrumentIdentifier({
    cardNumber: '4111111111111111',
    securityCode: '123',
  });
  console.log('Instrument ID:', instrumentIdentifier.id);

  // 3. Create payment instrument (step 2)
  const paymentInstrument = await client.createPaymentInstrument({
    cybersourceCustomerId: customer.id,
    instrumentIdentifierTokenId: instrumentIdentifier.id,
    expirationMonth: '12',
    expirationYear: '2028',
    type: '001', // Visa
    billTo: {
      firstName: 'Juan',
      lastName: 'Perez',
      address1: 'Calle 50, Edificio Global',
      locality: 'Panama City',
      country: 'PA',
      email: 'juan@example.com',
    },
  });
  console.log('Payment instrument:', paymentInstrument.id);

  // 4. Setup 3DS authentication
  const setup = await client.setupAuthentication({
    cybersourceCustomerId: customer.id,
    paymentInstrumentId: paymentInstrument.id,
    sessionId: 'device-fingerprint-session-id',
  });
  console.log('Setup referenceId:', setup.consumerAuthenticationInformation.referenceId);

  // 5. Check enrollment
  const enrollment = await client.checkEnrollment({
    referenceId: setup.consumerAuthenticationInformation.referenceId,
    cybersourceCustomerId: customer.id,
    amount: '25.99',
    currency: 'USD',
    billingAddress: {
      firstName: 'Juan',
      lastName: 'Perez',
      address1: 'Calle 50',
      locality: 'Panama City',
      country: 'PA',
      email: 'juan@example.com',
    },
    returnUrl: 'https://example.com/api/3ds-callback',
  });
  console.log('Enrollment status:', enrollment.status);

  // 6. Handle enrollment result
  const consumerAuth = enrollment.consumerAuthenticationInformation;

  if (enrollment.status === 'PENDING_AUTHENTICATION') {
    // In a real app, the frontend shows the challenge iframe.
    // After the user completes the challenge, call validateAuthentication.
    console.log('Challenge required! Redirect user to:', consumerAuth?.stepUpUrl);
    console.log('Access token for iframe:', consumerAuth?.accessToken);

    // Simulated: after challenge completion, validate
    // const validation = await client.validateAuthentication({
    //   authenticationTransactionId: consumerAuth?.authenticationTransactionId!,
    // });
    // console.log('Validation status:', validation.status);
  }

  // 7. Process payment (auth data is cached automatically for fallback)
  const payment = await client.processPayment({
    totalAmount: '25.99',
    currency: 'USD',
    cybersourceCustomerId: customer.id,
    customerId: 'user-123',
    sessionId: 'device-fingerprint-session-id',
    auth3DSResult: {
      cavv: consumerAuth?.cavv || '',
      xid: consumerAuth?.xid || '',
      eciRaw: consumerAuth?.eciRaw || '',
      authenticationTransactionId: consumerAuth?.authenticationTransactionId || '',
      directoryServerTransactionId: consumerAuth?.directoryServerTransactionId,
      specificationVersion: consumerAuth?.specificationVersion,
    },
    source: 'web',
    businessId: 'merkapp',
    cardType: '001',
    billTo: {
      firstName: 'Juan',
      lastName: 'Perez',
      address1: 'Calle 50',
      country: 'PA',
      email: 'juan@example.com',
    },
  });

  console.log('Payment status:', payment.status);
  console.log('Payment ID:', payment.id);

  return payment;
}

// Run the flow
fullPaymentFlow()
  .then((payment) => console.log('Done! Payment ID:', payment.id))
  .catch((error) => console.error('Flow failed:', error));
