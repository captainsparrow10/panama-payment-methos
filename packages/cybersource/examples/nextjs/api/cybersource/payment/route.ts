/**
 * Next.js API route for payment processing.
 *
 * POST /api/cybersource/payment
 */

import { NextResponse } from 'next/server';
import {
  CyberSourceClient,
  CyberSourceEnvironment,
  CyberSourceError,
} from '@devhubpty/cybersource/server';

const client = new CyberSourceClient({
  merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
  keyId: process.env.CYBERSOURCE_KEY!,
  sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
  environment:
    process.env.CYBERSOURCE_RUN_ENVIRONMENT === 'api.cybersource.com'
      ? CyberSourceEnvironment.Production
      : CyberSourceEnvironment.Test,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await client.processPayment({
      totalAmount: body.amount,
      currency: body.currency,
      cybersourceCustomerId: body.cybersourceCustomerId,
      customerId: body.customerId,
      sessionId: body.sessionId,
      auth3DSResult: body.auth3DSResult,
      source: body.source || 'web',
      businessId: body.businessId,
      cardType: body.cardType,
      billTo: body.billTo,
    });

    return NextResponse.json({ status: 'success', data: result });
  } catch (error) {
    if (error instanceof CyberSourceError) {
      return NextResponse.json(
        { status: 'error', message: error.message, code: error.code },
        { status: error.httpStatus || 500 },
      );
    }
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 },
    );
  }
}
