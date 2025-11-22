# VantFlow Agent - Comprehensive Implementation Guide

## 🎯 What Was Implemented

This implementation delivers a production-ready SaaS platform for AI-powered browser automation with the following features:

### ✅ Backend Features
- **Plan Management**: Create, edit, approve, and execute automation plans
- **Job Queue System**: BullMQ-based queue with Redis for scalable plan execution
- **Real-time Updates**: WebSocket server for live progress streaming
- **AI Integration**: Gemini 1.5 Flash for natural language → structured plan generation
- **RBAC**: Role-based access control (Owner, Admin, Collaborator, Viewer)
- **Comprehensive Logging**: Detailed execution logs and activity tracking
- **Artifact Management**: Screenshot and file storage system
- **Worker Process**: Dedicated Playwright-based execution engine

### ✅ Frontend Features
- **Enhanced Dashboard**: Statistics, recent activity, quick actions
- **Project Management**: Create and manage automation projects
- **Chat Interface**: Conversational AI for plan generation
- **Real-time Monitoring**: Live log streaming and progress updates
- **WebSocket Integration**: Automatic reconnection and event handling

## 📋 Prerequisites

- **Node.js**: v18 or higher
- **Docker & Docker Compose**: Latest version
- **Git**: For cloning the repository
- **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
./quick-setup.sh

# Copy and configure environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit backend/.env and add your Gemini API key
nano backend/.env  # Add GEMINI_API_KEY=your-key-here

# Start services
docker-compose up -d postgres redis

# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start worker
cd backend
npx tsx src/queue/planWorker.ts

# Terminal 3: Start frontend
cd frontend
npm run dev
```

### Option 2: Manual Setup

#### 1. Start Infrastructure Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Verify services are running
docker ps
```

#### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and configure:
# - DATABASE_URL (should work with default)
# - GEMINI_API_KEY (required!)
# - JWT_SECRET (change in production)
nano .env

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start backend server
npm run dev
```

#### 3. Start Worker Process

In a new terminal:

```bash
cd backend

# Start the plan execution worker
npx tsx src/queue/planWorker.ts
```

#### 4. Frontend Setup

In a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Start frontend
npm run dev
```

## 🌐 Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **WebSocket**: ws://localhost:4000/ws
- **API Health Check**: http://localhost:4000/health

## 📖 User Workflow

### 1. Sign Up / Login
```
1. Navigate to http://localhost:3000
2. Click "Sign Up" to create an account
3. Or log in with existing credentials
```

### 2. Create a Project
```
1. Go to Dashboard → "New Project"
2. Enter project name and description
3. Click "Create Project"
```

### 3. Generate a Plan via Chat
```
1. Open your project
2. Go to the "Chat" tab
3. Type a natural language request:
   Example: "Navigate to google.com, search for 'automation', and take a screenshot"
4. AI will generate a structured execution plan
5. Review the plan tasks
```

### 4. Approve and Run
```
1. Review the generated plan
2. Click "Approve & Run" to execute immediately
   OR
3. Click "Approve" to save for later
4. Go to "Plans" tab to view all plans
5. Click "Run" on any approved plan
```

### 5. Monitor Execution
```
1. Go to "Runs" tab
2. Click on a running execution
3. View real-time logs and progress
4. Download artifacts (screenshots) when complete
```

## 🏗️ Architecture Overview

```
┌─────────────────┐
│   Frontend      │  Next.js + React + TailwindCSS
│   (Port 3000)   │  ↓ HTTP/WS
└─────────────────┘
        │
        ↓
┌─────────────────┐
│   Backend API   │  Express + TypeScript
│   (Port 4000)   │  ↓ Enqueue
└─────────────────┘
        │
        ↓
┌─────────────────┐
│   BullMQ Queue  │  Job Queue with Redis
│   + Worker      │  ↓ Execute
└─────────────────┘
        │
        ↓
┌─────────────────┐
│   Playwright    │  Browser Automation
│   Execution     │  → Screenshots, Logs, Data
└─────────────────┘
```

### Data Flow

1. **User Input** → Chat Interface
2. **AI Processing** → Gemini generates structured plan
3. **Plan Storage** → PostgreSQL (draft status)
4. **User Approval** → Plan status → approved
5. **Run Creation** → Run record + Job enqueued
6. **Worker Execution** → Playwright tasks
7. **Real-time Updates** → WebSocket events to UI
8. **Completion** → Artifacts saved, logs persisted

## 🛠️ Development Commands

### Backend

```bash
# Development mode with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Database commands
npm run prisma:studio    # Open Prisma Studio (DB GUI)
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
```

### Frontend

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Plans
- `GET /api/plans/projects/:projectId/plans` - List plans
- `POST /api/plans/projects/:projectId/plans` - Create plan
- `GET /api/plans/:id` - Get plan details
- `PUT /api/plans/:id` - Update plan
- `POST /api/plans/:id/approve` - Approve plan
- `POST /api/plans/:id/run` - Execute plan
- `DELETE /api/plans/:id` - Delete plan

### Runs
- `GET /api/runs/projects/:projectId/runs` - List runs
- `GET /api/runs/:id` - Get run details
- `GET /api/runs/:id/logs` - Get run logs
- `POST /api/runs/:id/cancel` - Cancel run
- `GET /api/runs/projects/:projectId/runs/stats` - Run statistics

### Chat
- `GET /api/chat/projects/:projectId/history` - Get chat history
- `POST /api/chat/projects/:projectId/message` - Send message
- `DELETE /api/chat/projects/:projectId/history` - Clear history

## 🔌 WebSocket Events

### Client → Server
- `subscribe:project` - Subscribe to project updates
- `unsubscribe:project` - Unsubscribe from project
- `subscribe:run` - Subscribe to run updates
- `unsubscribe:run` - Unsubscribe from run

### Server → Client
- `connected` - Connection established
- `plan:generated` - New plan generated
- `plan:approved` - Plan approved
- `run:started` - Run execution started
- `run:progress` - Execution progress update
- `run:log` - New log entry
- `run:completed` - Run completed successfully
- `run:failed` - Run failed
- `artifact:ready` - New artifact available

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Example Test: Plan Execution Flow
```typescript
describe('Plan Execution Flow', () => {
  it('should complete full cycle: chat → plan → approve → run', async () => {
    // Create project
    const project = await createTestProject();
    
    // Send chat message
    const chatRes = await request(app)
      .post(`/api/chat/projects/${project.id}/message`)
      .send({ content: 'Navigate to example.com' });
    
    expect(chatRes.body.plan).toBeDefined();
    
    // Approve plan
    await request(app)
      .post(`/api/plans/${chatRes.body.plan.id}/approve`);
    
    // Run plan
    const runRes = await request(app)
      .post(`/api/plans/${chatRes.body.plan.id}/run`);
    
    expect(runRes.body.status).toBe('queued');
  });
});
```

## 🐳 Docker Deployment

### Full Stack with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Individual Services

```bash
# Start only database and Redis
docker-compose up -d postgres redis

# Start backend
docker-compose up -d backend worker

# Start frontend
docker-compose up -d frontend
```

## 🔐 Security Considerations

1. **Change default secrets in production!**
   ```bash
   # Generate secure JWT secret
   openssl rand -base64 32
   ```

2. **Use environment-specific CORS origins**
   ```bash
   CORS_ORIGIN=https://your-production-domain.com
   ```

3. **Enable HTTPS in production**

4. **Set up rate limiting** (already configured in code)

5. **Use secure database credentials**

6. **Store Gemini API key securely** (use secrets manager in production)

## 📈 Scaling

### Horizontal Scaling

**Workers**: Scale worker processes independently
```bash
# Run multiple worker instances
docker-compose up -d --scale worker=3
```

**Backend**: Scale API servers with load balancer
```bash
docker-compose up -d --scale backend=2
```

### Database

- Use managed PostgreSQL service (AWS RDS, Google Cloud SQL)
- Enable connection pooling (already configured via Prisma)
- Set up read replicas for analytics

### Queue

- Use managed Redis service (AWS ElastiCache, Google Cloud Memorystore)
- Monitor queue metrics via BullMQ Dashboard

## 🐛 Troubleshooting

### Issue: Cannot connect to database
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View PostgreSQL logs
docker logs vantflow-db

# Reset database
docker-compose down -v
docker-compose up -d postgres
cd backend && npm run prisma:migrate
```

### Issue: Worker not processing jobs
```bash
# Check if Redis is running
docker ps | grep redis

# View worker logs
# If running in terminal: check the terminal output
# If running in Docker: docker logs vantflow-worker

# Restart worker
# Kill the process and restart:
npx tsx src/queue/planWorker.ts
```

### Issue: WebSocket connection failed
```bash
# Check backend logs for WebSocket init
# Ensure CORS_ORIGIN is set correctly
# Verify frontend WS_URL matches backend

# Test WebSocket manually:
wscat -c ws://localhost:4000/ws
```

### Issue: AI not generating plans
```bash
# Verify Gemini API key is set
echo $GEMINI_API_KEY

# Check backend logs for AI errors
# Ensure you have API quota remaining
```

## 📚 Additional Resources

- **Prisma Documentation**: https://www.prisma.io/docs
- **BullMQ Guide**: https://docs.bullmq.io
- **Playwright Docs**: https://playwright.dev
- **Next.js Documentation**: https://nextjs.org/docs
- **Gemini API**: https://ai.google.dev/docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

---

**Built with ❤️ using TypeScript, Next.js, Express, Playwright, and Gemini AI**
