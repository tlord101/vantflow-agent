import cron from 'node-cron';
import logger from '../utils/logger';
import { runPendingTasks } from './taskRunner';

export function startScheduler() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    logger.info('Scheduler triggered - checking for pending tasks');
    try {
      await runPendingTasks();
    } catch (error) {
      logger.error('Scheduler error:', error);
    }
  });

  logger.info('Task scheduler started - runs every minute');
}
