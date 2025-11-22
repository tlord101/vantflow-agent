import { prisma } from '../lib/prisma';
import logger from '../utils/logger';

export class RunService {
  /**
   * Create a new run for a plan
   */
  static async createRun(data: {
    planId: string;
    projectId: string;
    createdBy: string;
  }) {
    try {
      const run = await prisma.run.create({
        data: {
          planId: data.planId,
          projectId: data.projectId,
          createdBy: data.createdBy,
          status: 'queued',
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              jsonPlan: true,
            },
          },
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
          projectId: data.projectId,
          userId: data.createdBy,
          action: 'run_created',
          entity: 'run',
          entityId: run.id,
          meta: {
            planId: data.planId,
            planName: run.plan.name,
          },
        },
      });

      logger.info('Run created', { runId: run.id, planId: data.planId });
      return run;
    } catch (error) {
      logger.error('Error creating run', { error });
      throw error;
    }
  }

  /**
   * Get runs for a project
   */
  static async getProjectRuns(projectId: string, filters?: {
    status?: string;
    planId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { projectId };
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.planId) {
      where.planId = filters.planId;
    }

    const [runs, total] = await Promise.all([
      prisma.run.findMany({
        where,
        include: {
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              logs: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: filters?.offset || 0,
        take: filters?.limit || 50,
      }),
      prisma.run.count({ where }),
    ]);

    return { runs, total };
  }

  /**
   * Get a single run by ID
   */
  static async getRunById(runId: string) {
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            jsonPlan: true,
          },
        },
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
        logs: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    return run;
  }

  /**
   * Update run status
   */
  static async updateRunStatus(runId: string, status: string, data?: {
    startedAt?: Date;
    finishedAt?: Date;
    duration?: number;
    result?: any;
    errorMessage?: string;
    artifacts?: any;
  }) {
    try {
      const run = await prisma.run.update({
        where: { id: runId },
        data: {
          status,
          ...(data?.startedAt && { startedAt: data.startedAt }),
          ...(data?.finishedAt && { finishedAt: data.finishedAt }),
          ...(data?.duration !== undefined && { duration: data.duration }),
          ...(data?.result && { result: data.result }),
          ...(data?.errorMessage !== undefined && { errorMessage: data.errorMessage }),
          ...(data?.artifacts && { artifacts: data.artifacts }),
        },
        include: {
          plan: {
            select: {
              name: true,
            },
          },
        },
      });

      // Log significant status changes
      if (['running', 'completed', 'failed', 'cancelled'].includes(status)) {
        await prisma.activityLog.create({
          data: {
            projectId: run.projectId,
            userId: run.createdBy,
            action: `run_${status}`,
            entity: 'run',
            entityId: run.id,
            meta: {
              planName: run.plan.name,
              ...(data?.errorMessage && { error: data.errorMessage }),
            },
          },
        });
      }

      logger.info('Run status updated', { runId, status });
      return run;
    } catch (error) {
      logger.error('Error updating run status', { error, runId, status });
      throw error;
    }
  }

  /**
   * Add log entry to a run
   */
  static async addLog(runId: string, log: {
    level: string;
    message: string;
    meta?: any;
  }) {
    try {
      const logEntry = await prisma.logEntry.create({
        data: {
          runId,
          level: log.level,
          message: log.message,
          meta: log.meta || {},
        },
      });

      return logEntry;
    } catch (error) {
      logger.error('Error adding log entry', { error, runId });
      throw error;
    }
  }

  /**
   * Get logs for a run
   */
  static async getRunLogs(runId: string, filters?: {
    level?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { runId };
    if (filters?.level) {
      where.level = filters.level;
    }

    const [logs, total] = await Promise.all([
      prisma.logEntry.findMany({
        where,
        orderBy: {
          timestamp: 'asc',
        },
        skip: filters?.offset || 0,
        take: filters?.limit || 1000,
      }),
      prisma.logEntry.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Cancel a run
   */
  static async cancelRun(runId: string, userId: string) {
    try {
      const run = await this.updateRunStatus(runId, 'cancelled', {
        finishedAt: new Date(),
        errorMessage: 'Cancelled by user',
      });

      await prisma.activityLog.create({
        data: {
          projectId: run.projectId,
          userId,
          action: 'run_cancelled',
          entity: 'run',
          entityId: run.id,
          meta: {
            planName: run.plan.name,
          },
        },
      });

      logger.info('Run cancelled', { runId, userId });
      return run;
    } catch (error) {
      logger.error('Error cancelling run', { error, runId });
      throw error;
    }
  }

  /**
   * Get run statistics for a project
   */
  static async getProjectRunStats(projectId: string) {
    const [total, completed, failed, running, queued] = await Promise.all([
      prisma.run.count({ where: { projectId } }),
      prisma.run.count({ where: { projectId, status: 'completed' } }),
      prisma.run.count({ where: { projectId, status: 'failed' } }),
      prisma.run.count({ where: { projectId, status: 'running' } }),
      prisma.run.count({ where: { projectId, status: 'queued' } }),
    ]);

    return {
      total,
      completed,
      failed,
      running,
      queued,
    };
  }
}
