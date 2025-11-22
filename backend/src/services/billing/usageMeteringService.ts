/**
 * Usage Metering Service
 * 
 * Tracks usage metrics (tokens, run minutes, screenshots) with Redis for real-time
 * atomic increments and periodic flushing to PostgreSQL.
 */

import Redis from 'ioredis';
import { prisma } from '../../lib/prisma';
import logger from '../../utils/logger';
import { USAGE_METRICS, getQuotaLimit, isUnlimitedQuota, QUOTA_WARNING_THRESHOLDS } from '../../config/pricing';
import { io } from '../../index';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('connect', () => {
  logger.info('Redis connected for usage metering');
});

export interface IncrementUsageParams {
  organizationId: string;
  projectId?: string;
  metric: string;
  amount: number;
  metadata?: Record<string, any>;
}

export interface UsageStats {
  metric: string;
  current: number;
  limit: number;
  percentage: number;
  unlimited: boolean;
  periodStart: Date;
  periodEnd: Date;
}

export class UsageMeteringService {
  /**
   * Get Redis key for usage counter
   */
  private static getUsageKey(organizationId: string, metric: string, period?: string): string {
    const currentPeriod = period || this.getCurrentPeriod();
    return `usage:org:${organizationId}:metric:${metric}:${currentPeriod}`;
  }

  /**
   * Get current billing period (YYYY-MM format)
   */
  private static getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get period start and end dates
   */
  private static getPeriodDates(period?: string): { start: Date; end: Date } {
    const currentPeriod = period || this.getCurrentPeriod();
    const [year, month] = currentPeriod.split('-').map(Number);
    
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    
    return { start, end };
  }

  /**
   * Atomically increment usage counter
   */
  static async incrementUsage(params: IncrementUsageParams): Promise<number> {
    const { organizationId, projectId, metric, amount, metadata } = params;

    if (amount <= 0) {
      logger.warn(`Invalid usage amount: ${amount}`);
      return 0;
    }

    try {
      const key = this.getUsageKey(organizationId, metric);
      const newValue = await redis.incrby(key, amount);

      // Set expiry to 90 days (keep data for reconciliation)
      await redis.expire(key, 90 * 24 * 60 * 60);

      logger.debug(`Incremented ${metric} by ${amount} for org ${organizationId}: ${newValue}`);

      // Check quota and emit warnings
      await this.checkQuotaWarnings(organizationId, metric, newValue);

      // Store metadata for later flush (optional)
      if (metadata) {
        const metaKey = `${key}:meta:${Date.now()}`;
        await redis.setex(metaKey, 24 * 60 * 60, JSON.stringify({ projectId, ...metadata }));
      }

      return newValue;
    } catch (error) {
      logger.error('Failed to increment usage:', error);
      // Fallback: still track in DB even if Redis fails
      await this.fallbackIncrementToDB(params);
      throw error;
    }
  }

  /**
   * Get current usage for a metric
   */
  static async getUsage(
    organizationId: string,
    metric: string,
    period?: string
  ): Promise<number> {
    try {
      const key = this.getUsageKey(organizationId, metric, period);
      const value = await redis.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.error('Failed to get usage from Redis:', error);
      // Fallback to DB
      return await this.getUsageFromDB(organizationId, metric, period);
    }
  }

  /**
   * Get usage statistics with quota information
   */
  static async getUsageStats(organizationId: string, metric: string): Promise<UsageStats> {
    const current = await this.getUsage(organizationId, metric);
    
    // Get subscription to determine plan tier
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId, status: { in: ['active', 'trialing'] } },
      orderBy: { createdAt: 'desc' },
    });

    const tier = subscription?.planTier || 'free';
    const limit = getQuotaLimit(tier, metric);
    const unlimited = isUnlimitedQuota(limit);
    
    const { start, end } = this.getPeriodDates();
    
    return {
      metric,
      current,
      limit: unlimited ? -1 : limit,
      percentage: unlimited ? 0 : (current / limit) * 100,
      unlimited,
      periodStart: start,
      periodEnd: end,
    };
  }

  /**
   * Get all usage stats for an organization
   */
  static async getAllUsageStats(organizationId: string): Promise<UsageStats[]> {
    const metrics = Object.values(USAGE_METRICS);
    return Promise.all(
      metrics.map((metric) => this.getUsageStats(organizationId, metric))
    );
  }

  /**
   * Check if usage exceeds quota
   */
  static async isQuotaExceeded(
    organizationId: string,
    metric: string,
    additionalAmount = 0
  ): Promise<boolean> {
    const stats = await this.getUsageStats(organizationId, metric);
    
    if (stats.unlimited) {
      return false;
    }

    return (stats.current + additionalAmount) > stats.limit;
  }

  /**
   * Check quota warnings and emit events
   */
  private static async checkQuotaWarnings(
    organizationId: string,
    metric: string,
    currentUsage: number
  ): Promise<void> {
    const stats = await this.getUsageStats(organizationId, metric);
    
    if (stats.unlimited) {
      return;
    }

    const percentage = stats.percentage;
    
    // Emit warning events
    if (percentage >= QUOTA_WARNING_THRESHOLDS.CRITICAL * 100) {
      io.to(`org:${organizationId}`).emit('quota:critical', {
        metric,
        current: currentUsage,
        limit: stats.limit,
        percentage,
      });
    } else if (percentage >= QUOTA_WARNING_THRESHOLDS.WARNING * 100) {
      io.to(`org:${organizationId}`).emit('quota:warning', {
        metric,
        current: currentUsage,
        limit: stats.limit,
        percentage,
      });
    }
  }

  /**
   * Flush Redis counters to database (called by cron job)
   */
  static async flushToDatabase(period?: string): Promise<void> {
    const currentPeriod = period || this.getCurrentPeriod();
    const { start, end } = this.getPeriodDates(currentPeriod);
    
    logger.info(`Flushing usage data for period ${currentPeriod}`);

    try {
      // Scan for all usage keys
      const pattern = `usage:org:*:metric:*:${currentPeriod}`;
      const keys = await this.scanKeys(pattern);

      let flushed = 0;
      
      for (const key of keys) {
        const parts = key.split(':');
        if (parts.length < 6) continue;
        
        const organizationId = parts[2];
        const metric = parts[4];
        
        const value = await redis.get(key);
        if (!value) continue;
        
        const quantity = parseInt(value, 10);
        
        // Get subscription
        const subscription = await prisma.subscription.findFirst({
          where: { organizationId, status: { in: ['active', 'trialing', 'past_due'] } },
          orderBy: { createdAt: 'desc' },
        });

        if (!subscription) {
          logger.warn(`No subscription found for org ${organizationId}`);
          continue;
        }

        // Create or update usage record
        await prisma.usageRecord.upsert({
          where: {
            subscriptionId_metric_periodStart: {
              subscriptionId: subscription.id,
              metric,
              periodStart: start,
            },
          },
          create: {
            subscriptionId: subscription.id,
            organizationId,
            metric,
            quantity: BigInt(quantity),
            periodStart: start,
            periodEnd: end,
          },
          update: {
            quantity: BigInt(quantity),
            periodEnd: end,
          },
        });

        flushed++;
      }

      logger.info(`Flushed ${flushed} usage records to database`);
    } catch (error) {
      logger.error('Failed to flush usage data:', error);
      throw error;
    }
  }

  /**
   * Reset usage counters for new period (called at period boundary)
   */
  static async resetCounters(period: string): Promise<void> {
    try {
      const pattern = `usage:org:*:metric:*:${period}`;
      const keys = await this.scanKeys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Reset ${keys.length} usage counters for period ${period}`);
      }
    } catch (error) {
      logger.error('Failed to reset counters:', error);
    }
  }

  /**
   * Helper: Scan Redis keys
   */
  private static async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, matchedKeys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...matchedKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Fallback: Increment directly to DB if Redis fails
   */
  private static async fallbackIncrementToDB(params: IncrementUsageParams): Promise<void> {
    const { organizationId, projectId, metric, amount, metadata } = params;
    const { start, end } = this.getPeriodDates();

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId, status: { in: ['active', 'trialing'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      logger.warn(`No subscription for fallback increment: org ${organizationId}`);
      return;
    }

    await prisma.usageRecord.upsert({
      where: {
        subscriptionId_metric_periodStart: {
          subscriptionId: subscription.id,
          metric,
          periodStart: start,
        },
      },
      create: {
        subscriptionId: subscription.id,
        organizationId,
        projectId,
        metric,
        quantity: BigInt(amount),
        periodStart: start,
        periodEnd: end,
        metadata: metadata as any,
      },
      update: {
        quantity: { increment: amount },
      },
    });
  }

  /**
   * Fallback: Get usage from DB
   */
  private static async getUsageFromDB(
    organizationId: string,
    metric: string,
    period?: string
  ): Promise<number> {
    const { start } = this.getPeriodDates(period);

    const result = await prisma.usageRecord.findFirst({
      where: {
        organizationId,
        metric,
        periodStart: start,
      },
      select: { quantity: true },
    });

    return result ? Number(result.quantity) : 0;
  }

  /**
   * Get usage history (for charts/analytics)
   */
  static async getUsageHistory(
    organizationId: string,
    metric: string,
    months = 6
  ): Promise<Array<{ period: string; quantity: number }>> {
    const records = await prisma.usageRecord.findMany({
      where: {
        organizationId,
        metric,
        periodStart: {
          gte: new Date(new Date().setMonth(new Date().getMonth() - months)),
        },
      },
      orderBy: { periodStart: 'desc' },
    });

    return records.map((r: any) => ({
      period: this.formatPeriod(r.periodStart),
      quantity: Number(r.quantity),
    }));
  }

  /**
   * Format date to period string
   */
  private static formatPeriod(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

export default UsageMeteringService;
