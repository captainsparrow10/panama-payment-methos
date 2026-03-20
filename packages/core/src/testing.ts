import { createHmac, randomBytes } from 'crypto';

/**
 * Test card numbers for CyberSource sandbox environment.
 *
 * These cards produce predictable results in test/sandbox mode.
 * **Never use these in production.**
 *
 * @see https://developer.cybersource.com/hello-world/testing-guide.html
 *
 * @example
 * ```ts
 * import { TEST_CARDS } from '@devhubpty/core';
 *
 * const payment = await client.processPayment({
 *   cardNumber: TEST_CARDS.VISA_APPROVED.number,
 *   cardType: TEST_CARDS.VISA_APPROVED.type,
 *   amount: '10.00',
 * });
 * ```
 */
export const TEST_CARDS = {
  /** Visa card that will be approved */
  VISA_APPROVED: {
    number: '4111111111111111',
    type: '001',
    brand: 'Visa',
  },
  /** Visa card that will be declined */
  VISA_DECLINED: {
    number: '4000000000000002',
    type: '001',
    brand: 'Visa',
  },
  /** Mastercard that will be approved */
  MASTERCARD_APPROVED: {
    number: '5555555555554444',
    type: '002',
    brand: 'Mastercard',
  },
  /** Mastercard that triggers 3DS challenge */
  MASTERCARD_3DS_CHALLENGE: {
    number: '5200000000000007',
    type: '002',
    brand: 'Mastercard',
  },
  /** Amex that will be approved */
  AMEX_APPROVED: {
    number: '378282246310005',
    type: '003',
    brand: 'Amex',
  },
} as const;

/**
 * Generates a unique test order ID with optional prefix.
 *
 * Format: `{prefix}-{timestamp}-{random}` (max 30 chars)
 *
 * @param prefix - Optional prefix (default: 'TEST')
 * @returns Unique order ID safe for testing
 *
 * @example
 * ```ts
 * generateTestOrderId();          // 'TEST-1710936000-a3f2'
 * generateTestOrderId('ORD');     // 'ORD-1710936000-b7c1'
 * ```
 */
export function generateTestOrderId(prefix = 'TEST'): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = randomBytes(2).toString('hex');
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generates a test webhook payload with a valid HMAC-SHA256 signature.
 *
 * Useful for testing webhook handlers without calling the real payment API.
 * The generated signature matches the format used by Yappy's IPN webhook.
 *
 * @param data - The webhook payload data
 * @param secretKey - The secret key for HMAC signing (base64 encoded for Yappy)
 * @param message - The message to sign (concatenation of fields)
 * @returns Object with the payload and its HMAC signature
 *
 * @example
 * ```ts
 * // Test Yappy webhook handler
 * const { payload, signature } = generateTestWebhookPayload(
 *   { orderId: 'TEST-001', status: 'E', domain: 'localhost' },
 *   process.env.CLAVE_SECRETA!,
 *   'TEST-001' + 'E' + 'localhost'
 * );
 *
 * // Call your webhook handler with the test data
 * const response = await request(app)
 *   .get(`/webhook?orderId=${payload.orderId}&status=${payload.status}&hash=${signature}&domain=${payload.domain}`);
 * ```
 */
export function generateTestWebhookPayload<T>(
  data: T,
  secretKey: string,
  message: string,
): { payload: T; signature: string } {
  const signature = createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  return { payload: data, signature };
}
