/**
 * Complete installment (quota) purchase flow using CMFClient.
 *
 * This example shows the full server-side flow for processing a
 * CMF financing purchase in a standalone script.
 *
 * @example
 * ```bash
 * # Set environment variables and run
 * CMF_URL=https://qa-... CMF_EMAIL=... CMF_PASSWORD=... npx ts-node flow-installment.ts
 * ```
 */

import { CMFClient, CMFDocumentType, CMFError } from '@panama-payments/cmf/server';
import { createConsoleLogger } from '@panama-payments/core';

async function main() {
  // 1. Initialize the client
  const cmf = new CMFClient(
    {
      baseUrl: process.env.CMF_URL!,
      email: process.env.CMF_EMAIL!,
      password: process.env.CMF_PASSWORD!,
      branchOfficeCode: process.env.CMF_BRANCH_OFFICE_CODE ?? 'MKP',
      companyCode: process.env.CMF_COMPANY_CODE ?? 'MKP',
      createdBy: 'system',
    },
    {
      logger: createConsoleLogger({ level: 'debug', prefix: '[cmf]' }),
      retry: { maxAttempts: 3 },
    },
  );

  // 2. Authenticate
  await cmf.ensureAuthenticated();
  console.log('Authenticated with CMF API');

  // 3. Health check
  const health = await cmf.ping();
  console.log('Health check:', health.reachable ? 'OK' : 'FAIL', `(${health.latencyMs}ms)`);

  // 4. Look up customer
  const customer = await cmf.getCustomerByDocument(
    CMFDocumentType.Cedula,
    '8-123-456',
  );
  console.log(`Customer: ${customer.fullName} (${customer.id})`);

  // 5. Get products
  const products = await cmf.getCustomerProducts(customer.id);
  if (products.length === 0) {
    throw new Error('Customer has no active CMF products');
  }
  const product = products[0];
  console.log(`Product: ${product.productName} (${product.customerAccountCards.length} cards)`);

  // 6. Simulate quotas
  const purchaseAmount = 500;
  const quotas = await cmf.getQuotas(product.customerProductId, purchaseAmount);
  const sorted = quotas.sort((a, b) => a.loanTerm - b.loanTerm);
  console.log(`Available plans (${sorted.length}):`);
  sorted.forEach((plan) => {
    console.log(`  ${plan.loanTerm} months at $${plan.monthlyQuota.toFixed(2)}/month`);
  });

  // 7. Select a plan (12 months)
  const selectedPlan = sorted.find((q) => q.loanTerm === 12);
  if (!selectedPlan) {
    throw new Error('No 12-month plan available');
  }

  // 8. Process the purchase
  const receiptNumber = `ORDER-${Date.now()}${Math.floor(Math.random() * 1000)}`;
  try {
    const result = await cmf.processPurchaseInQuotas(
      {
        AccountNumber: product.productAccount,
        UniqueCode: selectedPlan.uniqueCode,
        Mto: purchaseAmount,
        BranchOfficeCode: cmf.config.branchOfficeCode,
        CreatedBy: cmf.config.createdBy,
        CompanyCode: cmf.config.companyCode,
        ReceiptNumber: receiptNumber,
        Description: 'Test installment purchase',
        UserName: customer.email,
      },
      { idempotencyKey: `test-${receiptNumber}` },
    );
    console.log('Purchase successful!', {
      receiptNumber,
      cmfCode: result.uniqueCode,
      complete: result.complete,
    });
  } catch (error) {
    if (error instanceof CMFError) {
      console.error('CMF business error:', {
        message: error.message,
        code: error.code,
        statusResult: error.statusResult,
      });
    } else {
      throw error;
    }
  }

  // 9. Verify the transaction
  const verification = await cmf.verifyTransaction(receiptNumber);
  console.log('Transaction verified:', verification.complete);
}

main().catch(console.error);
