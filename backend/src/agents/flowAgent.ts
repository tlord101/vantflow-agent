import logger from '../utils/logger';
import { Plan } from '../services/geminiService';

export interface FlowDecision {
  shouldExecute: boolean;
  reason: string;
  modifications?: any;
}

export class FlowAgent {
  async analyzePrompt(prompt: string): Promise<{ intent: string; complexity: string }> {
    logger.info('Analyzing user prompt');

    // Simple intent analysis (in production, use Gemini for this)
    const intent = this.determineIntent(prompt);
    const complexity = this.determineComplexity(prompt);

    return { intent, complexity };
  }

  async validatePlan(plan: Plan): Promise<FlowDecision> {
    logger.info('Validating execution plan');

    // Check if plan has steps
    if (!plan.steps || plan.steps.length === 0) {
      return {
        shouldExecute: false,
        reason: 'Plan has no executable steps',
      };
    }

    // Check if all required fields are present
    const hasInvalidSteps = plan.steps.some(
      (step) => !step.action || !step.description
    );

    if (hasInvalidSteps) {
      return {
        shouldExecute: false,
        reason: 'Some steps are missing required fields',
      };
    }

    return {
      shouldExecute: true,
      reason: 'Plan is valid and ready for execution',
    };
  }

  private determineIntent(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('scrape') || lowerPrompt.includes('extract')) {
      return 'data_extraction';
    } else if (lowerPrompt.includes('fill') || lowerPrompt.includes('submit')) {
      return 'form_automation';
    } else if (lowerPrompt.includes('navigate') || lowerPrompt.includes('visit')) {
      return 'navigation';
    } else if (lowerPrompt.includes('screenshot') || lowerPrompt.includes('capture')) {
      return 'screenshot';
    }

    return 'general_automation';
  }

  private determineComplexity(prompt: string): string {
    const wordCount = prompt.split(' ').length;

    if (wordCount < 10) return 'simple';
    if (wordCount < 30) return 'medium';
    return 'complex';
  }
}

export const flowAgent = new FlowAgent();
