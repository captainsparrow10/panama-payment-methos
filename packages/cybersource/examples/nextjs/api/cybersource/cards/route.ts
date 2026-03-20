/**
 * Next.js API route for card management (tokenization).
 *
 * POST /api/cybersource/cards   — Add a new card
 * DELETE /api/cybersource/cards — Delete a card (requires cardId in body)
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

    // Step 1: Create instrument identifier (tokenize the card)
    const instrumentIdentifier = await client.createInstrumentIdentifier({
      cardNumber: body.cardNumber,
      securityCode: body.securityCode,
    });

    // Step 2: Create payment instrument
    const paymentInstrument = await client.createPaymentInstrument({
      cybersourceCustomerId: body.cybersourceCustomerId,
      instrumentIdentifierTokenId: instrumentIdentifier.id,
      expirationMonth: body.expirationMonth,
      expirationYear: body.expirationYear,
      type: body.type,
      billTo: {
        firstName: body.firstName,
        lastName: body.lastName,
        address1: body.address1 || 'Panama',
        locality: body.city || 'Panama',
        country: 'PA',
        email: body.email,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: {
        paymentInstrumentId: paymentInstrument.id,
        last4: instrumentIdentifier.card.number.slice(-4),
        cardType: paymentInstrument.card.type,
        expirationMonth: paymentInstrument.card.expirationMonth,
        expirationYear: paymentInstrument.card.expirationYear,
      },
    });
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

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    await client.deleteCustomer(body.cybersourceCustomerId);

    return NextResponse.json({ status: 'success', message: 'Card deleted' });
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
