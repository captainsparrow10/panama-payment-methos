/**
 * @example Next.js App Router: Yappy order status endpoint for polling.
 *
 * GET /api/yappy/status/[orderId]
 *
 * Called by useYappyOrderStatus or useYappyPendingCheck to poll for payment status.
 * Returns the current status of the order from your database.
 *
 * Note: In a real app, use a dynamic route segment `[orderId]`.
 * This file shows a simplified version that reads orderId from the query string.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Extract orderId from the last path segment
  const segments = url.pathname.split('/');
  const orderId = segments[segments.length - 1];

  if (!orderId || orderId === 'status') {
    return NextResponse.json(
      { error: 'orderId is required' },
      { status: 400 },
    );
  }

  // TODO: Look up the order in your database
  // const order = await db.findOrder(orderId);
  // if (!order) {
  //   return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  // }

  // Example response:
  return NextResponse.json({
    status: 'pending', // 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'
    errorMessage: null,
    order: null, // Include order data when status is 'paid'
  });
}
