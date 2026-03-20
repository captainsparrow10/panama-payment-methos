/**
 * Field names that contain PCI-sensitive data and must be redacted before logging.
 *
 * These fields will be masked to show only the last 4 characters:
 * - Full value: `4111111111111111`
 * - Redacted:   `****1111`
 *
 * Fields with 4 or fewer characters are fully masked as `****`.
 *
 * @example
 * ```ts
 * if (PCI_FIELDS.has('cardNumber')) {
 *   // field is PCI-sensitive, must be redacted
 * }
 * ```
 */
export const PCI_FIELDS: ReadonlySet<string> = new Set([
  // Card data
  'cardNumber',
  'card_number',
  'cardnumber',
  'securityCode',
  'security_code',
  'cvv',
  'cvv2',
  'cvc',
  'csc',
  'expirationMonth',
  'expirationYear',
  // Auth tokens & secrets
  'password',
  'token',
  'accessToken',
  'access_token',
  'sharedSecretKey',
  'shared_secret_key',
  'secretKey',
  'secret_key',
  'secret',
  'apiKey',
  'api_key',
  // 3DS authentication values
  'cavv',
  'xid',
  'pareq',
  'payload',
  // Yappy
  'claveSecreta',
  'clave_secreta',
]);

/**
 * Redacts PCI-sensitive fields from an object for safe logging.
 *
 * - String values: shows only last 4 chars (e.g., `"****1111"`)
 * - Short strings (<=4 chars): fully masked as `"****"`
 * - Nested objects: recursively sanitized
 * - Arrays: each element sanitized
 * - Non-object values: returned as-is
 *
 * **Always use this before logging any data that might contain PCI fields.**
 *
 * @param data - Object to sanitize (not mutated -- returns a new object)
 * @returns Deep copy with sensitive fields masked
 *
 * @example
 * ```ts
 * const safe = sanitize({ cardNumber: '4111111111111111', name: 'Juan' });
 * // -> { cardNumber: '****1111', name: 'Juan' }
 *
 * logger.debug('Payment request', sanitize(requestBody));
 * ```
 */
export function sanitize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    data as Record<string, unknown>,
  )) {
    if (PCI_FIELDS.has(key) && typeof value === 'string') {
      result[key] = value.length > 4 ? '****' + value.slice(-4) : '****';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitize(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Masks a card number for display purposes.
 * Shows only the last 4 digits, replacing the rest with asterisks.
 *
 * @param cardNumber - The full card number to mask
 * @returns The masked card number
 *
 * @example
 * ```ts
 * maskCardNumber('4111111111111111'); // '************1111'
 * maskCardNumber('1234');             // '1234' (already short)
 * ```
 */
export function maskCardNumber(cardNumber: string): string {
  if (cardNumber.length <= 4) return cardNumber;
  return '*'.repeat(cardNumber.length - 4) + cardNumber.slice(-4);
}
