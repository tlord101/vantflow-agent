import dotenv from 'dotenv';

// Load test environment variables if in test mode
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: '7d',
  },
  
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  
  mcp: {
    port: parseInt(process.env.MCP_PORT || '3003', 10),
  },
  
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  
  storage: {
    artifactsPath: process.env.ARTIFACTS_PATH || './artifacts',
    type: process.env.STORAGE_TYPE || 'local', // local or s3
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  },
  
  worker: {
    concurrency: process.env.WORKER_CONCURRENCY || '2',
    maxJobsPerInterval: process.env.WORKER_MAX_JOBS_PER_INTERVAL || '10',
  },
};
