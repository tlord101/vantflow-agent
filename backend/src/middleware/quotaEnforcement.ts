/**
 * Quota Enforcement Middleware
 * 
 * Checks usage quotas before allowing operations.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import UsageMeteringService from '../services/billing/usageMeteringService';
import { USAGE_METRICS, PRICING_PLANS } from '../config/pricing';

export interface QuotaCheckRequest extends Request {
  user?: {
    id: string;
    organizationId?: string;
  };
  organization?: {
    id: string;
    name: string;
    planTier: string;
  };
}

/**
 * Check if organization has active subscription
 */
export async function checkActiveSubscription(
  req: QuotaCheckRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        organizationId,
        status: { in: ['active', 'trialing'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // Check if free tier allows this
      const freeTier = PRICING_PLANS.free;
      req.organization = {
        id: organizationId,
        name: '',
        planTier: 'free',
      };
    } else {
      req.organization = {
        id: organizationId,
        name: '',
        planTier: subscription.planTier,
      };
    }

    next();
  } catch (error) {
    logger.error('Failed to check subscription:', error);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
}

/**
 * Check token quota before AI operations
 */
export async function checkTokenQuota(estimatedTokens = 1000) {
  return async (req: QuotaCheckRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.organization?.id;
      
      if (!organizationId) {
        res.status(400).json({ error: 'Organization not found' });
        return;
      }

      const exceeded = await UsageMeteringService.isQuotaExceeded(
        organizationId,
        USAGE_METRICS.GEMINI_TOKENS,
        estimatedTokens
      );

      if (exceeded) {
        const stats = await UsageMeteringService.getUsageStats(
          organizationId,
          USAGE_METRICS.GEMINI_TOKENS
        );

        res.status(402).json({
          error: 'Quota exceeded',
          message: 'Your organization has reached its monthly token quota. Upgrade now to continue running automations without interruption.',
          quota: {
            metric: 'gemini_tokens',
            current: stats.current,
            limit: stats.limit,
            percentage: stats.percentage,
          },
          upgradeUrl: `/billing/upgrade`,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Failed to check token quota:', error);
      next(); // Allow operation but log error
    }
  };
}

/**
 * Check run minutes quota before executing runs
 */
export async function checkRunQuota(estimatedMinutes = 5) {
  return async (req: QuotaCheckRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.organization?.id;
      
      if (!organizationId) {
        res.status(400).json({ error: 'Organization not found' });
        return;
      }

      const exceeded = await UsageMeteringService.isQuotaExceeded(
        organizationId,
        USAGE_METRICS.RUN_MINUTES,
        estimatedMinutes
      );

      if (exceeded) {
        const stats = await UsageMeteringService.getUsageStats(
          organizationId,
          USAGE_METRICS.RUN_MINUTES
        );

        res.status(402).json({
          error: 'Quota exceeded',
          message: 'Your organization has reached its monthly automation minutes quota. Upgrade now to continue.',
          quota: {
            metric: 'run_minutes',
            current: stats.current,
            limit: stats.limit,
            percentage: stats.percentage,
          },
          upgradeUrl: `/billing/upgrade`,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Failed to check run quota:', error);
      next();
    }
  };
}

/**
 * Check project limit
 */
export async function checkProjectLimit(
  req: QuotaCheckRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.organization?.id;
    const planTier = req.organization?.planTier || 'free';
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const plan = PRICING_PLANS[planTier];
    if (!plan) {
      res.status(500).json({ error: 'Invalid plan tier' });
      return;
    }

    // Check if unlimited
    if (plan.quotas.projects === -1) {
      next();
      return;
    }

    // Count existing projects
    const projectCount = await prisma.project.count({
      where: { organizationId },
    });

    if (projectCount >= plan.quotas.projects) {
      res.status(402).json({
        error: 'Project limit reached',
        message: `Your plan allows up to ${plan.quotas.projects} projects. Upgrade to create more projects.`,
        quota: {
          current: projectCount,
          limit: plan.quotas.projects,
        },
        upgradeUrl: `/billing/upgrade`,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Failed to check project limit:', error);
    next();
  }
}

/**
 * Check team member limit
 */
export async function checkTeamMemberLimit(
  req: QuotaCheckRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.organization?.id;
    const planTier = req.organization?.planTier || 'free';
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const plan = PRICING_PLANS[planTier];
    if (!plan) {
      res.status(500).json({ error: 'Invalid plan tier' });
      return;
    }

    // Check if unlimited
    if (plan.quotas.teamMembers === -1) {
      next();
      return;
    }

    // Count existing team members
    const memberCount = await prisma.user.count({
      where: { organizationId },
    });

    if (memberCount >= plan.quotas.teamMembers) {
      res.status(402).json({
        error: 'Team member limit reached',
        message: `Your plan allows up to ${plan.quotas.teamMembers} team members. Upgrade to add more members.`,
        quota: {
          current: memberCount,
          limit: plan.quotas.teamMembers,
        },
        upgradeUrl: `/billing/upgrade`,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Failed to check team member limit:', error);
    next();
  }
}

/**
 * Check concurrent runs limit
 */
export async function checkConcurrentRunsLimit(
  req: QuotaCheckRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.organization?.id;
    const planTier = req.organization?.planTier || 'free';
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const plan = PRICING_PLANS[planTier];
    if (!plan) {
      res.status(500).json({ error: 'Invalid plan tier' });
      return;
    }

    // Check if unlimited
    if (plan.quotas.concurrentRuns === -1) {
      next();
      return;
    }

    // Count running jobs
    const runningCount = await prisma.run.count({
      where: {
        project: { organizationId },
        status: { in: ['queued', 'running'] },
      },
    });

    if (runningCount >= plan.quotas.concurrentRuns) {
      res.status(429).json({
        error: 'Concurrent run limit reached',
        message: `Your plan allows up to ${plan.quotas.concurrentRuns} concurrent runs. Please wait for a run to complete or upgrade your plan.`,
        quota: {
          current: runningCount,
          limit: plan.quotas.concurrentRuns,
        },
        upgradeUrl: `/billing/upgrade`,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Failed to check concurrent runs limit:', error);
    next();
  }
}

/**
 * Get quota summary for organization
 */
export async function getQuotaSummary(organizationId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      organizationId,
      status: { in: ['active', 'trialing'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const planTier = subscription?.planTier || 'free';
  const plan = PRICING_PLANS[planTier];

  if (!plan) {
    throw new Error('Invalid plan tier');
  }

  // Get usage stats
  const usageStats = await UsageMeteringService.getAllUsageStats(organizationId);

  // Get project count
  const projectCount = await prisma.project.count({
    where: { organizationId },
  });

  // Get team member count
  const memberCount = await prisma.user.count({
    where: { organizationId },
  });

  // Get concurrent runs
  const concurrentRuns = await prisma.run.count({
    where: {
      project: { organizationId },
      status: { in: ['queued', 'running'] },
    },
  });

  return {
    plan: {
      tier: planTier,
      name: plan.name,
    },
    subscription: subscription ? {
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    } : null,
    usage: usageStats,
    limits: {
      projects: {
        current: projectCount,
        limit: plan.quotas.projects,
        unlimited: plan.quotas.projects === -1,
      },
      teamMembers: {
        current: memberCount,
        limit: plan.quotas.teamMembers,
        unlimited: plan.quotas.teamMembers === -1,
      },
      concurrentRuns: {
        current: concurrentRuns,
        limit: plan.quotas.concurrentRuns,
        unlimited: plan.quotas.concurrentRuns === -1,
      },
    },
  };
}
