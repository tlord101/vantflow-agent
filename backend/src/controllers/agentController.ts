import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { generatePlanWithGemini } from '../services/geminiService';
import { executeWorkflow } from '../agents/executionEngine';

const chatSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1),
});

const runSchema = z.object({
  projectId: z.string(),
});

export const chat = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, prompt } = chatSchema.parse(req.body);

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.id,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Generate plan using Gemini
    const { plan, response } = await generatePlanWithGemini(prompt, project);

    // Store plan in settings for now (or create a Plan model record)
    await prisma.project.update({
      where: { id: projectId },
      data: { 
        settings: {
          ...(project.settings as any || {}),
          latestPlan: plan
        }
      },
    });

    logger.info(`Plan generated for project: ${projectId}`);

    res.json({
      plan,
      response,
      message: 'Plan generated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Agent chat error:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
};

export const run = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = runSchema.parse(req.body);

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: req.user!.id,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const latestPlan = (project.settings as any)?.latestPlan;
    if (!latestPlan) {
      return res.status(400).json({ error: 'No plan found for this project' });
    }

    // Create execution record
    const execution = await prisma.execution.create({
      data: {
        projectId,
        status: 'running',
      },
    });

    logger.info(`Execution started: ${execution.id} for project: ${projectId}`);

    // Execute workflow asynchronously
    executeWorkflow(execution.id, project.plan)
      .then(async (result) => {
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'completed',
            result,
            completedAt: new Date(),
          },
        });
        logger.info(`Execution completed: ${execution.id}`);
      })
      .catch(async (error) => {
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'failed',
            logs: error.message,
            completedAt: new Date(),
          },
        });
        logger.error(`Execution failed: ${execution.id}`, error);
      });

    res.status(202).json({
      execution: {
        id: execution.id,
        status: execution.status,
        createdAt: execution.createdAt,
      },
      message: 'Execution started',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Agent run error:', error);
    res.status(500).json({ error: 'Failed to run agent' });
  }
};

export const getExecutionStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { executionId } = req.params;

    // First get the execution
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Verify ownership through project
    const project = await prisma.project.findFirst({
      where: {
        id: execution.projectId,
        userId: req.user!.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const executionWithProject = {
      ...execution,
      project,
    };

    res.json({ execution: executionWithProject });
  } catch (error) {
    logger.error('Get execution status error:', error);
    res.status(500).json({ error: 'Failed to get execution status' });
  }
};
