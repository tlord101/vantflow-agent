import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import logger from '../utils/logger';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ProjectContext {
  projectId: string;
  projectName: string;
  projectDescription: string;
}

interface GeneratedPlan {
  planName: string;
  description: string;
  summary: string;
  plan: {
    tasks: Array<{
      id: string;
      type: 'navigate' | 'click' | 'fill' | 'screenshot' | 'extract' | 'wait' | 'custom';
      name: string;
      url?: string;
      selector?: string;
      value?: any;
      timeout?: number;
      retryPolicy?: {
        maxRetries: number;
        delayMs: number;
      };
    }>;
    metadata?: {
      estimatedDuration?: number;
      estimatedCost?: number;
    };
  };
}

const SYSTEM_PROMPT = `You are VantFlow Agent, an AI assistant specialized in creating browser automation plans using Playwright.

Your role is to:
1. Understand user's automation needs from their natural language description
2. Break down the task into specific, executable steps
3. Generate a structured execution plan with detailed tasks

Available task types:
- navigate: Navigate to a URL
- click: Click on an element (requires CSS selector)
- fill: Fill a form field (requires CSS selector and value)
- screenshot: Take a screenshot of the page or element
- extract: Extract data from the page (requires CSS selector)
- wait: Wait for a specific time or element to appear
- custom: Custom JavaScript to execute

Guidelines:
- Be specific with CSS selectors (prefer data-testid, id, or unique classes)
- Include appropriate timeouts and retry policies for flaky operations
- Add wait steps between actions when needed to ensure page stability
- Consider edge cases and error scenarios
- Estimate realistic execution time based on task complexity
- Keep tasks atomic and independent where possible

Response format:
Provide a JSON response with:
{
  "planName": "Short descriptive name",
  "description": "Detailed description of what the plan does",
  "summary": "Human-friendly explanation of the plan for the user",
  "plan": {
    "tasks": [array of task objects],
    "metadata": {
      "estimatedDuration": seconds,
      "estimatedCost": estimated cost in credits/dollars
    }
  }
}`;

export async function generatePlanFromPrompt(
  prompt: string,
  conversationHistory: ConversationMessage[],
  context: ProjectContext
): Promise<GeneratedPlan> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build the full conversation context
    const messages = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'Understood. I will help create browser automation plans following these guidelines.' }] },
    ];

    // Add project context
    const contextMessage = `Project Context:\nProject Name: ${context.projectName}\nDescription: ${context.projectDescription || 'No description provided'}\n\nPlease generate an automation plan based on the following request:`;
    
    messages.push({ role: 'user', parts: [{ text: contextMessage }] });
    messages.push({ role: 'model', parts: [{ text: 'I\'m ready to help. What would you like to automate?' }] });

    // Add conversation history (limit to last 10 messages to avoid token limits)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    // Start chat session
    const chat = model.startChat({
      history: messages.slice(0, -1), // Exclude the last message as we'll send it separately
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });

    // Send the prompt
    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    let parsedResponse: GeneratedPlan;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON:', parseError);
      logger.debug('Raw response:', text);
      
      // Fallback: create a simple plan
      parsedResponse = {
        planName: 'Generated Plan',
        description: 'Plan generated from user prompt',
        summary: text,
        plan: {
          tasks: [
            {
              id: '1',
              type: 'custom',
              name: 'Custom automation based on prompt',
              value: { description: prompt },
            },
          ],
          metadata: {
            estimatedDuration: 60,
            estimatedCost: 0.01,
          },
        },
      };
    }

    // Add IDs to tasks if missing
    parsedResponse.plan.tasks = parsedResponse.plan.tasks.map((task, index) => ({
      ...task,
      id: task.id || `task-${index + 1}`,
    }));

    // Add default retry policy if missing for critical operations
    parsedResponse.plan.tasks = parsedResponse.plan.tasks.map(task => {
      if (['click', 'fill'].includes(task.type) && !task.retryPolicy) {
        return {
          ...task,
          retryPolicy: {
            maxRetries: 3,
            delayMs: 1000,
          },
        };
      }
      return task;
    });

    logger.info('Successfully generated plan from prompt');
    return parsedResponse;
  } catch (error) {
    logger.error('Error generating plan with Gemini:', error);
    throw new Error('Failed to generate plan from AI');
  }
}

export async function improvePlan(
  existingPlan: any,
  feedback: string
): Promise<GeneratedPlan> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `I have an existing automation plan that needs improvement based on user feedback.

Existing Plan:
${JSON.stringify(existingPlan, null, 2)}

User Feedback:
${feedback}

Please provide an improved version of the plan that addresses the feedback while maintaining the same JSON structure.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse and return improved plan
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;
    const improvedPlan = JSON.parse(jsonText);

    return improvedPlan;
  } catch (error) {
    logger.error('Error improving plan with AI:', error);
    throw new Error('Failed to improve plan');
  }
}
