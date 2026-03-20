/**
 * @example Express.js checkout endpoint for Yappy payments.
 *
 * This example shows how to:
 * 1. Initialize the YappyClient with credentials
 * 2. Create a checkout endpoint that your frontend calls
 * 3. Return the checkout result to the web component
 *
 * @example
 * ```bash
 * # Environment variables needed:
 * YAPPY_MERCHANT_ID=your-merchant-id
 * YAPPY_URL_DOMAIN=https://yourdomain.com
 * YAPPY_SECRET_KEY=your-base64-encoded-clave-secreta
 * YAPPY_ENVIRONMENT=sandbox  # or 'production'
 * BASE_URL=https://api.yourdomain.com
 * ```
 */

import express from 'express';
import { YappyClient, generateOrderId, YappyError } from '@panama-payments/yappy/server';
import { createConsoleLogger } from '@panama-payments/core';

const app = express();
app.use(express.json());

// Initialize the Yappy client once at startup
const yappy = new YappyClient(
  {
    merchantId: process.env.YAPPY_MERCHANT_ID!,
    urlDomain: process.env.YAPPY_URL_DOMAIN!,
    environment: (process.env.YAPPY_ENVIRONMENT as 'production' | 'sandbox') ?? 'sandbox',
  },
  {
    logger: createConsoleLogger({ level: 'debug', prefix: '[yappy]' }),
    retry: { maxAttempts: 2 },
  },
);

/**
 * POST /api/yappy/checkout
 *
 * Called by the frontend (YappyButton, useYappyCheckout, or initYappyButton)
 * to initiate a Yappy payment.
 *
 * Request body:
 * - total: string (e.g., "25.00")
 * - subtotal: string (e.g., "25.00")
 * - aliasYappy?: string (customer phone, e.g., "60800011")
 *
 * Response:
 * - orderId: string (15-char alphanumeric)
 * - transactionId: string
 * - token: string
 * - documentName: string
 * - expiresAt: string (ISO 8601)
 */
app.post('/api/yappy/checkout', async (req, res) => {
  try {
    const { total, subtotal, aliasYappy } = req.body;

    const result = await yappy.initCheckout({
      ipnUrl: `${process.env.BASE_URL}/api/yappy/webhook`,
      total: total ?? '0.01',
      subtotal: subtotal ?? total ?? '0.01',
      discount: '0.00',
      taxes: '0.00',
      aliasYappy,
    });

    // IMPORTANT: Save the orderId to your database before responding.
    // Your webhook handler will need to look up this orderId.
    // await db.savePendingOrder({
    //   orderId: result.orderId,
    //   transactionId: result.transactionId,
    //   status: 'pending',
    //   expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    // });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    res.json({
      orderId: result.orderId,
      transactionId: result.transactionId,
      token: result.token,
      documentName: result.documentName,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof YappyError) {
      res.status(400).json({
        error: 'yappy_error',
        message: error.message,
        code: error.yappyErrorCode,
      });
    } else {
      res.status(500).json({
        error: 'internal',
        message: 'Error al iniciar pago con Yappy',
      });
    }
  }
});

app.listen(3001, () => {
  console.log('Yappy checkout server running on http://localhost:3001');
});
