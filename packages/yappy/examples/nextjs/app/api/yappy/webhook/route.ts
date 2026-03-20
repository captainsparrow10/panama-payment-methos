/**
 * @example Next.js App Router: Yappy IPN webhook handler.
 *
 * GET /api/yappy/webhook?orderId=X&status=E&hash=ABC&domain=Y
 *
 * Yappy sends payment results as GET requests to this endpoint.
 * Validates the HMAC-SHA256 hash and processes the payment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateYappyHash, YappyStatus } from '@panama-payments/yappy/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Step 1: Validate the hash
  const result = validateYappyHash(query, process.env.CLAVE_SECRETA!);

  if (!result.valid) {
    console.error('Invalid Yappy webhook hash', { orderId: result.orderId });
    return NextResponse.json({ error: 'Invalid hash' }, { status: 400 });
  }

  // Step 2: Process based on status
  switch (result.status) {
    case YappyStatus.Executed:
      // await db.updateOrderStatus(result.orderId, 'paid');
      console.log(`Order ${result.orderId}: Payment executed`);
      break;

    case YappyStatus.Rejected:
      // await db.updateOrderStatus(result.orderId, 'failed');
      console.log(`Order ${result.orderId}: Payment rejected`);
      break;

    case YappyStatus.Cancelled:
      // await db.updateOrderStatus(result.orderId, 'cancelled');
      console.log(`Order ${result.orderId}: Payment cancelled`);
      break;

    case YappyStatus.Expired:
      // await db.updateOrderStatus(result.orderId, 'expired');
      console.log(`Order ${result.orderId}: Payment expired`);
      break;
  }

  return NextResponse.json({ received: true });
}
