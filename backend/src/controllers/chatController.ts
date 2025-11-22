import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import { generatePlanFromPrompt } from '../services/aiService';
import { z } from 'zod';

const chatMessageSchema = z.object({
  content: z.string().min(1),
  context: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string(),
    name: z.string(),
  })).optional(),
});

export const chatController = {
  // Get chat history for a project
  async getChatHistory(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { limit = '100', offset = '0' } = req.query;

      // Verify project access
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: req.user!.userId },
            {
              collaborators: {
                some: { userId: req.user!.userId },
              },
            },
          ],
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      const [messages, total] = await Promise.all([
        prisma.chatMessage.findMany({
          where: { projectId },
          orderBy: { createdAt: 'asc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.chatMessage.count({ where: { projectId } }),
      ]);

      res.json({ messages, total });
    } catch (error) {
      logger.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Failed to fetch chat history' });
    }
  },

  // Send a chat message and generate plan
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const validation = chatMessageSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid message data', details: validation.error.errors });
      }

      // Verify project access
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: req.user!.userId },
            {
              collaborators: {
                some: {
                  userId: req.user!.userId,
                  role: { in: ['owner', 'admin', 'collaborator'] },
                },
              },
            },
          ],
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      const { content, context, attachments } = validation.data;

      // Save user message
      const userMessage = await prisma.chatMessage.create({
        data: {
          projectId,
          role: 'user',
          content,
          meta: attachments ? { attachments } : undefined,
        },
      });

      // Build conversation context
      const conversationHistory = context || [];
      conversationHistory.push({
        role: 'user' as const,
        content,
      });

      // Generate plan using AI
      let aiResponse;
      try {
        aiResponse = await generatePlanFromPrompt(content, conversationHistory, {
          projectId,
          projectName: project.name,
          projectDescription: project.description || '',
        });
      } catch (aiError) {
        logger.error('Error generating plan with AI:', aiError);
        
        // Save error message
        await prisma.chatMessage.create({
          data: {
            projectId,
            role: 'assistant',
            content: 'I apologize, but I encountered an error while generating the plan. Please try again or rephrase your request.',
            meta: { error: true },
          },
        });

        return res.status(500).json({ error: 'Failed to generate plan' });
      }

      // Save assistant response
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          projectId,
          role: 'assistant',
          content: aiResponse.summary,
          meta: {
            planPreview: {
              taskCount: aiResponse.plan.tasks.length,
              estimatedDuration: aiResponse.plan.metadata?.estimatedDuration,
              estimatedCost: aiResponse.plan.metadata?.estimatedCost,
            },
          },
        },
      });

      // Create the plan (in draft status)
      const plan = await prisma.plan.create({
        data: {
          projectId,
          createdBy: req.user!.userId,
          name: aiResponse.planName || `Plan - ${new Date().toLocaleDateString()}`,
          description: aiResponse.description,
          jsonPlan: aiResponse.plan,
          status: 'draft',
          estimatedCost: aiResponse.plan.metadata?.estimatedCost,
          estimatedTime: aiResponse.plan.metadata?.estimatedDuration,
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          projectId,
          userId: req.user!.userId,
          action: 'plan_generated',
          entity: 'plan',
          entityId: plan.id,
          meta: { source: 'chat', prompt: content.substring(0, 100) },
        },
      });

      logger.info(`Plan generated from chat: ${plan.id} for project ${projectId}`);

      res.json({
        userMessage,
        assistantMessage,
        plan,
        summary: aiResponse.summary,
      });
    } catch (error) {
      logger.error('Error processing chat message:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  },

  // Clear chat history
  async clearHistory(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;

      // Verify project ownership
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: req.user!.userId },
            {
              collaborators: {
                some: {
                  userId: req.user!.userId,
                  role: { in: ['owner', 'admin'] },
                },
              },
            },
          ],
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      const deleted = await prisma.chatMessage.deleteMany({
        where: { projectId },
      });

      res.json({ message: 'Chat history cleared', deleted: deleted.count });
    } catch (error) {
      logger.error('Error clearing chat history:', error);
      res.status(500).json({ error: 'Failed to clear chat history' });
    }
  },
};
