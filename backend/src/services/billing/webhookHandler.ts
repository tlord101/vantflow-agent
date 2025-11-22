/**
 * Stripe Webhook Handler
 * 
 * Processes Stripe webhook events with idempotency and error handling.
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import logger from '../../utils/logger';
import StripeService from './stripeService';
import { io } from '../../index';

export class StripeWebhookHandler {
  /**
   * Main webhook endpoint handler
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['stripe-signature'];

    if (!signature || Array.isArray(signature)) {
      res.status(400).send('Missing or invalid stripe-signature header');
      return;
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = StripeService.constructWebhookEvent(req.body, signature);
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    // Check for duplicate events (idempotency)
    const existingEvent = await prisma.billingEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existingEvent) {
      logger.info(`Duplicate webhook event: ${event.id}`);
      res.json({ received: true, duplicate: true });
      return;
    }

    // Store event for processing
    const billingEvent = await prisma.billingEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        payload: event as any,
        processed: false,
      },
    });

    // Process event asynchronously
    this.processEvent(billingEvent.id, event).catch((error) => {
      logger.error(`Failed to process webhook event ${event.id}:`, error);
    });

    // Acknowledge receipt immediately
    res.json({ received: true });
  }

  /**
   * Process webhook event
   */
  private static async processEvent(billingEventId: string, event: Stripe.Event): Promise<void> {
    try {
      logger.info(`Processing webhook event: ${event.type}`);

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.created':
          await this.handleInvoiceCreated(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.finalized':
          await this.handleInvoiceFinalized(event.data.object as Stripe.Invoice);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      // Mark event as processed
      await prisma.billingEvent.update({
        where: { id: billingEventId },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      logger.info(`Successfully processed webhook event: ${event.type}`);
    } catch (error) {
      logger.error(`Error processing webhook event ${event.type}:`, error);

      // Update retry count
      const billingEvent = await prisma.billingEvent.findUnique({
        where: { id: billingEventId },
      });

      await prisma.billingEvent.update({
        where: { id: billingEventId },
        data: {
          retryCount: (billingEvent?.retryCount || 0) + 1,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Handle checkout.session.completed
   */
  private static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId = session.metadata?.organizationId;
    if (!organizationId) {
      logger.warn('No organizationId in checkout session metadata');
      return;
    }

    logger.info(`Checkout completed for org ${organizationId}`);

    // Subscription will be handled by subscription.created event
    // Just emit notification here
    io.to(`org:${organizationId}`).emit('checkout:completed', {
      sessionId: session.id,
      subscriptionId: session.subscription,
    });
  }

  /**
   * Handle subscription created/updated
   */
  private static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) {
      logger.warn('No organizationId in subscription metadata');
      return;
    }

    const priceId = subscription.items.data[0]?.price.id;
    const planTier = this.getPlanTierFromPriceId(priceId);

    // Upsert subscription
    await prisma.subscription.upsert({
      where: { stripeSubId: subscription.id },
      create: {
        organizationId,
        stripeSubId: subscription.id,
        stripePriceId: priceId,
        planTier,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        stripePriceId: priceId,
        planTier,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    // Update billing event with org ID
    await this.updateBillingEventOrg(subscription.id, organizationId);

    // Emit notification
    io.to(`org:${organizationId}`).emit('subscription:updated', {
      subscriptionId: subscription.id,
      status: subscription.status,
      planTier,
    });

    logger.info(`Subscription updated for org ${organizationId}: ${subscription.status}`);
  }

  /**
   * Handle subscription deleted
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const dbSub = await prisma.subscription.findUnique({
      where: { stripeSubId: subscription.id },
    });

    if (!dbSub) {
      logger.warn(`Subscription not found in DB: ${subscription.id}`);
      return;
    }

    await prisma.subscription.update({
      where: { stripeSubId: subscription.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
    });

    io.to(`org:${dbSub.organizationId}`).emit('subscription:canceled', {
      subscriptionId: subscription.id,
    });

    logger.info(`Subscription canceled: ${subscription.id}`);
  }

  /**
   * Handle invoice.created
   */
  private static async handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.customer || typeof invoice.customer !== 'string') return;

    const org = await prisma.organization.findUnique({
      where: { stripeCustomerId: invoice.customer },
    });

    if (!org) {
      logger.warn(`Organization not found for customer ${invoice.customer}`);
      return;
    }

    // Create invoice record
    await prisma.invoiceRecord.create({
      data: {
        organizationId: org.id,
        stripeInvoiceId: invoice.id,
        invoiceNumber: invoice.number || undefined,
        amountCents: invoice.amount_due,
        taxCents: invoice.tax || 0,
        totalCents: invoice.total,
        currency: invoice.currency,
        status: invoice.status || 'draft',
        description: invoice.description || undefined,
        lineItems: invoice.lines.data as any,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
      },
    });

    logger.info(`Invoice created: ${invoice.id} for org ${org.id}`);
  }

  /**
   * Handle invoice.paid
   */
  private static async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    await prisma.invoiceRecord.updateMany({
      where: { stripeInvoiceId: invoice.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        pdfUrl: invoice.invoice_pdf || undefined,
        hostedUrl: invoice.hosted_invoice_url || undefined,
      },
    });

    const dbInvoice = await prisma.invoiceRecord.findUnique({
      where: { stripeInvoiceId: invoice.id },
    });

    if (dbInvoice) {
      io.to(`org:${dbInvoice.organizationId}`).emit('invoice:paid', {
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
      });

      // TODO: Send email receipt
      logger.info(`Invoice paid: ${invoice.id}`);
    }
  }

  /**
   * Handle invoice.payment_failed
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    await prisma.invoiceRecord.updateMany({
      where: { stripeInvoiceId: invoice.id },
      data: { status: 'open' },
    });

    const dbInvoice = await prisma.invoiceRecord.findUnique({
      where: { stripeInvoiceId: invoice.id },
    });

    if (dbInvoice) {
      io.to(`org:${dbInvoice.organizationId}`).emit('invoice:payment_failed', {
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
      });

      // TODO: Send payment failure email
      logger.warn(`Invoice payment failed: ${invoice.id}`);
    }
  }

  /**
   * Handle invoice.finalized
   */
  private static async handleInvoiceFinalized(invoice: Stripe.Invoice): Promise<void> {
    await prisma.invoiceRecord.updateMany({
      where: { stripeInvoiceId: invoice.id },
      data: {
        status: 'open',
        pdfUrl: invoice.invoice_pdf || undefined,
        hostedUrl: invoice.hosted_invoice_url || undefined,
      },
    });

    logger.info(`Invoice finalized: ${invoice.id}`);
  }

  /**
   * Handle payment_intent.succeeded
   */
  private static async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info(`Payment succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount}`);
  }

  /**
   * Handle payment_intent.payment_failed
   */
  private static async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.warn(`Payment failed: ${paymentIntent.id}, error: ${paymentIntent.last_payment_error?.message}`);
  }

  /**
   * Handle charge.refunded
   */
  private static async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    logger.info(`Charge refunded: ${charge.id}, amount: ${charge.amount_refunded}`);
    
    // TODO: Create credit record for refund
  }

  /**
   * Helper: Get plan tier from price ID
   */
  private static getPlanTierFromPriceId(priceId: string): string {
    // Import pricing config
    const { PRICING_PLANS } = require('../../config/pricing');
    
    for (const [tier, plan] of Object.entries(PRICING_PLANS)) {
      const planConfig = plan as any;
      if (
        planConfig.stripePriceIdMonthly === priceId ||
        planConfig.stripePriceIdYearly === priceId
      ) {
        return tier;
      }
    }
    return 'free';
  }

  /**
   * Update billing event with organization ID
   */
  private static async updateBillingEventOrg(stripeId: string, organizationId: string): Promise<void> {
    await prisma.billingEvent.updateMany({
      where: {
        stripeEventId: { contains: stripeId },
        organizationId: null,
      },
      data: { organizationId },
    });
  }
}

export default StripeWebhookHandler;
