/**
 * @example Next.js App Router: Yappy checkout API route.
 *
 * POST /api/yappy/checkout
 *
 * Called by the frontend to initiate a Yappy payment.
 * Returns the checkout result needed by the web component or custom UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { YappyClient, YappyError } from '@panama-payments/yappy/server';
import { createConsoleLogger } from '@panama-payments/core';

const yappy = new YappyClient(
  {
    merchantId: process.env.YAPPY_MERCHANT_ID!,
    urlDomain: process.env.YAPPY_URL_DOMAIN!,
    environment: (process.env.YAPPY_ENVIRONMENT as 'production' | 'sandbox') ?? 'sandbox',
  },
  {
    logger: createConsoleLogger({ level: 'info', prefix: '[yappy]' }),
    retry: { maxAttempts: 2 },
  },
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { total, subtotal, aliasYappy } = body;

    const result = await yappy.initCheckout({
      ipnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/yappy/webhook`,
      total: total ?? '0.01',
      subtotal: subtotal ?? total ?? '0.01',
      discount: '0.00',
      taxes: '0.00',
      aliasYappy,
    });

    // TODO: Save orderId to your database
    // await db.createPendingOrder({ orderId: result.orderId, ... });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return NextResponse.json({
      orderId: result.orderId,
      transactionId: result.transactionId,
      token: result.token,
      documentName: result.documentName,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof YappyError) {
      return NextResponse.json(
        { error: 'yappy_error', message: error.message, code: error.yappyErrorCode },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'internal', message: 'Error al iniciar pago con Yappy' },
      { status: 500 },
    );
  }
}
