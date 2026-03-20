/**
 * Next.js API route for 3DS enrollment check.
 *
 * POST /api/cybersource/enroll
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

    const result = await client.checkEnrollment({
      referenceId: body.referenceId,
      cybersourceCustomerId: body.cybersourceCustomerId,
      amount: body.amount,
      currency: body.currency,
      billingAddress: body.billingAddress,
      returnUrl: body.returnUrl,
      sessionId: body.sessionId,
      deviceInfo: {
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        httpAcceptBrowserValue: request.headers.get('accept') || undefined,
        httpBrowserLanguage: request.headers.get('accept-language')?.split(',')[0] || 'en-US',
        userAgentBrowserValue: request.headers.get('user-agent') || undefined,
      },
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
