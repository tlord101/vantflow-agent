import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import { executeTask } from '../services/executionService';
import { emitRunEvent } from '../websocket/events';
import { RunJobData } from './runQueue';

// Create Redis connection for worker
const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
});

// Process function for run execution
async function processRun(job: Job<RunJobData>) {
  const { runId, planId, projectId, userId, tasks } = job.data;
  const startTime = Date.now();

  logger.info(`Processing run ${runId} with ${tasks.length} tasks`);

  try {
    // Update run status to running
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Emit event
    emitRunEvent(projectId, 'run:started', {
      runId,
      planId,
      timestamp: new Date(),
    });

    // Log start
    await prisma.logEntry.create({
      data: {
        runId,
        level: 'info',
        message: `Starting execution of ${tasks.length} tasks`,
        meta: { taskCount: tasks.length },
      },
    });

    const artifacts: any[] = [];
    let currentStep = 0;

    // Execute each task
    for (const task of tasks) {
      currentStep++;
      const taskProgress = Math.round((currentStep / tasks.length) * 100);
      
      // Update job progress
      await job.updateProgress(taskProgress);

      // Log task start
      await prisma.logEntry.create({
        data: {
          runId,
          level: 'info',
          message: `Executing task ${currentStep}/${tasks.length}: ${task.name}`,
          meta: { taskId: task.id, taskType: task.type },
        },
      });

      // Emit progress event
      emitRunEvent(projectId, 'run:progress', {
        runId,
        taskId: task.id,
        progress: taskProgress,
        currentTask: currentStep,
        totalTasks: tasks.length,
        timestamp: new Date(),
      });

      try {
        // Execute the task
        const taskResult = await executeTask(task, {
          runId,
          projectId,
          userId,
        });

        // Store artifacts if any
        if (taskResult.artifacts) {
          artifacts.push(...taskResult.artifacts);
        }

        // Log task completion
        await prisma.logEntry.create({
          data: {
            runId,
            level: 'info',
            message: `Task completed: ${task.name}`,
            meta: {
              taskId: task.id,
              duration: taskResult.duration,
              success: true,
            },
          },
        });

        // Emit task completed event
        emitRunEvent(projectId, 'run:task_completed', {
          runId,
          taskId: task.id,
          result: taskResult,
          timestamp: new Date(),
        });
      } catch (taskError: any) {
        logger.error(`Task ${task.id} failed:`, taskError);

        // Log task error
        await prisma.logEntry.create({
          data: {
            runId,
            level: 'error',
            message: `Task failed: ${task.name} - ${taskError.message}`,
            meta: {
              taskId: task.id,
              error: taskError.message,
              stack: taskError.stack,
            },
          },
        });

        // Check if task is critical
        if (task.critical !== false) {
          throw new Error(`Critical task failed: ${task.name} - ${taskError.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;

    // Update run as completed
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        duration,
        result: {
          success: true,
          tasksCompleted: tasks.length,
          artifacts: artifacts.length,
        },
        artifacts: artifacts.length > 0 ? { items: artifacts } : undefined,
      },
    });

    // Log completion
    await prisma.logEntry.create({
      data: {
        runId,
        level: 'info',
        message: `Execution completed successfully in ${(duration / 1000).toFixed(2)}s`,
        meta: {
          duration,
          tasksCompleted: tasks.length,
          artifactsGenerated: artifacts.length,
        },
      },
    });

    // Update plan status
    await prisma.plan.update({
      where: { id: planId },
      data: { status: 'completed' },
    });

    // Emit completion event
    emitRunEvent(projectId, 'run:completed', {
      runId,
      planId,
      duration,
      artifacts,
      timestamp: new Date(),
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: 'run_completed',
        entity: 'run',
        entityId: runId,
        meta: { duration, tasksCompleted: tasks.length },
      },
    });

    logger.info(`Run ${runId} completed successfully in ${duration}ms`);
    return { success: true, duration, artifacts };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`Run ${runId} failed:`, error);

    // Update run as failed
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        duration,
        errorMessage: error.message,
      },
    });

    // Log error
    await prisma.logEntry.create({
      data: {
        runId,
        level: 'error',
        message: `Execution failed: ${error.message}`,
        meta: {
          error: error.message,
          stack: error.stack,
          duration,
        },
      },
    });

    // Update plan status
    await prisma.plan.update({
      where: { id: planId },
      data: { status: 'failed' },
    });

    // Emit failure event
    emitRunEvent(projectId, 'run:failed', {
      runId,
      planId,
      error: error.message,
      timestamp: new Date(),
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: 'run_failed',
        entity: 'run',
        entityId: runId,
        meta: { error: error.message, duration },
      },
    });

    throw error;
  }
}

// Create the worker
export const runWorker = new Worker('run-execution', processRun, {
  connection,
  concurrency: parseInt(config.worker.concurrency || '2', 10),
  limiter: {
    max: parseInt(config.worker.maxJobsPerInterval || '10', 10),
    duration: 60000, // per minute
  },
});

// Worker event handlers
runWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

runWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});

runWorker.on('error', (err) => {
  logger.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await runWorker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await runWorker.close();
  await connection.quit();
  process.exit(0);
});

logger.info(`Run worker started with concurrency: ${config.worker.concurrency || 2}`);

export default runWorker;
