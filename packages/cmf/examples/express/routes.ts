/**
 * Express routes for proxying CMF API calls.
 *
 * These routes sit between your React frontend and the CMF API.
 * The frontend calls these endpoints; these endpoints call CMFClient.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { cmfRouter } from './routes';
 *
 * const app = express();
 * app.use('/api/cmf', cmfRouter);
 * ```
 */

import { Router, type Request, type Response } from 'express';
import { CMFClient, CMFDocumentType, CMFError } from '@devhubpty/cmf/server';
import { createConsoleLogger } from '@devhubpty/core';

const router = Router();

// ── Initialize CMFClient (singleton) ────────────────────────────────────────

const cmf = new CMFClient(
  {
    baseUrl: process.env.CMF_URL!,
    email: process.env.CMF_EMAIL!,
    password: process.env.CMF_PASSWORD!,
    branchOfficeCode: process.env.CMF_BRANCH_OFFICE_CODE!,
    companyCode: process.env.CMF_COMPANY_CODE!,
    createdBy: process.env.CMF_CREATED_BY ?? 'system',
  },
  {
    logger: createConsoleLogger({ level: 'debug', prefix: '[cmf]' }),
  },
);

// ── POST /customer ──────────────────────────────────────────────────────────

router.post('/customer', async (req: Request, res: Response) => {
  try {
    const { docType, docNumber } = req.body;
    await cmf.ensureAuthenticated();

    const customer = await cmf.getCustomerByDocument(
      docType as CMFDocumentType,
      docNumber,
    );
    const products = await cmf.getCustomerProducts(customer.id);

    res.json({ customer, products });
  } catch (error) {
    if (error instanceof CMFError) {
      res.status(400).json({ message: error.message, code: error.code });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// ── POST /quotas ────────────────────────────────────────────────────────────

router.post('/quotas', async (req: Request, res: Response) => {
  try {
    const { customerProductId, amount } = req.body;
    await cmf.ensureAuthenticated();

    const quotas = await cmf.getQuotas(customerProductId, amount);
    res.json({ quotas });
  } catch (error) {
    if (error instanceof CMFError) {
      res.status(400).json({ message: error.message, code: error.code });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// ── POST /otp/send ──────────────────────────────────────────────────────────

router.post('/otp/send', async (req: Request, res: Response) => {
  try {
    const { channel, destination } = req.body;
    await cmf.ensureAuthenticated();

    if (channel === 'email') {
      await cmf.sendOtpByEmail(destination);
    } else {
      await cmf.sendOtpByPhone(destination);
    }
    res.json({ success: true });
  } catch (error) {
    if (error instanceof CMFError) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to send OTP' });
    }
  }
});

// ── POST /otp/verify ────────────────────────────────────────────────────────

router.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const { channel, destination, code } = req.body;
    await cmf.ensureAuthenticated();

    if (channel === 'email') {
      await cmf.verifyOtpByEmail(destination, code);
    } else {
      await cmf.verifyOtpByPhone(destination, code);
    }
    res.json({ success: true });
  } catch (error) {
    if (error instanceof CMFError) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'OTP verification failed' });
    }
  }
});

// ── POST /pay ───────────────────────────────────────────────────────────────

router.post('/pay', async (req: Request, res: Response) => {
  try {
    const params = req.body;
    await cmf.ensureAuthenticated();

    let result;
    if (params.mode === 'quotas') {
      result = await cmf.processPurchaseInQuotas({
        AccountNumber: params.accountNumber,
        UniqueCode: params.uniqueCode,
        Mto: params.amount,
        BranchOfficeCode: cmf.config.branchOfficeCode,
        CreatedBy: cmf.config.createdBy,
        CompanyCode: cmf.config.companyCode,
        ReceiptNumber: params.receiptNumber,
        Description: params.description,
        UserName: params.userName,
      });
    } else {
      result = await cmf.processNormalPurchase({
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
      });
    }

    res.json(result);
  } catch (error) {
    if (error instanceof CMFError) {
      res.status(400).json({ message: error.message, code: error.code });
    } else {
      res.status(500).json({ message: 'Payment processing failed' });
    }
  }
});

export { router as cmfRouter };
