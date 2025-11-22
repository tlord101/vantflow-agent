/**
 * Billing Sync Cron Job
 * 
 * Reconciles billing data with Stripe, sends notifications, and handles overages.
 * Runs daily.
 */

import cron from 'node-cron';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import logger from '../../utils/logger';
import StripeService from '../../services/billing/stripeService';
import UsageMeteringService from '../../services/billing/usageMeteringService';
import { USAGE_METRICS, calculateOverageCost } from '../../config/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export class BillingSyncJob {
  private static isRunning = false;

  /**
   * Start the cron job (runs daily at 2 AM)
   */
  static start() {
    cron.schedule('0 2 * * *', async () => {
      logger.info('Starting billing sync job');
      await this.run();
    });

    logger.info('Billing sync cron job scheduled');
  }

  /**
   * Run sync job manually
   */
  static async run() {
    if (this.isRunning) {
      logger.warn('Billing sync job already running');
      return;
    }

    this.isRunning = true;

    try {
      await this.syncSubscriptions();
      await this.syncInvoices();
      await this.checkTrialExpirations();
      await this.checkPaymentFailures();
      await this.processOverages();
      await this.cleanupOldEvents();

      logger.info('Billing sync job completed successfully');
    } catch (error) {
      logger.error('Billing sync job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync subscription statuses with Stripe
   */
  private static async syncSubscriptions() {
    logger.info('Syncing subscriptions with Stripe...');

    const subscriptions = await prisma.subscription.findMany({
      where: {
        stripeSubId: { not: null },
        status: { in: ['active', 'trialing', 'past_due'] },
      },
    });

    let synced = 0;

    for (const sub of subscriptions) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubId!);

        // Update if status changed
        if (stripeSub.status !== sub.status) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: stripeSub.status,
              currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            },
          });

          logger.info(`Updated subscription ${sub.id}: ${sub.status} -> ${stripeSub.status}`);
          synced++;
        }
      } catch (error) {
        logger.error(`Failed to sync subscription ${sub.id}:`, error);
      }
    }

    logger.info(`Synced ${synced} subscriptions`);
  }

  /**
   * Sync invoice statuses with Stripe
   */
  private static async syncInvoices() {
    logger.info('Syncing invoices with Stripe...');

    const invoices = await prisma.invoiceRecord.findMany({
      where: {
        stripeInvoiceId: { not: null },
        status: { in: ['draft', 'open'] },
      },
      take: 100,
    });

    let synced = 0;

    for (const invoice of invoices) {
      try {
        const stripeInvoice = await stripe.invoices.retrieve(invoice.stripeInvoiceId!);

        if (stripeInvoice.status !== invoice.status) {
          await prisma.invoiceRecord.update({
            where: { id: invoice.id },
            data: {
              status: stripeInvoice.status || 'draft',
              paidAt: stripeInvoice.status === 'paid' ? new Date() : undefined,
              pdfUrl: stripeInvoice.invoice_pdf || undefined,
              hostedUrl: stripeInvoice.hosted_invoice_url || undefined,
            },
          });

          synced++;
        }
      } catch (error) {
        logger.error(`Failed to sync invoice ${invoice.id}:`, error);
      }
    }

    logger.info(`Synced ${synced} invoices`);
  }

  /**
   * Check for expiring trials and send notifications
   */
  private static async checkTrialExpirations() {
    logger.info('Checking trial expirations...');

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const expiringTrials = await prisma.subscription.findMany({
      where: {
        status: 'trialing',
        trialEndsAt: {
          lte: threeDaysFromNow,
          gte: new Date(),
        },
      },
      include: { organization: true },
    });

    for (const sub of expiringTrials) {
      const daysRemaining = Math.ceil(
        (sub.trialEndsAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      logger.info(`Trial expires in ${daysRemaining} days for org ${sub.organizationId}`);

      // TODO: Send trial expiration email
      // await sendTrialExpirationEmail(sub.organization, daysRemaining);
    }
  }

  /**
   * Check for payment failures and send reminders
   */
  private static async checkPaymentFailures() {
    logger.info('Checking payment failures...');

    const failedSubs = await prisma.subscription.findMany({
      where: { status: 'past_due' },
      include: { organization: true },
    });

    for (const sub of failedSubs) {
      logger.warn(`Payment past due for org ${sub.organizationId}`);

      // TODO: Send payment failure email
      // await sendPaymentFailureEmail(sub.organization);
    }
  }

  /**
   * Process usage overages and create invoices
   */
  private static async processOverages() {
    logger.info('Processing usage overages...');

    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trialing'] },
        planTier: { in: ['pro', 'business'] }, // Only paid plans have overage charges
      },
    });

    for (const sub of activeSubscriptions) {
      try {
        const usageStats = await UsageMeteringService.getAllUsageStats(sub.organizationId);
        let totalOverageCents = 0;
        const overageItems: Array<{ metric: string; overage: number; cost: number }> = [];

        for (const stat of usageStats) {
          if (stat.unlimited) continue;

          const overage = stat.current - stat.limit;
          if (overage > 0) {
            const cost = calculateOverageCost(sub.planTier, stat.metric, overage);
            if (cost > 0) {
              totalOverageCents += cost;
              overageItems.push({ metric: stat.metric, overage, cost });
            }
          }
        }

        // Create overage invoice if needed
        if (totalOverageCents > 100) { // Minimum $1.00 overage
          logger.info(`Creating overage invoice for org ${sub.organizationId}: $${totalOverageCents / 100}`);

          const description = `Usage overage for ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}\n` +
            overageItems.map(item => `- ${item.metric}: ${item.overage} units ($${item.cost / 100})`).join('\n');

          // Create invoice via Stripe
          await StripeService.createInvoice(
            sub.organizationId,
            totalOverageCents,
            description
          );
        }
      } catch (error) {
        logger.error(`Failed to process overages for org ${sub.organizationId}:`, error);
      }
    }
  }

  /**
   * Clean up old processed billing events
   */
  private static async cleanupOldEvents() {
    logger.info('Cleaning up old billing events...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.billingEvent.deleteMany({
      where: {
        processed: true,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    logger.info(`Deleted ${result.count} old billing events`);
  }
}

export default BillingSyncJob;
