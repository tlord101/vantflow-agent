import { emitToProject, emitToRun } from './server';
import logger from '../utils/logger';

// Run-related events
export function emitRunEvent(projectId: string, event: string, data: any) {
  emitToProject(projectId, event, data);
  
  if (data.runId) {
    emitToRun(data.runId, event, data);
  }
}

// Chat events
export function emitChatMessage(projectId: string, message: any) {
  emitToProject(projectId, 'chat:message', message);
}

// Plan events
export function emitPlanCreated(projectId: string, plan: any) {
  emitToProject(projectId, 'plan:created', plan);
}

export function emitPlanUpdated(projectId: string, plan: any) {
  emitToProject(projectId, 'plan:updated', plan);
}

export function emitPlanApproved(projectId: string, plan: any) {
  emitToProject(projectId, 'plan:approved', plan);
}

// Activity events
export function emitActivity(projectId: string, activity: any) {
  emitToProject(projectId, 'activity:new', activity);
}

// Notification helper
export function sendNotification(userId: string, notification: {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    label: string;
    url: string;
  };
}) {
  const { emitToUser } = require('./server');
  emitToUser(userId, 'notification', {
    ...notification,
    timestamp: new Date(),
    id: `notif-${Date.now()}`,
  });
}

logger.info('WebSocket events module loaded');
