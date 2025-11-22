/**
 * Usage Flush Cron Job
 * 
 * Flushes Redis usage counters to PostgreSQL.
 * Runs hourly.
 */

import cron from 'node-cron';
import logger from '../../utils/logger';
import UsageMeteringService from '../../services/billing/usageMeteringService';

export class UsageFlushJob {
  private static isRunning = false;

  /**
   * Start the cron job (runs hourly)
   */
  static start() {
    cron.schedule('0 * * * *', async () => {
      logger.info('Starting usage flush job');
      await this.run();
    });

    logger.info('Usage flush cron job scheduled');
  }

  /**
   * Run flush job manually
   */
  static async run() {
    if (this.isRunning) {
      logger.warn('Usage flush job already running');
      return;
    }

    this.isRunning = true;

    try {
      await UsageMeteringService.flushToDatabase();
      logger.info('Usage flush job completed successfully');
    } catch (error) {
      logger.error('Usage flush job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

export default UsageFlushJob;
