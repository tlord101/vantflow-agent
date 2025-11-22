import { Plan } from '../services/geminiService';
import { mcpServer } from '../mcp/playwrightServer';
import logger from '../utils/logger';

export async function executeWorkflow(executionId: string, plan: Plan): Promise<any> {
  const results: any[] = [];
  
  try {
    logger.info(`Starting workflow execution: ${executionId}`);
    
    // Initialize MCP server
    await mcpServer.initialize();
    await mcpServer.createPage();

    // Execute each step in the plan
    for (const step of plan.steps) {
      logger.info(`Executing step ${step.id}: ${step.action}`);
      
      try {
        const result = await mcpServer.executeAction(step.action, {
          target: step.target,
          selector: step.target,
          url: step.target,
          value: step.value,
        });

        results.push({
          stepId: step.id,
          action: step.action,
          success: true,
          result,
        });

        // Wait a bit between steps
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (stepError: any) {
        logger.error(`Step ${step.id} failed:`, stepError);
        results.push({
          stepId: step.id,
          action: step.action,
          success: false,
          error: stepError.message,
        });
        // Continue with next step even if one fails
      }
    }

    // Clean up
    await mcpServer.close();

    return {
      success: true,
      results,
      summary: `Executed ${results.length} steps`,
    };
  } catch (error: any) {
    logger.error(`Workflow execution failed: ${executionId}`, error);
    await mcpServer.close();
    throw error;
  }
}
