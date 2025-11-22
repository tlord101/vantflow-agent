import { chromium, Browser, Page } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { config } from '../config';

let browser: Browser | null = null;

// Get or create browser instance
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: config.nodeEnv === 'production',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    logger.info('Browser instance created');
  }
  return browser;
}

interface TaskContext {
  runId: string;
  projectId: string;
  userId: string;
}

interface TaskResult {
  success: boolean;
  duration: number;
  data?: any;
  artifacts?: Array<{
    type: string;
    path: string;
    url?: string;
    size?: number;
  }>;
  error?: string;
}

export async function executeTask(task: any, context: TaskContext): Promise<TaskResult> {
  const startTime = Date.now();
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    logger.info(`Executing task: ${task.type} - ${task.name}`);

    let result: TaskResult = {
      success: false,
      duration: 0,
    };

    switch (task.type) {
      case 'navigate':
        result = await executeNavigate(page, task, context);
        break;
      case 'click':
        result = await executeClick(page, task, context);
        break;
      case 'fill':
        result = await executeFill(page, task, context);
        break;
      case 'screenshot':
        result = await executeScreenshot(page, task, context);
        break;
      case 'extract':
        result = await executeExtract(page, task, context);
        break;
      case 'wait':
        result = await executeWait(page, task, context);
        break;
      case 'custom':
        result = await executeCustom(page, task, context);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    result.duration = Date.now() - startTime;
    result.success = true;

    await page.close();
    return result;
  } catch (error: any) {
    logger.error(`Task execution failed:`, error);
    await page.close();
    
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function executeNavigate(page: Page, task: any, context: TaskContext): Promise<TaskResult> {
  const timeout = task.timeout || 30000;
  await page.goto(task.url, { timeout, waitUntil: 'networkidle' });
  
  return {
    success: true,
    duration: 0,
    data: { url: page.url() },
  };
}

async function executeClick(page: Page, task: any, context: TaskContext): Promise<TaskResult> {
  const timeout = task.timeout || 10000;
  const retryPolicy = task.retryPolicy || { maxRetries: 3, delayMs: 1000 };

  let lastError;
  for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
    try {
      await page.click(task.selector, { timeout });
      return {
        success: true,
        duration: 0,
        data: { selector: task.selector, attempt },
      };
    } catch (error: any) {
      lastError = error;
      if (attempt < retryPolicy.maxRetries) {
        await page.waitForTimeout(retryPolicy.delayMs);
      }
    }
  }

  throw new Error(`Click failed after ${retryPolicy.maxRetries} retries: ${lastError.message}`);
}

async function executeFill(page: Page, task: any, context: TaskContext): Promise<TaskResult> {
  const timeout = task.timeout || 10000;
  const retryPolicy = task.retryPolicy || { maxRetries: 3, delayMs: 1000 };

  let lastError;
  for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
    try {
      await page.fill(task.selector, task.value, { timeout });
      return {
        success: true,
        duration: 0,
        data: { selector: task.selector, value: task.value, attempt },
      };
    } catch (error: any) {
      lastError = error;
      if (attempt < retryPolicy.maxRetries) {
        await page.waitForTimeout(retryPolicy.delayMs);
      }
    }
  }

  throw new Error(`Fill failed after ${retryPolicy.maxRetries} retries: ${lastError.message}`);
}

async function executeScreenshot(page: Page, task: any, context: TaskContext): Promise<TaskResult> {
  const artifactsDir = path.join(config.storage.artifactsPath, context.projectId, context.runId);
  await fs.mkdir(artifactsDir, { recursive: true });

  const filename = `screenshot-${task.id}-${Date.now()}.png`;
  const filepath = path.join(artifactsDir, filename);

  const screenshotOptions: any = {
    path: filepath,
    fullPage: task.fullPage !== false,
  };

  if (task.selector) {
    const element = await page.$(task.selector);
    if (element) {
      await element.screenshot({ path: filepath });
    } else {
      throw new Error(`Element not found: ${task.selector}`);
    }
  } else {
    await page.screenshot(screenshotOptions);
  }

  const stats = await fs.stat(filepath);

  return {
    success: true,
    duration: 0,
    data: { path: filepath },
    artifacts: [{
      type: 'screenshot',
      path: filepath,
      url: `/artifacts/${context.projectId}/${context.runId}/${filename}`,
      size: stats.size,
    }],
  };
}

async function executeExtract(page: Page, task: any, context: TaskContext): Promise<TaskResult> {
  const timeout = task.timeout || 10000;

  if (task.selector) {
    // Extract from specific element
    const element = await page.waitForSelector(task.selector, { timeout });
    const data = await element?.evaluate((el: any) => {
      return {
        text: el.textContent?.trim(),
        html: el.innerHTML,
        attributes: Array.from(el.attributes).reduce((acc: any, attr: any) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {}),
      };
    });

    return {
      success: true,
      duration: 0,
      data,
    };
  } else if (task.script) {
    // Execute custom extraction script
    const data = await page.evaluate(task.script);
    return {
      success: true,
      duration: 0,
      data,
    };
  } else {
    // Extract all text from page
    const data = await page.evaluate(() => document.body.textContent?.trim());
    return {
      success: true,
      duration: 0,
      data,
    };
  }
}

async function executeWait(page: Page, task: any, context: TaskContext): Promise<TaskResult> {
  if (task.duration) {
    // Wait for specific duration
    await page.waitForTimeout(task.duration);
  } else if (task.selector) {
    // Wait for element to appear
    const timeout = task.timeout || 30000;
    await page.waitForSelector(task.selector, { timeout, state: task.state || 'visible' });
  } else if (task.url) {
    // Wait for navigation
    await page.waitForURL(task.url, { timeout: task.timeout || 30000 });
  } else {
    // Default: wait for network idle
    await page.waitForLoadState('networkidle');
  }

  return {
    success: true,
    duration: 0,
  };
}

async function executeCustom(page: Page, task: any, context: TaskContext): Promise<TaskResult> {
  if (task.script) {
    // Execute custom JavaScript
    const data = await page.evaluate(task.script);
    return {
      success: true,
      duration: 0,
      data,
    };
  } else if (task.function) {
    // Execute custom function from task definition
    // This is more advanced and requires careful security consideration
    logger.warn('Custom function execution is not fully implemented for security reasons');
    throw new Error('Custom function execution not implemented');
  } else {
    throw new Error('Custom task requires either script or function property');
  }
}

// Cleanup browser on shutdown
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    logger.info('Browser instance closed');
  }
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
