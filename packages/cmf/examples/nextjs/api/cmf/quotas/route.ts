/**
 * Next.js App Router API route for CMF quota simulation.
 *
 * Accepts a POST with `{ customerProductId, amount }` and returns
 * the available financing plans.
 *
 * @example
 * ```ts
 * // app/api/cmf/quotas/route.ts
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
    const { customerProductId, amount } = (await request.json()) as {
      customerProductId: string;
      amount: number;
    };

    await cmf.ensureAuthenticated();

    const quotas = await cmf.getQuotas(customerProductId, amount);
    const sorted = quotas.sort((a, b) => a.loanTerm - b.loanTerm);

    return NextResponse.json({ quotas: sorted });
  } catch (error) {
    if (error instanceof CMFError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: 'Failed to fetch quotas' },
      { status: 500 },
    );
  }
}
