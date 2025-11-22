import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import logger from '../utils/logger';

// Create Redis connection
const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
});

// Create the run queue
export const runQueue = new Queue('run-execution', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
});

export interface RunJobData {
  runId: string;
  planId: string;
  projectId: string;
  userId: string;
  organizationId?: string;
  tasks: Array<{
    id: string;
    type: string;
    name: string;
    [key: string]: any;
  }>;
}

// Add a run to the queue
export async function addRunToQueue(runId: string, data: RunJobData): Promise<Job> {
  try {
    const job = await runQueue.add('execute-plan', data, {
      jobId: runId,
      priority: 1,
    });
    logger.info(`Run ${runId} added to queue with job ID ${job.id}`);
    return job;
  } catch (error) {
    logger.error(`Failed to add run ${runId} to queue:`, error);
    throw error;
  }
}

// Get job status
export async function getJobStatus(runId: string) {
  try {
    const job = await runQueue.getJob(runId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    
    return {
      id: job.id,
      state,
      progress,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  } catch (error) {
    logger.error(`Failed to get job status for ${runId}:`, error);
    return null;
  }
}

// Cancel a job
export async function cancelJob(runId: string): Promise<boolean> {
  try {
    const job = await runQueue.getJob(runId);
    if (!job) {
      return false;
    }

    await job.remove();
    logger.info(`Job ${runId} cancelled`);
    return true;
  } catch (error) {
    logger.error(`Failed to cancel job ${runId}:`, error);
    return false;
  }
}

// Get queue metrics
export async function getQueueMetrics() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      runQueue.getWaitingCount(),
      runQueue.getActiveCount(),
      runQueue.getCompletedCount(),
      runQueue.getFailedCount(),
      runQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    logger.error('Failed to get queue metrics:', error);
    return null;
  }
}

// Clean up old jobs
export async function cleanQueue() {
  try {
    await runQueue.clean(24 * 3600 * 1000, 100, 'completed'); // Clean completed jobs older than 24h
    await runQueue.clean(7 * 24 * 3600 * 1000, 500, 'failed'); // Clean failed jobs older than 7 days
    logger.info('Queue cleaned successfully');
  } catch (error) {
    logger.error('Failed to clean queue:', error);
  }
}

// Graceful shutdown
export async function closeQueue() {
  try {
    await runQueue.close();
    await connection.quit();
    logger.info('Queue connection closed');
  } catch (error) {
    logger.error('Error closing queue:', error);
  }
}

logger.info('Run queue initialized');
