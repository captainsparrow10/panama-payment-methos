/**
 * @example Next.js App Router: Yappy order cancellation endpoint.
 *
 * POST /api/yappy/cancel/[orderId]
 *
 * Called by useYappyPendingCheck when the user cancels a pending payment.
 * Updates the order status in your database.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const orderId = segments[segments.length - 1];

  if (!orderId || orderId === 'cancel') {
    return NextResponse.json(
      { error: 'orderId is required' },
      { status: 400 },
    );
  }

  // TODO: Update order status in your database
  // const order = await db.findOrder(orderId);
  // if (order && order.status === 'pending') {
  //   await db.updateOrderStatus(orderId, 'cancelled');
  // }

  return NextResponse.json({
    status: 'success',
    message: 'Orden cancelada correctamente',
  });
}
