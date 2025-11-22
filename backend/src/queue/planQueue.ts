import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../utils/logger';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Plan execution queue
export const planExecutionQueue = new Queue('plan-execution', {
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
      count: 1000, // Keep last 1000 failed jobs
    },
  },
});

// Queue events for monitoring
export const planExecutionQueueEvents = new QueueEvents('plan-execution', {
  connection,
});

// Listen to queue events
planExecutionQueueEvents.on('completed', ({ jobId }) => {
  logger.info('Job completed', { jobId });
});

planExecutionQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Job failed', { jobId, failedReason });
});

planExecutionQueueEvents.on('progress', ({ jobId, data }) => {
  logger.debug('Job progress', { jobId, progress: data });
});

/**
 * Add a plan execution job to the queue
 */
export async function enqueuePlanExecution(data: {
  runId: string;
  planId: string;
  projectId: string;
  userId: string;
}) {
  try {
    const job = await planExecutionQueue.add(
      'execute-plan',
      data,
      {
        jobId: data.runId, // Use runId as jobId for idempotency
        priority: 1,
      }
    );

    logger.info('Plan execution enqueued', { 
      jobId: job.id, 
      runId: data.runId,
      planId: data.planId,
    });

    return job;
  } catch (error) {
    logger.error('Error enqueueing plan execution', { error, data });
    throw error;
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  const job = await planExecutionQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  return {
    id: job.id,
    state,
    progress: job.progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string) {
  const job = await planExecutionQueue.getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  await job.remove();
  logger.info('Job cancelled', { jobId });
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    planExecutionQueue.getWaitingCount(),
    planExecutionQueue.getActiveCount(),
    planExecutionQueue.getCompletedCount(),
    planExecutionQueue.getFailedCount(),
    planExecutionQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Cleanup completed and failed jobs
 */
export async function cleanupQueue() {
  await planExecutionQueue.clean(24 * 3600 * 1000, 100, 'completed');
  await planExecutionQueue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');
  logger.info('Queue cleanup completed');
}

// Graceful shutdown
export async function shutdownQueue() {
  await planExecutionQueue.close();
  await planExecutionQueueEvents.close();
  await connection.quit();
  logger.info('Queue connections closed');
}
