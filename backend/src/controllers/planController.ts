import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import { z } from 'zod';

// Validation schemas
const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  jsonPlan: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      type: z.enum(['navigate', 'click', 'fill', 'screenshot', 'extract', 'wait', 'custom']),
      name: z.string(),
      url: z.string().optional(),
      selector: z.string().optional(),
      value: z.any().optional(),
      timeout: z.number().optional(),
      retryPolicy: z.object({
        maxRetries: z.number(),
        delayMs: z.number(),
      }).optional(),
    })),
    metadata: z.object({
      estimatedDuration: z.number().optional(),
      estimatedCost: z.number().optional(),
    }).optional(),
  }),
  estimatedCost: z.number().optional(),
  estimatedTime: z.number().optional(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  jsonPlan: z.any().optional(),
  status: z.enum(['draft', 'approved', 'running', 'completed', 'failed']).optional(),
});

export const planController = {
  // Get all plans for a project
  async getProjectPlans(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { status, limit = '50', offset = '0' } = req.query;

      // Verify project access
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: req.user!.userId },
            {
              collaborators: {
                some: { userId: req.user!.userId },
              },
            },
          ],
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      const where: any = { projectId };
      if (status) {
        where.status = status;
      }

      const [plans, total] = await Promise.all([
        prisma.plan.findMany({
          where,
          include: {
            creator: {
              select: { id: true, name: true, email: true },
            },
            runs: {
              select: { id: true, status: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.plan.count({ where }),
      ]);

      res.json({ plans, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
    } catch (error) {
      logger.error('Error fetching project plans:', error);
      res.status(500).json({ error: 'Failed to fetch plans' });
    }
  },

  // Get a single plan
  async getPlan(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const plan = await prisma.plan.findFirst({
        where: {
          id,
          project: {
            OR: [
              { userId: req.user!.userId },
              {
                collaborators: {
                  some: { userId: req.user!.userId },
                },
              },
            ],
          },
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true },
          },
          runs: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              startedAt: true,
              finishedAt: true,
              duration: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found or access denied' });
      }

      res.json(plan);
    } catch (error) {
      logger.error('Error fetching plan:', error);
      res.status(500).json({ error: 'Failed to fetch plan' });
    }
  },

  // Create a new plan
  async createPlan(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const validation = createPlanSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid plan data', details: validation.error.errors });
      }

      // Verify project access and ownership
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: req.user!.userId },
            {
              collaborators: {
                some: {
                  userId: req.user!.userId,
                  role: { in: ['owner', 'admin', 'collaborator'] },
                },
              },
            },
          ],
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      const { name, description, jsonPlan, estimatedCost, estimatedTime } = validation.data;

      const plan = await prisma.plan.create({
        data: {
          projectId,
          createdBy: req.user!.userId,
          name,
          description,
          jsonPlan,
          estimatedCost,
          estimatedTime,
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId,
          userId: req.user!.userId,
          action: 'plan_created',
          entity: 'plan',
          entityId: plan.id,
          meta: { planName: name },
        },
      });

      logger.info(`Plan created: ${plan.id} for project ${projectId}`);
      res.status(201).json(plan);
    } catch (error) {
      logger.error('Error creating plan:', error);
      res.status(500).json({ error: 'Failed to create plan' });
    }
  },

  // Update a plan
  async updatePlan(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const validation = updatePlanSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid plan data', details: validation.error.errors });
      }

      // Verify plan access
      const existingPlan = await prisma.plan.findFirst({
        where: {
          id,
          project: {
            OR: [
              { userId: req.user!.userId },
              {
                collaborators: {
                  some: {
                    userId: req.user!.userId,
                    role: { in: ['owner', 'admin', 'collaborator'] },
                  },
                },
              },
            ],
          },
        },
      });

      if (!existingPlan) {
        return res.status(404).json({ error: 'Plan not found or access denied' });
      }

      // Don't allow editing plans that are running or completed
      if (['running', 'completed', 'failed'].includes(existingPlan.status)) {
        return res.status(400).json({ error: 'Cannot edit plan in current status' });
      }

      const plan = await prisma.plan.update({
        where: { id },
        data: validation.data,
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: existingPlan.projectId,
          userId: req.user!.userId,
          action: 'plan_updated',
          entity: 'plan',
          entityId: plan.id,
          meta: { changes: validation.data },
        },
      });

      res.json(plan);
    } catch (error) {
      logger.error('Error updating plan:', error);
      res.status(500).json({ error: 'Failed to update plan' });
    }
  },

  // Approve a plan
  async approvePlan(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Verify plan access
      const existingPlan = await prisma.plan.findFirst({
        where: {
          id,
          project: {
            OR: [
              { userId: req.user!.userId },
              {
                collaborators: {
                  some: {
                    userId: req.user!.userId,
                    role: { in: ['owner', 'admin'] },
                  },
                },
              },
            ],
          },
        },
      });

      if (!existingPlan) {
        return res.status(404).json({ error: 'Plan not found or access denied' });
      }

      if (existingPlan.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft plans can be approved' });
      }

      const plan = await prisma.plan.update({
        where: { id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: req.user!.userId,
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: existingPlan.projectId,
          userId: req.user!.userId,
          action: 'plan_approved',
          entity: 'plan',
          entityId: plan.id,
        },
      });

      logger.info(`Plan approved: ${plan.id}`);
      res.json(plan);
    } catch (error) {
      logger.error('Error approving plan:', error);
      res.status(500).json({ error: 'Failed to approve plan' });
    }
  },

  // Delete a plan
  async deletePlan(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Verify plan access
      const existingPlan = await prisma.plan.findFirst({
        where: {
          id,
          project: {
            OR: [
              { userId: req.user!.userId },
              {
                collaborators: {
                  some: {
                    userId: req.user!.userId,
                    role: { in: ['owner', 'admin'] },
                  },
                },
              },
            ],
          },
        },
      });

      if (!existingPlan) {
        return res.status(404).json({ error: 'Plan not found or access denied' });
      }

      // Don't allow deleting plans with active runs
      const activeRuns = await prisma.run.count({
        where: {
          planId: id,
          status: { in: ['queued', 'running'] },
        },
      });

      if (activeRuns > 0) {
        return res.status(400).json({ error: 'Cannot delete plan with active runs' });
      }

      await prisma.plan.delete({ where: { id } });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: existingPlan.projectId,
          userId: req.user!.userId,
          action: 'plan_deleted',
          entity: 'plan',
          entityId: id,
          meta: { planName: existingPlan.name },
        },
      });

      res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
      logger.error('Error deleting plan:', error);
      res.status(500).json({ error: 'Failed to delete plan' });
    }
  },

  // Run a plan (enqueue for execution)
  async runPlan(req: AuthRequest, res: Response) {
    try {
      const { id: planId } = req.params;

      // Verify plan access and status
      const plan = await prisma.plan.findFirst({
        where: {
          id: planId,
          project: {
            OR: [
              { userId: req.user!.userId },
              {
                collaborators: {
                  some: {
                    userId: req.user!.userId,
                    role: { in: ['owner', 'admin', 'collaborator'] },
                  },
                },
              },
            ],
          },
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      });

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found or access denied' });
      }

      if (plan.status !== 'approved') {
        return res.status(400).json({ error: 'Plan must be approved before running' });
      }

      // Create run record
      const { RunService } = await import('../services/runService');
      const run = await RunService.createRun({
        planId,
        projectId: plan.projectId,
        createdBy: req.user!.userId,
      });

      // Enqueue for execution
      const { enqueuePlanExecution } = await import('../queue/planQueue');
      await enqueuePlanExecution({
        runId: run.id,
        planId,
        projectId: plan.projectId,
        userId: req.user!.userId,
      });

      logger.info(`Plan run enqueued: ${run.id} for plan ${planId}`);
      res.status(201).json(run);
    } catch (error) {
      logger.error('Error running plan:', error);
      res.status(500).json({ error: 'Failed to run plan' });
    }
  },
};
