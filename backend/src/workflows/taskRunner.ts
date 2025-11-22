import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { executeWorkflow } from '../agents/executionEngine';

export async function runPendingTasks() {
  try {
    // Find pending executions
    const pendingExecutions = await prisma.execution.findMany({
      where: {
        status: 'pending',
      },
      include: {
        project: true,
      },
      take: 5, // Process up to 5 at a time
    });

    if (pendingExecutions.length === 0) {
      logger.debug('No pending tasks found');
      return;
    }

    logger.info(`Found ${pendingExecutions.length} pending tasks`);

    for (const execution of pendingExecutions) {
      if (!execution.project.plan) {
        logger.warn(`Execution ${execution.id} has no plan, skipping`);
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'failed',
            logs: 'No plan available',
            completedAt: new Date(),
          },
        });
        continue;
      }

      // Update to running
      await prisma.execution.update({
        where: { id: execution.id },
        data: { status: 'running' },
      });

      // Execute
      try {
        const result = await executeWorkflow(execution.id, execution.project.plan);
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'completed',
            result,
            completedAt: new Date(),
          },
        });
        logger.info(`Task ${execution.id} completed successfully`);
      } catch (error: any) {
        logger.error(`Task ${execution.id} failed:`, error);
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'failed',
            logs: error.message,
            completedAt: new Date(),
          },
        });
      }
    }
  } catch (error) {
    logger.error('Error running pending tasks:', error);
  }
}
