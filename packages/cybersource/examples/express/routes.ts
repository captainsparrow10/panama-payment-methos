/**
 * Express routes example for CyberSource integration.
 *
 * Demonstrates how to wire up the CyberSourceClient with Express routes
 * for the complete payment flow: card tokenization, 3DS authentication,
 * payment processing, refunds, and voids.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  CyberSourceClient,
  CyberSourceEnvironment,
  CyberSourceError,
} from '@devhubpty/cybersource/server';
import { createConsoleLogger } from '@devhubpty/core';

// --- Client setup ---

const client = new CyberSourceClient({
  merchantId: process.env.CYBERSOURCE_MERCHANT_ID!,
  keyId: process.env.CYBERSOURCE_KEY!,
  sharedSecretKey: process.env.CYBERSOURCE_SHARED_SECRET_KEY!,
  environment:
    process.env.CYBERSOURCE_RUN_ENVIRONMENT === 'api.cybersource.com'
      ? CyberSourceEnvironment.Production
      : CyberSourceEnvironment.Test,
  logger: createConsoleLogger({ level: 'debug', prefix: '[cybersource]' }),
});

const router = Router();

// --- Health check ---

router.get('/health', async (_req: Request, res: Response) => {
  const health = await client.ping();
  res.json(health);
});

// --- Customer management ---

router.post('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await client.createCustomer({
      customerId: req.body.customerId,
      email: req.body.email,
      phone: req.body.phone,
    });
    res.json({ status: 'success', data: customer });
  } catch (error) {
    next(error);
  }
});

router.delete('/customers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await client.deleteCustomer(req.params.id);
    res.json({ status: 'success', message: 'Customer deleted' });
  } catch (error) {
    next(error);
  }
});

// --- Card tokenization ---

router.post('/cards/tokenize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ii = await client.createInstrumentIdentifier({
      cardNumber: req.body.cardNumber,
      securityCode: req.body.securityCode,
    });

    const pi = await client.createPaymentInstrument({
      cybersourceCustomerId: req.body.cybersourceCustomerId,
      instrumentIdentifierTokenId: ii.id,
      expirationMonth: req.body.expirationMonth,
      expirationYear: req.body.expirationYear,
      type: req.body.type,
      billTo: req.body.billTo,
    });

    res.json({
      status: 'success',
      data: {
        instrumentIdentifier: ii,
        paymentInstrument: pi,
      },
    });
  } catch (error) {
    next(error);
  }
});

// --- 3DS authentication ---

router.post('/3ds/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await client.setupAuthentication({
      cybersourceCustomerId: req.body.cybersourceId,
      paymentInstrumentId: req.body.paymentInstrumentId,
      sessionId: req.body.sessionId,
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/3ds/enroll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await client.checkEnrollment({
      referenceId: req.body.referenceId,
      cybersourceCustomerId: req.body.cybersourceCustomerId,
      amount: req.body.amount,
      currency: req.body.currency,
      billingAddress: req.body.billingAddress,
      returnUrl: req.body.returnUrl,
      sessionId: req.body.sessionId,
      deviceInfo: {
        ipAddress: req.ip,
        httpAcceptBrowserValue: req.headers['accept'] as string,
        httpBrowserLanguage: (req.headers['accept-language'] as string)?.split(',')[0] || 'en-US',
        userAgentBrowserValue: req.headers['user-agent'] as string,
      },
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/3ds/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await client.validateAuthentication({
      authenticationTransactionId: req.body.authenticationTransactionId,
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

// --- Payment processing ---

router.post('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await client.processPayment({
      totalAmount: req.body.amount,
      currency: req.body.currency,
      cybersourceCustomerId: req.body.cybersourceCustomerId,
      customerId: req.body.customerId,
      sessionId: req.body.sessionId,
      auth3DSResult: req.body.auth3DSResult,
      source: req.body.source || 'web',
      businessId: req.body.businessId,
      cardType: req.body.cardType,
      billTo: req.body.billTo,
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/payments/:id/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await client.refundPayment({
      paymentId: req.params.id,
      amount: req.body.amount,
      currency: req.body.currency,
      codeReference: req.body.codeReference,
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/payments/:id/void', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await client.voidPayment({
      paymentId: req.params.id,
      codeReference: req.body.codeReference,
    });
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

// --- Error handler ---

router.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof CyberSourceError) {
    res.status(error.httpStatus || 500).json({
      status: 'error',
      message: error.message,
      code: error.code,
      processorCode: error.processorCode,
      retryable: error.retryable,
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
