/**
 * @example Express.js webhook handler for Yappy IPN notifications.
 *
 * Yappy sends payment results as GET requests to your ipnUrl.
 * This example validates the HMAC-SHA256 hash and processes the payment.
 *
 * @example
 * ```bash
 * # Environment variables needed:
 * CLAVE_SECRETA=your-base64-encoded-clave-secreta
 * ```
 */

import express from 'express';
import { validateYappyHash, parseYappyWebhook, YappyStatus } from '@devhubpty/yappy/server';

const app = express();

/**
 * GET /api/yappy/webhook
 *
 * Yappy sends: GET /api/yappy/webhook?orderId=X&status=E&hash=ABC&domain=Y
 *
 * This endpoint:
 * 1. Validates the HMAC-SHA256 hash to prevent spoofing
 * 2. Parses the query parameters into typed objects
 * 3. Processes the payment result based on status
 */
app.get('/api/yappy/webhook', async (req, res) => {
  const query = req.query as Record<string, string>;

  // Step 1: Validate the hash
  const result = validateYappyHash(query, process.env.CLAVE_SECRETA!);

  if (!result.valid) {
    console.error('Invalid Yappy webhook hash — possible spoofing attempt', {
      orderId: result.orderId,
      status: result.status,
    });
    return res.status(400).json({ error: 'Invalid hash' });
  }

  // Step 2: Parse the webhook payload (optional, for stricter typing)
  const payload = parseYappyWebhook(query);

  console.log('Yappy webhook received:', {
    orderId: payload.orderId,
    status: payload.status,
  });

  // Step 3: Process based on status
  switch (payload.status) {
    case YappyStatus.Executed:
      // Payment successful — fulfill the order
      // await db.updateOrderStatus(payload.orderId, 'paid');
      // await sendConfirmationEmail(payload.orderId);
      console.log(`Order ${payload.orderId}: Payment executed successfully`);
      break;

    case YappyStatus.Rejected:
      // Payment rejected — customer did not confirm in time
      // await db.updateOrderStatus(payload.orderId, 'failed');
      console.log(`Order ${payload.orderId}: Payment rejected`);
      break;

    case YappyStatus.Cancelled:
      // Payment cancelled by customer
      // await db.updateOrderStatus(payload.orderId, 'cancelled');
      console.log(`Order ${payload.orderId}: Payment cancelled`);
      break;

    case YappyStatus.Expired:
      // Payment expired — 5-minute window elapsed
      // await db.updateOrderStatus(payload.orderId, 'expired');
      console.log(`Order ${payload.orderId}: Payment expired`);
      break;
  }

  // Always respond 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

app.listen(3001);
