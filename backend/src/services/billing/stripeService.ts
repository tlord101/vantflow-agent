/**
 * Stripe Integration Service
 * 
 * Handles all Stripe API interactions with retry logic and idempotency.
 */

import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import logger from '../../utils/logger';
import { PRICING_PLANS } from '../../config/pricing';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
  maxNetworkRetries: 3,
});

export interface CreateCustomerParams {
  organizationId: string;
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionParams {
  organizationId: string;
  priceId: string;
  trialDays?: number;
  paymentMethodId?: string;
  promoCode?: string;
}

export interface CreateCheckoutSessionParams {
  organizationId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  promoCode?: string;
}

export class StripeService {
  /**
   * Create or retrieve Stripe customer for organization
   */
  static async ensureCustomer(params: CreateCustomerParams): Promise<string> {
    const { organizationId, email, name, metadata = {} } = params;

    // Check if customer already exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (org?.stripeCustomerId) {
      logger.info(`Stripe customer already exists: ${org.stripeCustomerId}`);
      return org.stripeCustomerId;
    }

    try {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          organizationId,
          ...metadata,
        },
      });

      // Store customer ID
      await prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customer.id },
      });

      logger.info(`Created Stripe customer: ${customer.id} for org ${organizationId}`);
      return customer.id;
    } catch (error) {
      logger.error('Failed to create Stripe customer:', error);
      throw new Error('Failed to create Stripe customer');
    }
  }

  /**
   * Create a subscription
   */
  static async createSubscription(params: CreateSubscriptionParams) {
    const { organizationId, priceId, trialDays, paymentMethodId, promoCode } = params;

    const customerId = await this.ensureCustomer({
      organizationId,
      email: '', // Will be fetched from org
      name: '', // Will be fetched from org
    });

    try {
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        metadata: { organizationId },
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      };

      if (trialDays && trialDays > 0) {
        subscriptionParams.trial_period_days = trialDays;
      }

      if (paymentMethodId) {
        subscriptionParams.default_payment_method = paymentMethodId;
      }

      if (promoCode) {
        const promoCodes = await stripe.promotionCodes.list({ code: promoCode, active: true });
        if (promoCodes.data.length > 0) {
          subscriptionParams.promotion_code = promoCodes.data[0].id;
        }
      }

      const subscription = await stripe.subscriptions.create(subscriptionParams);

      // Create subscription record in database
      const planTier = this.getPlanTierFromPriceId(priceId);
      await prisma.subscription.create({
        data: {
          organizationId,
          stripeSubId: subscription.id,
          stripePriceId: priceId,
          planTier,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        },
      });

      logger.info(`Created subscription ${subscription.id} for org ${organizationId}`);
      return subscription;
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Create Checkout Session for new subscriptions
   */
  static async createCheckoutSession(params: CreateCheckoutSessionParams) {
    const { organizationId, priceId, successUrl, cancelUrl, trialDays, promoCode } = params;

    const customerId = await this.ensureCustomer({
      organizationId,
      email: '',
      name: '',
    });

    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { organizationId },
        subscription_data: {
          metadata: { organizationId },
        },
      };

      if (trialDays && trialDays > 0) {
        sessionParams.subscription_data!.trial_period_days = trialDays;
      }

      if (promoCode) {
        const promoCodes = await stripe.promotionCodes.list({ code: promoCode, active: true });
        if (promoCodes.data.length > 0) {
          sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
        }
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      logger.info(`Created checkout session ${session.id} for org ${organizationId}`);
      return session;
    } catch (error) {
      logger.error('Failed to create checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Generate Customer Portal URL for managing subscription
   */
  static async createPortalSession(organizationId: string, returnUrl: string): Promise<string> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org?.stripeCustomerId) {
      throw new Error('No Stripe customer found for organization');
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      logger.error('Failed to create portal session:', error);
      throw new Error('Failed to create portal session');
    }
  }

  /**
   * Cancel subscription (at period end or immediately)
   */
  static async cancelSubscription(subscriptionId: string, immediate = false) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription?.stripeSubId) {
        throw new Error('Subscription not found or no Stripe ID');
      }

      const updated = await stripe.subscriptions.update(subscription.stripeSubId, {
        cancel_at_period_end: !immediate,
      });

      if (immediate) {
        await stripe.subscriptions.cancel(subscription.stripeSubId);
      }

      // Update database
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd: !immediate,
          canceledAt: immediate ? new Date() : null,
          status: immediate ? 'canceled' : updated.status,
        },
      });

      logger.info(`Canceled subscription ${subscriptionId} (immediate: ${immediate})`);
      return updated;
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Update subscription (change plan)
   */
  static async updateSubscription(subscriptionId: string, newPriceId: string) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription?.stripeSubId) {
        throw new Error('Subscription not found');
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubId);
      const currentItemId = stripeSubscription.items.data[0].id;

      const updated = await stripe.subscriptions.update(subscription.stripeSubId, {
        items: [{
          id: currentItemId,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      // Update database
      const planTier = this.getPlanTierFromPriceId(newPriceId);
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          stripePriceId: newPriceId,
          planTier,
          status: updated.status,
        },
      });

      logger.info(`Updated subscription ${subscriptionId} to price ${newPriceId}`);
      return updated;
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  /**
   * Attach payment method to customer
   */
  static async attachPaymentMethod(organizationId: string, paymentMethodId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org?.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    try {
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: org.stripeCustomerId,
      });

      // Set as default
      await stripe.customers.update(org.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      logger.info(`Attached payment method ${paymentMethodId} to customer ${org.stripeCustomerId}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to attach payment method:', error);
      throw new Error('Failed to attach payment method');
    }
  }

  /**
   * Create one-off invoice
   */
  static async createInvoice(organizationId: string, amountCents: number, description: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org?.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    try {
      // Create invoice item
      await stripe.invoiceItems.create({
        customer: org.stripeCustomerId,
        amount: amountCents,
        currency: 'usd',
        description,
      });

      // Create and finalize invoice
      const invoice = await stripe.invoices.create({
        customer: org.stripeCustomerId,
        auto_advance: true,
        collection_method: 'charge_automatically',
      });

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

      logger.info(`Created invoice ${invoice.id} for org ${organizationId}`);
      return finalizedInvoice;
    } catch (error) {
      logger.error('Failed to create invoice:', error);
      throw new Error('Failed to create invoice');
    }
  }

  /**
   * Retrieve invoice
   */
  static async getInvoice(invoiceId: string) {
    try {
      return await stripe.invoices.retrieve(invoiceId);
    } catch (error) {
      logger.error('Failed to retrieve invoice:', error);
      throw new Error('Failed to retrieve invoice');
    }
  }

  /**
   * List payment methods for customer
   */
  static async listPaymentMethods(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org?.stripeCustomerId) {
      return [];
    }

    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: org.stripeCustomerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error('Failed to list payment methods:', error);
      return [];
    }
  }

  /**
   * Helper: Get plan tier from price ID
   */
  private static getPlanTierFromPriceId(priceId: string): string {
    for (const [tier, plan] of Object.entries(PRICING_PLANS)) {
      if (
        plan.stripePriceIdMonthly === priceId ||
        plan.stripePriceIdYearly === priceId
      ) {
        return tier;
      }
    }
    return 'free';
  }

  /**
   * Verify webhook signature
   */
  static constructWebhookEvent(payload: string | Buffer, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}

export default StripeService;
