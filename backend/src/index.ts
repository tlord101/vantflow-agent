import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimitGeneral } from './middleware/rateLimiter';
import { startScheduler } from './workflows/scheduler';
import { initializeWebSocket } from './websocket/server';

// Routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import projectRoutes from './routes/projectRoutes';
import agentRoutes from './routes/agentRoutes';
import planRoutes from './routes/planRoutes';
import runRoutes from './routes/runRoutes';
import chatRoutes from './routes/chatRoutes';
import billingRoutes from './routes/billingRoutes';

// Billing jobs
import BillingSyncJob from './jobs/billing/syncJob';
import UsageFlushJob from './jobs/billing/usageFlushJob';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket server early to export it
export const io = initializeWebSocket(httpServer);

// Security middleware
app.use(helmet());
app.disable('x-powered-by');

// CORS configuration
app.use(cors({ 
  origin: config.cors.origin, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// General rate limiting
app.use(rateLimitGeneral);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/billing', billingRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Export app for testing
export { app };

// Start server only if not in test environment
if (config.nodeEnv !== 'test') {
  const PORT = config.port;

    httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`CORS enabled for: ${config.cors.origin}`);
    
    logger.info('✓ WebSocket server initialized');
    
    // Start background scheduler
    if (config.nodeEnv === 'production') {
      startScheduler();
      logger.info('✓ Background task scheduler started');
    } else {
      logger.info('ℹ Background scheduler disabled in development mode');
    }

    // Start billing jobs
    BillingSyncJob.start();
    UsageFlushJob.start();
    logger.info('✓ Billing jobs started');
  });  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
  });
}
