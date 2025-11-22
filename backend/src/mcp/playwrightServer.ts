import { chromium, Browser, Page } from 'playwright';
import logger from '../utils/logger';

export class PlaywrightMCPServer {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    try {
      this.browser = await chromium.launch({ headless: true });
      logger.info('Playwright MCP Server initialized');
    } catch (error) {
      logger.error('Failed to initialize Playwright:', error);
      throw error;
    }
  }

  async createPage() {
    if (!this.browser) {
      await this.initialize();
    }
    this.page = await this.browser!.newPage();
    return this.page;
  }

  async navigate(url: string) {
    if (!this.page) {
      await this.createPage();
    }
    logger.info(`Navigating to: ${url}`);
    await this.page!.goto(url, { waitUntil: 'networkidle' });
    return { success: true, url };
  }

  async click(selector: string) {
    if (!this.page) {
      throw new Error('No page available');
    }
    logger.info(`Clicking: ${selector}`);
    await this.page.click(selector);
    return { success: true, selector };
  }

  async type(selector: string, text: string) {
    if (!this.page) {
      throw new Error('No page available');
    }
    logger.info(`Typing into: ${selector}`);
    await this.page.fill(selector, text);
    return { success: true, selector, text };
  }

  async extractText(selector: string) {
    if (!this.page) {
      throw new Error('No page available');
    }
    logger.info(`Extracting text from: ${selector}`);
    const text = await this.page.textContent(selector);
    return { success: true, selector, text };
  }

  async screenshot(path?: string) {
    if (!this.page) {
      throw new Error('No page available');
    }
    const screenshotPath = path || `screenshots/${Date.now()}.png`;
    logger.info(`Taking screenshot: ${screenshotPath}`);
    await this.page.screenshot({ path: screenshotPath });
    return { success: true, path: screenshotPath };
  }

  async waitFor(ms: number) {
    logger.info(`Waiting for ${ms}ms`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    return { success: true, ms };
  }

  async close() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('Playwright MCP Server closed');
  }

  async executeAction(action: string, params: any) {
    switch (action) {
      case 'navigate':
        return await this.navigate(params.url || params.target);
      case 'click':
        return await this.click(params.selector || params.target);
      case 'type':
        return await this.type(params.selector || params.target, params.value);
      case 'extract':
        return await this.extractText(params.selector || params.target);
      case 'screenshot':
        return await this.screenshot(params.path);
      case 'wait':
        return await this.waitFor(params.ms || 1000);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
}

export const mcpServer = new PlaywrightMCPServer();
