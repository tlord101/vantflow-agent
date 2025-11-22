import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { chromium, Browser, Page } from 'playwright';
import { prisma } from '../lib/prisma';
import { RunService } from '../services/runService';
import logger from '../utils/logger';
import { io } from '../index';
import { PlanData, Task } from '../services/planService';
import UsageMeteringService from '../services/billing/usageMeteringService';
import { USAGE_METRICS } from '../config/pricing';
import * as fs from 'fs/promises';
import * as path from 'path';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Artifacts directory
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || './artifacts';

// Browser pool
let browserPool: Browser[] = [];
const MAX_BROWSERS = parseInt(process.env.MAX_BROWSERS || '3');

async function getBrowser(): Promise<Browser> {
  // Clean up closed browsers
  browserPool = browserPool.filter(b => b.isConnected());

  // Reuse existing browser if available
  if (browserPool.length > 0) {
    return browserPool[0];
  }

  // Create new browser if under limit
  if (browserPool.length < MAX_BROWSERS) {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    browserPool.push(browser);
    return browser;
  }

  // Wait for a browser to become available
  return browserPool[0];
}

async function releaseBrowser(browser: Browser) {
  // Keep browsers in pool for reuse
  // They will be cleaned up on shutdown
}

/**
 * Execute a single task
 */
async function executeTask(
  task: Task,
  page: Page,
  runId: string,
  projectId: string,
  artifactsPath: string
): Promise<any> {
  const startTime = Date.now();
  
  try {
    logger.info(`Executing task: ${task.name}`, { taskId: task.id, runId });
    
    // Emit progress
    io.to(`project:${projectId}`).emit('run:log', {
      runId,
      level: 'info',
      message: `Starting task: ${task.name}`,
      timestamp: new Date(),
    });

    await RunService.addLog(runId, {
      level: 'info',
      message: `Starting task: ${task.name}`,
      meta: { taskId: task.id, type: task.type },
    });

    let result: any = null;

    switch (task.type) {
      case 'navigate':
        if (!task.url) {
          throw new Error('URL is required for navigate task');
        }
        await page.goto(task.url, { 
          timeout: task.timeout,
          waitUntil: 'domcontentloaded',
        });
        result = { url: page.url() };
        break;

      case 'click':
        if (!task.selector) {
          throw new Error('Selector is required for click task');
        }
        await page.click(task.selector, { timeout: task.timeout });
        result = { clicked: task.selector };
        break;

      case 'fill':
        if (!task.selector || !task.payload) {
          throw new Error('Selector and payload are required for fill task');
        }
        await page.fill(task.selector, String(task.payload), { timeout: task.timeout });
        result = { filled: task.selector };
        break;

      case 'screenshot':
        const screenshotPath = path.join(artifactsPath, `screenshot-${task.id}-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result = { screenshot: screenshotPath };
        break;

      case 'extract':
        if (!task.selector) {
          throw new Error('Selector is required for extract task');
        }
        const element = await page.$(task.selector);
        if (element) {
          result = {
            text: await element.textContent(),
            html: await element.innerHTML(),
          };
        } else {
          result = { error: 'Element not found' };
        }
        break;

      case 'wait':
        const waitTime = task.payload?.duration || 1000;
        await page.waitForTimeout(waitTime);
        result = { waited: waitTime };
        break;

      case 'custom':
        // Execute custom JavaScript
        if (task.payload?.script) {
          result = await page.evaluate(task.payload.script);
        }
        break;

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    const duration = Date.now() - startTime;
    
    await RunService.addLog(runId, {
      level: 'info',
      message: `Completed task: ${task.name}`,
      meta: { taskId: task.id, duration, result },
    });

    io.to(`project:${projectId}`).emit('run:log', {
      runId,
      level: 'info',
      message: `Completed task: ${task.name} (${duration}ms)`,
      timestamp: new Date(),
      meta: { taskId: task.id },
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown error';
    
    logger.error(`Task failed: ${task.name}`, { taskId: task.id, error: errorMessage });
    
    await RunService.addLog(runId, {
      level: 'error',
      message: `Failed task: ${task.name} - ${errorMessage}`,
      meta: { taskId: task.id, duration, error: errorMessage },
    });

    io.to(`project:${projectId}`).emit('run:log', {
      runId,
      level: 'error',
      message: `Failed task: ${task.name} - ${errorMessage}`,
      timestamp: new Date(),
      meta: { taskId: task.id },
    });

    // Retry if configured
    if (task.retryPolicy && task.retryPolicy.maxRetries > 0) {
      logger.info(`Retrying task: ${task.name}`, { taskId: task.id });
      await new Promise(resolve => setTimeout(resolve, task.retryPolicy!.backoffMs));
      // Recursive retry (simplified - should track retry count)
      return executeTask(task, page, runId, projectId, artifactsPath);
    }

    throw error;
  }
}

/**
 * Execute a plan
 */
async function executePlan(job: Job) {
  const { runId, planId, projectId, userId } = job.data;
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  const startTime = Date.now();
  const artifactsPath = path.join(ARTIFACTS_DIR, runId);
  
  try {
    // Create artifacts directory
    await fs.mkdir(artifactsPath, { recursive: true });

    // Update run status to running
    await RunService.updateRunStatus(runId, 'running', {
      startedAt: new Date(),
    });

    // Emit start event
    io.to(`project:${projectId}`).emit('run:started', {
      runId,
      planId,
      timestamp: new Date(),
    });

    // Get plan
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { jsonPlan: true, name: true },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    const planData = plan.jsonPlan as PlanData;
    const results: any[] = [];
    const artifacts: string[] = [];

    // Execute tasks sequentially
    for (let i = 0; i < planData.tasks.length; i++) {
      const task = planData.tasks[i];
      
      // Update progress
      const progress = Math.round(((i + 1) / planData.tasks.length) * 100);
      await job.updateProgress(progress);

      io.to(`project:${projectId}`).emit('run:progress', {
        runId,
        progress,
        currentTask: task.name,
        timestamp: new Date(),
      });

      // Execute task
      const result = await executeTask(task, page, runId, projectId, artifactsPath);
      results.push({ taskId: task.id, result });

      // Collect artifacts
      if (result.screenshot) {
        artifacts.push(result.screenshot);
      }
    }

    const duration = Date.now() - startTime;
    const durationMinutes = Math.ceil(duration / (1000 * 60)); // Convert to minutes, round up

    // Track usage metrics
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (project?.organizationId) {
      // Track run minutes
      await UsageMeteringService.incrementUsage({
        organizationId: project.organizationId,
        projectId,
        metric: USAGE_METRICS.RUN_MINUTES,
        amount: durationMinutes,
        metadata: { runId, planId, duration },
      }).catch(err => logger.error('Failed to track run minutes:', err));

      // Track screenshots
      const screenshotCount = artifacts.length;
      if (screenshotCount > 0) {
        await UsageMeteringService.incrementUsage({
          organizationId: project.organizationId,
          projectId,
          metric: USAGE_METRICS.SCREENSHOTS,
          amount: screenshotCount,
          metadata: { runId, planId },
        }).catch(err => logger.error('Failed to track screenshots:', err));
      }
    }

    // Update run status to completed
    await RunService.updateRunStatus(runId, 'completed', {
      finishedAt: new Date(),
      duration,
      result: { tasks: results },
      artifacts: { files: artifacts },
    });

    // Emit completion event
    io.to(`project:${projectId}`).emit('run:completed', {
      runId,
      planId,
      duration,
      timestamp: new Date(),
    });

    logger.info('Plan execution completed', { runId, planId, duration });

    return { runId, status: 'completed', duration, results };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown error';
    
    logger.error('Plan execution failed', { runId, planId, error: errorMessage });

    // Update run status to failed
    await RunService.updateRunStatus(runId, 'failed', {
      finishedAt: new Date(),
      duration,
      errorMessage,
    });

    // Emit failure event
    io.to(`project:${projectId}`).emit('run:failed', {
      runId,
      planId,
      error: errorMessage,
      timestamp: new Date(),
    });

    throw error;
  } finally {
    await page.close();
    await releaseBrowser(browser);
  }
}

/**
 * Plan execution worker
 */
export const planExecutionWorker = new Worker(
  'plan-execution',
  async (job: Job) => {
    logger.info('Processing plan execution job', { jobId: job.id, data: job.data });
    return executePlan(job);
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute
    },
  }
);

// Worker event handlers
planExecutionWorker.on('completed', (job) => {
  logger.info('Worker completed job', { jobId: job.id });
});

planExecutionWorker.on('failed', (job, err) => {
  logger.error('Worker failed job', { jobId: job?.id, error: err.message });
});

planExecutionWorker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

// Graceful shutdown
export async function shutdownWorker() {
  logger.info('Shutting down worker...');
  
  // Close all browsers
  await Promise.all(browserPool.map(browser => browser.close()));
  browserPool = [];
  
  await planExecutionWorker.close();
  await connection.quit();
  
  logger.info('Worker shutdown complete');
}

process.on('SIGTERM', shutdownWorker);
process.on('SIGINT', shutdownWorker);
