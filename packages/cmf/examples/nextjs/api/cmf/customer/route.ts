/**
 * Next.js App Router API route for CMF customer lookup.
 *
 * Accepts a POST with `{ docType, docNumber }` and returns the customer
 * record plus their active CMF products.
 *
 * @example
 * ```ts
 * // app/api/cmf/customer/route.ts
 * export { POST } from './route';
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { CMFClient, CMFDocumentType, CMFError } from '@devhubpty/cmf/server';

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
    const { docType, docNumber } = (await request.json()) as {
      docType: string;
      docNumber: string;
    };

    await cmf.ensureAuthenticated();

    const customer = await cmf.getCustomerByDocument(
      docType as CMFDocumentType,
      docNumber,
    );
    const products = await cmf.getCustomerProducts(customer.id);

    return NextResponse.json({ customer, products });
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
