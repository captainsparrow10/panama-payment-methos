/**
 * Next.js API route for 3DS authentication validation.
 *
 * POST /api/cybersource/validate
 */

import { NextResponse } from 'next/server';
import {
  CyberSourceClient,
  CyberSourceEnvironment,
  CyberSourceError,
} from '@panama-payments/cybersource/server';

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

    const result = await client.validateAuthentication({
      authenticationTransactionId: body.authenticationTransactionId,
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
