import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from '../utils/security';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';
import { config } from '../config';

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    path: '/ws',
  });

  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token);
      (socket as any).userId = decoded.userId;
      (socket as any).organizationId = decoded.organizationId;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId;
    const organizationId = (socket as any).organizationId;
    
    logger.info(`WebSocket client connected: ${socket.id} (user: ${userId})`);

    // Join user's personal room
    socket.join(`user:${userId}`);
    
    if (organizationId) {
      socket.join(`org:${organizationId}`);
    }

    // Handle project subscription
    socket.on('subscribe:project', async (projectId: string) => {
      try {
        // Verify project access
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [
              { userId },
              {
                collaborators: {
                  some: { userId },
                },
              },
            ],
          },
        });

        if (!project) {
          socket.emit('error', { message: 'Project not found or access denied' });
          return;
        }

        socket.join(`project:${projectId}`);
        socket.emit('subscribed:project', { projectId });
        logger.info(`User ${userId} subscribed to project ${projectId}`);
      } catch (error) {
        logger.error('Error subscribing to project:', error);
        socket.emit('error', { message: 'Failed to subscribe to project' });
      }
    });

    // Handle project unsubscription
    socket.on('unsubscribe:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      socket.emit('unsubscribed:project', { projectId });
      logger.info(`User ${userId} unsubscribed from project ${projectId}`);
    });

    // Handle run subscription
    socket.on('subscribe:run', async (runId: string) => {
      try {
        // Verify run access
        const run = await prisma.run.findFirst({
          where: {
            id: runId,
            project: {
              OR: [
                { userId },
                {
                  collaborators: {
                    some: { userId },
                  },
                },
              ],
            },
          },
        });

        if (!run) {
          socket.emit('error', { message: 'Run not found or access denied' });
          return;
        }

        socket.join(`run:${runId}`);
        socket.emit('subscribed:run', { runId });
        logger.info(`User ${userId} subscribed to run ${runId}`);
      } catch (error) {
        logger.error('Error subscribing to run:', error);
        socket.emit('error', { message: 'Failed to subscribe to run' });
      }
    });

    // Handle run unsubscription
    socket.on('unsubscribe:run', (runId: string) => {
      socket.leave(`run:${runId}`);
      socket.emit('unsubscribed:run', { runId });
      logger.info(`User ${userId} unsubscribed from run ${runId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });

    // Send connection success
    socket.emit('connected', {
      userId,
      organizationId,
      timestamp: new Date(),
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

// Event emitters for different types of events
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
  logger.debug(`Emitted ${event} to user ${userId}`);
}

export function emitToOrganization(organizationId: string, event: string, data: any) {
  if (!io) return;
  io.to(`org:${organizationId}`).emit(event, data);
  logger.debug(`Emitted ${event} to organization ${organizationId}`);
}

export function emitToProject(projectId: string, event: string, data: any) {
  if (!io) return;
  io.to(`project:${projectId}`).emit(event, data);
  logger.debug(`Emitted ${event} to project ${projectId}`);
}

export function emitToRun(runId: string, event: string, data: any) {
  if (!io) return;
  io.to(`run:${runId}`).emit(event, data);
  logger.debug(`Emitted ${event} to run ${runId}`);
}

export function broadcastToAll(event: string, data: any) {
  if (!io) return;
  io.emit(event, data);
  logger.debug(`Broadcasted ${event} to all clients`);
}
