/**
 * Billing Routes
 */

import express from 'express';
import { BillingController } from '../controllers/billingController';
import { authenticate } from '../middleware/auth';
import { checkActiveSubscription } from '../middleware/quotaEnforcement';
import StripeWebhookHandler from '../services/billing/webhookHandler';

const router = express.Router();

// Public routes
router.get('/plans', BillingController.getPlans);

// Webhook (must use raw body)
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  StripeWebhookHandler.handleWebhook
);

// Protected routes
router.use(authenticate);
router.use(checkActiveSubscription);

router.get('/subscription', BillingController.getSubscription);
router.post('/checkout', BillingController.createCheckout);
router.post('/portal', BillingController.createPortalSession);
router.post('/subscription/cancel', BillingController.cancelSubscription);

router.get('/usage', BillingController.getUsage);
router.get('/usage/:metric/history', BillingController.getUsageHistory);
router.get('/quota', BillingController.getQuota);

router.get('/invoices', BillingController.getInvoices);
router.get('/invoices/:id', BillingController.getInvoice);

router.get('/payment-methods', BillingController.getPaymentMethods);
router.post('/payment-methods', BillingController.addPaymentMethod);

export default router;
