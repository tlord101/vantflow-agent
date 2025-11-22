import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import { z } from 'zod';

// Task schema for plan validation
export const TaskSchema = z.object({
  id: z.string(),
  type: z.enum(['navigate', 'click', 'fill', 'screenshot', 'extract', 'wait', 'custom']),
  name: z.string(),
  description: z.string().optional(),
  selector: z.string().optional(),
  url: z.string().url().optional(),
  payload: z.any().optional(),
  retryPolicy: z.object({
    maxRetries: z.number().default(3),
    backoffMs: z.number().default(1000),
  }).optional(),
  timeout: z.number().default(30000),
  preconditions: z.array(z.string()).optional(),
  estimatedTime: z.number().optional(), // in seconds
});

export const PlanSchema = z.object({
  tasks: z.array(TaskSchema),
  metadata: z.object({
    createdBy: z.string().optional(),
    generatedBy: z.string().optional(), // AI model used
    version: z.string().default('1.0'),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export type Task = z.infer<typeof TaskSchema>;
export type PlanData = z.infer<typeof PlanSchema>;

export class PlanService {
  /**
   * Create a new plan for a project
   */
  static async createPlan(data: {
    projectId: string;
    createdBy: string;
    name: string;
    description?: string;
    jsonPlan: PlanData;
    estimatedCost?: number;
    estimatedTime?: number;
  }) {
    try {
      // Validate plan structure
      PlanSchema.parse(data.jsonPlan);

      const plan = await prisma.plan.create({
        data: {
          projectId: data.projectId,
          createdBy: data.createdBy,
          name: data.name,
          description: data.description,
          jsonPlan: data.jsonPlan as any,
          estimatedCost: data.estimatedCost,
          estimatedTime: data.estimatedTime,
          status: 'draft',
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: data.projectId,
          userId: data.createdBy,
          action: 'plan_created',
          entity: 'plan',
          entityId: plan.id,
          meta: {
            planName: plan.name,
            taskCount: data.jsonPlan.tasks.length,
          },
        },
      });

      logger.info('Plan created', { planId: plan.id, projectId: data.projectId });
      return plan;
    } catch (error) {
      logger.error('Error creating plan', { error });
      throw error;
    }
  }

  /**
   * Get plans for a project
   */
  static async getProjectPlans(projectId: string, filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { projectId };
    if (filters?.status) {
      where.status = filters.status;
    }

    const [plans, total] = await Promise.all([
      prisma.plan.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          runs: {
            select: {
              id: true,
              status: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: filters?.offset || 0,
        take: filters?.limit || 50,
      }),
      prisma.plan.count({ where }),
    ]);

    return { plans, total };
  }

  /**
   * Get a single plan by ID
   */
  static async getPlanById(planId: string) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        runs: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            duration: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return plan;
  }

  /**
   * Update a plan
   */
  static async updatePlan(planId: string, userId: string, data: {
    name?: string;
    description?: string;
    jsonPlan?: PlanData;
    estimatedCost?: number;
    estimatedTime?: number;
  }) {
    try {
      if (data.jsonPlan) {
        PlanSchema.parse(data.jsonPlan);
      }

      const plan = await prisma.plan.update({
        where: { id: planId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.jsonPlan && { jsonPlan: data.jsonPlan as any }),
          ...(data.estimatedCost !== undefined && { estimatedCost: data.estimatedCost }),
          ...(data.estimatedTime !== undefined && { estimatedTime: data.estimatedTime }),
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: plan.projectId,
          userId,
          action: 'plan_updated',
          entity: 'plan',
          entityId: plan.id,
          meta: {
            planName: plan.name,
            changes: Object.keys(data),
          },
        },
      });

      logger.info('Plan updated', { planId });
      return plan;
    } catch (error) {
      logger.error('Error updating plan', { error, planId });
      throw error;
    }
  }

  /**
   * Approve a plan
   */
  static async approvePlan(planId: string, userId: string) {
    try {
      const plan = await prisma.plan.update({
        where: { id: planId },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: userId,
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: plan.projectId,
          userId,
          action: 'plan_approved',
          entity: 'plan',
          entityId: plan.id,
          meta: {
            planName: plan.name,
          },
        },
      });

      logger.info('Plan approved', { planId, userId });
      return plan;
    } catch (error) {
      logger.error('Error approving plan', { error, planId });
      throw error;
    }
  }

  /**
   * Delete a plan
   */
  static async deletePlan(planId: string, userId: string) {
    try {
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { projectId: true, name: true },
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      await prisma.plan.delete({
        where: { id: planId },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: plan.projectId,
          userId,
          action: 'plan_deleted',
          entity: 'plan',
          entityId: planId,
          meta: {
            planName: plan.name,
          },
        },
      });

      logger.info('Plan deleted', { planId, userId });
    } catch (error) {
      logger.error('Error deleting plan', { error, planId });
      throw error;
    }
  }
}
