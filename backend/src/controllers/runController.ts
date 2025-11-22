import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import { addRunToQueue } from '../queue/runQueue';

export const runController = {
  // Get all runs for a project
  async getProjectRuns(req: AuthRequest, res: Response) {
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

      const [runs, total] = await Promise.all([
        prisma.run.findMany({
          where,
          include: {
            creator: {
              select: { id: true, name: true, email: true },
            },
            plan: {
              select: { id: true, name: true },
            },
            _count: {
              select: { logs: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.run.count({ where }),
      ]);

      res.json({ runs, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
    } catch (error) {
      logger.error('Error fetching project runs:', error);
      res.status(500).json({ error: 'Failed to fetch runs' });
    }
  },

  // Get a single run with full details
  async getRun(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const run = await prisma.run.findFirst({
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
          plan: {
            select: { id: true, name: true, jsonPlan: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
      });

      if (!run) {
        return res.status(404).json({ error: 'Run not found or access denied' });
      }

      res.json(run);
    } catch (error) {
      logger.error('Error fetching run:', error);
      res.status(500).json({ error: 'Failed to fetch run' });
    }
  },

  // Get logs for a run
  async getRunLogs(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { level, limit = '1000', offset = '0' } = req.query;

      // Verify run access
      const run = await prisma.run.findFirst({
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
      });

      if (!run) {
        return res.status(404).json({ error: 'Run not found or access denied' });
      }

      const where: any = { runId: id };
      if (level) {
        where.level = level;
      }

      const [logs, total] = await Promise.all([
        prisma.logEntry.findMany({
          where,
          orderBy: { timestamp: 'asc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.logEntry.count({ where }),
      ]);

      res.json({ logs, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
    } catch (error) {
      logger.error('Error fetching run logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  },

  // Start a new run from a plan
  async startRun(req: AuthRequest, res: Response) {
    try {
      const { planId } = req.params;

      // Verify plan access
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
          project: true,
        },
      });

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found or access denied' });
      }

      // Only approved plans can be run
      if (plan.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved plans can be executed' });
      }

      // Create the run record
      const run = await prisma.run.create({
        data: {
          planId,
          projectId: plan.projectId,
          createdBy: req.user!.userId,
          status: 'queued',
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
          plan: {
            select: { id: true, name: true },
          },
        },
      });

      // Add to job queue
      try {
        await addRunToQueue(run.id, {
          runId: run.id,
          planId: plan.id,
          projectId: plan.projectId,
          userId: req.user!.userId,
          organizationId: req.user!.organizationId,
          tasks: (plan.jsonPlan as any).tasks,
        });

        logger.info(`Run queued: ${run.id} for plan ${planId}`);
      } catch (queueError) {
        logger.error('Error adding run to queue:', queueError);
        // Update run status to failed
        await prisma.run.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            errorMessage: 'Failed to queue run for execution',
          },
        });
        return res.status(500).json({ error: 'Failed to queue run for execution' });
      }

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: plan.projectId,
          userId: req.user!.userId,
          action: 'run_started',
          entity: 'run',
          entityId: run.id,
          meta: { planName: plan.name },
        },
      });

      res.status(201).json(run);
    } catch (error) {
      logger.error('Error starting run:', error);
      res.status(500).json({ error: 'Failed to start run' });
    }
  },

  // Cancel a running job
  async cancelRun(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Verify run access
      const run = await prisma.run.findFirst({
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

      if (!run) {
        return res.status(404).json({ error: 'Run not found or access denied' });
      }

      if (!['queued', 'running'].includes(run.status)) {
        return res.status(400).json({ error: 'Only queued or running jobs can be cancelled' });
      }

      // Update run status
      const updatedRun = await prisma.run.update({
        where: { id },
        data: {
          status: 'cancelled',
          finishedAt: new Date(),
          duration: run.startedAt ? Date.now() - run.startedAt.getTime() : null,
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId: run.projectId,
          userId: req.user!.userId,
          action: 'run_cancelled',
          entity: 'run',
          entityId: id,
        },
      });

      logger.info(`Run cancelled: ${id}`);
      res.json(updatedRun);
    } catch (error) {
      logger.error('Error cancelling run:', error);
      res.status(500).json({ error: 'Failed to cancel run' });
    }
  },

  // Get run statistics for a project
  async getRunStats(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;

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

      const [total, completed, failed, running, avgDuration] = await Promise.all([
        prisma.run.count({ where: { projectId } }),
        prisma.run.count({ where: { projectId, status: 'completed' } }),
        prisma.run.count({ where: { projectId, status: 'failed' } }),
        prisma.run.count({ where: { projectId, status: 'running' } }),
        prisma.run.aggregate({
          where: { projectId, status: 'completed', duration: { not: null } },
          _avg: { duration: true },
        }),
      ]);

      res.json({
        total,
        completed,
        failed,
        running,
        queued: total - completed - failed - running,
        avgDuration: avgDuration._avg.duration || 0,
      });
    } catch (error) {
      logger.error('Error fetching run stats:', error);
      res.status(500).json({ error: 'Failed to fetch run statistics' });
    }
  },
};
