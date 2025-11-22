import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import logger from '../utils/logger';
import UsageMeteringService from './billing/usageMeteringService';
import { USAGE_METRICS } from '../config/pricing';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export interface Plan {
  steps: Array<{
    id: number;
    action: string;
    description: string;
    target?: string;
    value?: string;
  }>;
  summary: string;
}

export async function generatePlanWithGemini(
  prompt: string,
  project: any
): Promise<{ plan: Plan; response: string }> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const systemPrompt = `You are an AI agent that helps users automate web tasks using browser automation.
Given a user's request, generate a detailed step-by-step execution plan.

The plan should be in JSON format with the following structure:
{
  "steps": [
    {
      "id": 1,
      "action": "navigate|click|type|extract|screenshot",
      "description": "Human-readable description",
      "target": "CSS selector or URL",
      "value": "Text to type (if action is 'type')"
    }
  ],
  "summary": "Brief summary of what the automation will do"
}

Project context:
- Name: ${project.name}
- Description: ${project.description || 'No description'}

User request: ${prompt}

Generate a practical, executable plan.`;

    const result = await model.generateContent(systemPrompt);
    const response = result.response.text();

    // Track token usage (estimate based on response length)
    const estimatedTokens = Math.ceil((systemPrompt.length + response.length) / 4);
    
    if (project.organizationId) {
      await UsageMeteringService.incrementUsage({
        organizationId: project.organizationId,
        projectId: project.id,
        metric: USAGE_METRICS.GEMINI_TOKENS,
        amount: estimatedTokens,
        metadata: {
          model: 'gemini-pro',
          promptLength: systemPrompt.length,
          responseLength: response.length,
        },
      }).catch(err => {
        logger.error('Failed to track Gemini usage:', err);
      });
    }

    // Extract JSON from response
    let plan: Plan;
    try {
      // Try to parse as JSON directly
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: create a simple plan
        plan = {
          steps: [
            {
              id: 1,
              action: 'navigate',
              description: 'Navigate to the target website',
              target: 'https://example.com',
            },
          ],
          summary: 'Execute the requested automation',
        };
      }
    } catch (parseError) {
      logger.warn('Failed to parse Gemini response as JSON, using fallback');
      plan = {
        steps: [
          {
            id: 1,
            action: 'navigate',
            description: 'Navigate to the target website',
            target: 'https://example.com',
          },
        ],
        summary: 'Execute the requested automation',
      };
    }

    return { plan, response };
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new Error('Failed to generate plan with Gemini');
  }
}
