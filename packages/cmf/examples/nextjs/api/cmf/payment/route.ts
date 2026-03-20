/**
 * Next.js App Router API route for processing CMF payments.
 *
 * Accepts CMFPaymentParams and routes to the appropriate CMFClient method
 * based on `params.mode`.
 *
 * @example
 * ```ts
 * // app/api/cmf/payment/route.ts
 * export { POST } from './route';
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { CMFClient, CMFError } from '@panama-payments/cmf/server';
import type { CMFPaymentParams } from '@panama-payments/cmf/react';

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
    const params = (await request.json()) as CMFPaymentParams;
    await cmf.ensureAuthenticated();

    let result;

    if (params.mode === 'quotas') {
      result = await cmf.processPurchaseInQuotas(
        {
          AccountNumber: params.accountNumber,
          UniqueCode: params.uniqueCode,
          Mto: params.amount,
          BranchOfficeCode: cmf.config.branchOfficeCode,
          CreatedBy: cmf.config.createdBy,
          CompanyCode: cmf.config.companyCode,
          ReceiptNumber: params.receiptNumber,
          Description: params.description,
          UserName: params.userName,
        },
        { idempotencyKey: `payment-${params.receiptNumber}` },
      );
    } else {
      result = await cmf.processNormalPurchase(
        {
          BranchOfficeCode: cmf.config.branchOfficeCode,
          CreatedBy: cmf.config.createdBy,
          CompanyCode: cmf.config.companyCode,
          CardNumber: params.cardNumber,
          MtoTran: params.amount,
          ReceiptNumber: params.receiptNumber,
          Description: params.description,
          UserName: params.userName,
          MovementType: 2,
          PaymentCashAmount: 0,
          WithdrawalFee: 0,
        },
        { idempotencyKey: `payment-${params.receiptNumber}` },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CMFError) {
      return NextResponse.json(
        { message: error.message, code: error.code, statusResult: error.statusResult },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: 'Payment processing failed' },
      { status: 500 },
    );
  }
}
