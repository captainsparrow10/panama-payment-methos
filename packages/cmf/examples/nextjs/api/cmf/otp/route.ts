/**
 * Next.js App Router API routes for CMF OTP send and verify.
 *
 * Provides two actions via the request body:
 * - `action: 'send'` -- sends an OTP to the customer
 * - `action: 'verify'` -- verifies an OTP code
 *
 * @example
 * ```ts
 * // app/api/cmf/otp/route.ts
 * export { POST } from './route';
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { CMFClient, CMFError } from '@panama-payments/cmf/server';

const cmf = new CMFClient({
  baseUrl: process.env.CMF_URL!,
  email: process.env.CMF_EMAIL!,
  password: process.env.CMF_PASSWORD!,
  branchOfficeCode: process.env.CMF_BRANCH_OFFICE_CODE!,
  companyCode: process.env.CMF_COMPANY_CODE!,
  createdBy: process.env.CMF_CREATED_BY ?? 'system',
});

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: 'send' | 'verify';
      channel: 'email' | 'phone';
      destination: string;
      code?: string;
    };

    await cmf.ensureAuthenticated();

    if (body.action === 'send') {
      if (body.channel === 'email') {
        await cmf.sendOtpByEmail(body.destination);
      } else {
        await cmf.sendOtpByPhone(body.destination);
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === 'verify') {
      if (!body.code) {
        return NextResponse.json({ message: 'Code is required' }, { status: 400 });
      }
      if (body.channel === 'email') {
        await cmf.verifyOtpByEmail(body.destination, body.code);
      } else {
        await cmf.verifyOtpByPhone(body.destination, body.code);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    if (error instanceof CMFError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
