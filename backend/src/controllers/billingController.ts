/**
 * Billing Controller
 * 
 * Handles billing and subscription management endpoints.
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import StripeService from '../services/billing/stripeService';
import UsageMeteringService from '../services/billing/usageMeteringService';
import { getQuotaSummary } from '../middleware/quotaEnforcement';
import { PRICING_PLANS } from '../config/pricing';

export class BillingController {
  /**
   * GET /api/billing/plans
   * Get available pricing plans
   */
  static async getPlans(req: AuthRequest, res: Response) {
    try {
      const plans = Object.values(PRICING_PLANS).map(plan => ({
        tier: plan.tier,
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPriceCents,
        yearlyPrice: plan.yearlyPriceCents,
        quotas: plan.quotas,
        features: plan.quotas.features,
        popular: plan.popular,
        trialDays: plan.trialDays,
      }));

      res.json({ plans });
    } catch (error) {
      logger.error('Failed to get plans:', error);
      res.status(500).json({ error: 'Failed to get plans' });
    }
  }

  /**
   * GET /api/billing/subscription
   * Get current subscription details
   */
  static async getSubscription(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;

      const subscription = await prisma.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        res.json({ subscription: null, plan: PRICING_PLANS.free });
        return;
      }

      const plan = PRICING_PLANS[subscription.planTier] || PRICING_PLANS.free;

      res.json({
        subscription: {
          id: subscription.id,
          planTier: subscription.planTier,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEndsAt: subscription.trialEndsAt,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          canceledAt: subscription.canceledAt,
        },
        plan,
      });
    } catch (error) {
      logger.error('Failed to get subscription:', error);
      res.status(500).json({ error: 'Failed to get subscription' });
    }
  }

  /**
   * POST /api/billing/checkout
   * Create checkout session for new subscription
   */
  static async createCheckout(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { priceId, successUrl, cancelUrl, promoCode } = req.body;

      if (!priceId || !successUrl || !cancelUrl) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Get plan tier to determine trial days
      const plan = Object.values(PRICING_PLANS).find(
        p => p.stripePriceIdMonthly === priceId || p.stripePriceIdYearly === priceId
      );

      const session = await StripeService.createCheckoutSession({
        organizationId,
        priceId,
        successUrl,
        cancelUrl,
        trialDays: plan?.trialDays,
        promoCode,
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      logger.error('Failed to create checkout:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  /**
   * POST /api/billing/portal
   * Create Stripe Customer Portal session
   */
  static async createPortalSession(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { returnUrl } = req.body;

      if (!returnUrl) {
        res.status(400).json({ error: 'Missing returnUrl' });
        return;
      }

      const url = await StripeService.createPortalSession(organizationId, returnUrl);

      res.json({ url });
    } catch (error) {
      logger.error('Failed to create portal session:', error);
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  }

  /**
   * POST /api/billing/subscription/cancel
   * Cancel subscription
   */
  static async cancelSubscription(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { immediate } = req.body;

      const subscription = await prisma.subscription.findFirst({
        where: { organizationId, status: { in: ['active', 'trialing'] } },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        res.status(404).json({ error: 'No active subscription found' });
        return;
      }

      await StripeService.cancelSubscription(subscription.id, immediate === true);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }

  /**
   * GET /api/billing/usage
   * Get usage statistics
   */
  static async getUsage(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;

      const usageStats = await UsageMeteringService.getAllUsageStats(organizationId);

      res.json({ usage: usageStats });
    } catch (error) {
      logger.error('Failed to get usage:', error);
      res.status(500).json({ error: 'Failed to get usage' });
    }
  }

  /**
   * GET /api/billing/usage/:metric/history
   * Get usage history for a metric
   */
  static async getUsageHistory(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { metric } = req.params;
      const months = parseInt(req.query.months as string) || 6;

      const history = await UsageMeteringService.getUsageHistory(
        organizationId,
        metric,
        months
      );

      res.json({ history });
    } catch (error) {
      logger.error('Failed to get usage history:', error);
      res.status(500).json({ error: 'Failed to get usage history' });
    }
  }

  /**
   * GET /api/billing/quota
   * Get quota summary
   */
  static async getQuota(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;

      const quota = await getQuotaSummary(organizationId);

      res.json(quota);
    } catch (error) {
      logger.error('Failed to get quota:', error);
      res.status(500).json({ error: 'Failed to get quota' });
    }
  }

  /**
   * GET /api/billing/invoices
   * List invoices
   */
  static async getInvoices(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const limit = parseInt(req.query.limit as string) || 20;

      const invoices = await prisma.invoiceRecord.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json({ invoices });
    } catch (error) {
      logger.error('Failed to get invoices:', error);
      res.status(500).json({ error: 'Failed to get invoices' });
    }
  }

  /**
   * GET /api/billing/invoices/:id
   * Get invoice details
   */
  static async getInvoice(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { id } = req.params;

      const invoice = await prisma.invoiceRecord.findFirst({
        where: { id, organizationId },
      });

      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      res.json({ invoice });
    } catch (error) {
      logger.error('Failed to get invoice:', error);
      res.status(500).json({ error: 'Failed to get invoice' });
    }
  }

  /**
   * GET /api/billing/payment-methods
   * List payment methods
   */
  static async getPaymentMethods(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;

      const paymentMethods = await StripeService.listPaymentMethods(organizationId);

      res.json({ paymentMethods });
    } catch (error) {
      logger.error('Failed to get payment methods:', error);
      res.status(500).json({ error: 'Failed to get payment methods' });
    }
  }

  /**
   * POST /api/billing/payment-methods
   * Add payment method
   */
  static async addPaymentMethod(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.user!;
      const { paymentMethodId } = req.body;

      if (!paymentMethodId) {
        res.status(400).json({ error: 'Missing paymentMethodId' });
        return;
      }

      const paymentMethod = await StripeService.attachPaymentMethod(
        organizationId,
        paymentMethodId
      );

      res.json({ paymentMethod });
    } catch (error) {
      logger.error('Failed to add payment method:', error);
      res.status(500).json({ error: 'Failed to add payment method' });
    }
  }
}

export default BillingController;
