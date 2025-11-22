# VantFlow Agent

AI-powered automation SaaS platform for web task automation using Gemini AI and Playwright.

## 🚀 Features

### Phase 1: Foundation
- **User Management**: Full authentication with Firebase Auth, multi-tenant organizations
- **Project Management**: Organize automations into projects with RBAC
- **API Keys**: Generate API keys for programmatic access
- **Database**: Firebase Firestore (NoSQL)

### Phase 2: Authentication & Security
- **Secure Authentication**: Firebase Authentication with email/password
- **Multi-Tenancy**: Organization-based access control with automatic org creation
- **Protected Routes**: Middleware-based route protection with Firebase ID token verification
- **Rate Limiting**: Request throttling and security headers
- **Comprehensive Testing**: Jest + Supertest test suite for auth flows

### Phase 3: CMS Core & AI Automation
- **AI-Driven Planning**: Chat interface with Gemini 1.5 Flash for natural language plan generation
- **Plan Management**: Review, approve, and execute automation plans with task visualization
- **Browser Automation**: 7 task types (navigate, click, fill, screenshot, extract, wait, custom) using Playwright
- **Job Queue System**: BullMQ + Redis for background execution with retry policies
- **Real-Time Updates**: WebSocket integration for live progress, logs, and notifications
- **Execution Monitoring**: Run tracking with live logs, progress bars, and artifacts (screenshots, data)
- **Artifact Management**: Storage and display of execution results (filesystem or S3)
- **Notification Center**: Real-time notifications with read/unread tracking

### Phase 4: Billing & Subscriptions
- **Stripe Integration**: Full subscription management with Stripe Checkout and Customer Portal
- **Usage Metering**: Track AI tokens, run minutes, screenshots with Redis counters
- **Quota Enforcement**: Real-time quota checking with 80% and 95% warning thresholds
- **Tiered Pricing**: Free, Pro, Business, and Enterprise plans with overage pricing
- **Webhook Processing**: Automated subscription lifecycle management
- **Invoice Management**: Automated invoicing with payment tracking

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: Firebase Firestore (NoSQL, real-time)
- **Authentication**: Firebase Auth
- **Job Queue**: BullMQ + Redis
- **Real-Time**: Socket.io WebSocket server
- **AI**: Google Gemini 1.5 Flash API
- **Automation**: Playwright browser automation
- **Payments**: Stripe (subscriptions, billing, webhooks)
- **Validation**: Zod schemas for type-safe validation
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand (WebSocket, notifications) + React Query (server state)
- **UI Components**: Headless UI + Heroicons
- **Real-Time**: Socket.io-client
- **HTTP Client**: Axios
- **Notifications**: React Hot Toast
- **Date Handling**: date-fns

## 📁 Project Structure

```
/backend
  /src
    /config            - Configuration (Firebase, pricing)
    /controllers       - Route handlers (auth, projects, plans, runs, chat, billing)
    /routes            - API routes
    /services          - Business logic (AI, execution, billing/stripe, usage metering)
    /queue             - BullMQ job queue and worker
    /websocket         - Socket.io server and event emitters
    /lib               - Firebase/Firestore service layer
    /middleware        - Auth (Firebase ID token), error handling, quota enforcement
    /utils             - Utilities (logger, security, validation)
    /jobs              - Scheduled jobs (billing sync, usage flush)
  
/frontend
  /app                 - Next.js 14 app router pages
    /dashboard         - Dashboard with stats and billing
    /projects          - Project list and detail pages
    /auth              - Login, register, logout
    /dashboard/billing - Billing dashboard and pricing pages
  /components          - Reusable React components
  /hooks               - Custom hooks (useWebSocket, useNotifications, useProjects)
  /lib                 - API client & utilities
  /styles              - Global styles

/docs                  - Additional documentation
```

## 🚦 Getting Started

### Prerequisites

- Node.js 20+
- Firebase Project ([Create one](https://console.firebase.google.com/))
- Redis (for job queue)
- Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))
- Stripe Account ([Sign up](https://dashboard.stripe.com/register))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vantflow-agent
   ```

2. **Set up backend environment variables**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit `.env` and add your configuration:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/vantflow
   
   # Auth
   JWT_SECRET=your-super-secret-jwt-key-change-this
   COOKIE_SECRET=your-cookie-secret-change-this
   SESSION_EXPIRY=7d
   
   # Gemini AI
   GEMINI_API_KEY=your_gemini_api_key
   
   # Redis
   REDIS_URL=redis://localhost:6379
   
   # Storage
   STORAGE_TYPE=local
   ARTIFACTS_PATH=/tmp/vantflow-artifacts
   
   # Worker
   WORKER_CONCURRENCY=2
   ```

3. **Set up frontend environment variables**
   ```bash
   cd ../frontend
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_WS_URL=http://localhost:5000
   ```

4. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

5. **Set up database**
   ```bash
   cd backend
   npx prisma migrate dev --name init
   npx prisma generate
   ```

6. **Start Redis**
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Or using Homebrew (macOS)
   brew install redis
   brew services start redis
   
   # Or using apt (Ubuntu)
   sudo apt install redis-server
   sudo systemctl start redis
   ```

### Running Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Worker:**
```bash
cd backend
npx tsx src/queue/runWorker.ts
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

- Backend API: http://localhost:5000
- WebSocket: ws://localhost:5000
- Frontend: http://localhost:3000

### Running Tests

```bash
cd backend
npm test
```

## 📡 API Endpoints

### Authentication
- `POST /auth/register` - Register new user (creates organization)
- `POST /auth/login` - Login user (returns JWT in cookie)
- `POST /auth/logout` - Logout user (clears cookie)
- `GET /auth/session` - Get current session

### Projects
- `POST /projects` - Create project
- `GET /projects` - List user's projects
- `GET /projects/:id` - Get project details
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

### Plans
- `GET /projects/:projectId/plans` - List plans (paginated, filterable by status)
- `GET /plans/:id` - Get plan with runs
- `POST /projects/:projectId/plans` - Create plan (Zod validation)
- `PUT /plans/:id` - Update plan (draft only)
- `POST /plans/:id/approve` - Approve plan (admin only)
- `DELETE /plans/:id` - Delete plan

### Runs
- `GET /projects/:projectId/runs` - List runs (paginated, filterable by status)
- `GET /runs/:id` - Get run with plan and logs
- `GET /runs/:id/logs` - Get run logs (paginated, filterable by level)
- `POST /plans/:id/run` - Start run (creates job in queue)
- `POST /runs/:id/cancel` - Cancel run
- `GET /projects/:projectId/runs/stats` - Get run statistics

### Chat
- `GET /projects/:projectId/chat` - Get chat history
- `POST /projects/:projectId/chat` - Send message (generates plan via AI)
- `DELETE /projects/:projectId/chat` - Clear chat history

## 🎯 User Workflow

### 1. Login → Dashboard
1. User logs in with credentials
2. Dashboard shows project stats and recent activity
3. Click "Create Project" or select existing project

### 2. Project → Chat with AI
1. Navigate to project detail page
2. Select "Chat" tab
3. Type natural language automation request:
   - "Go to example.com and take a screenshot"
   - "Fill out the contact form on acme.com with test data"
   - "Extract all product titles from shop.example.com"
4. AI generates structured plan with tasks
5. Plan preview shown in chat message

### 3. Review Plan → Approve
1. Switch to "Plans" tab
2. View generated plan with task breakdown
3. Review each task's parameters (URL, selectors, values, retry policies)
4. Click "Approve Plan" (admin only)
5. Plan status changes to `approved`

### 4. Execute Plan → Monitor Progress
1. Click "Run Plan" button
2. Run is queued and worker picks it up
3. Switch to "Runs" tab to monitor
4. View real-time progress (progress bar, live logs, screenshots)
5. Notifications show run completion/failure

### 5. View Results
1. Click run in list to view details
2. View execution logs with timestamps
3. View artifacts (screenshots, extracted data)
4. Review duration and error messages (if failed)

## 🤖 AI Agent System

### Gemini Integration
- **Model**: Gemini 1.5 Flash
- **System Prompt**: Defines VantFlow Agent role and task types
- **Conversation Context**: Maintains chat history for better understanding
- **Structured Output**: JSON plan with tasks, retry policies, timeouts
- **Validation**: Zod schemas ensure type safety

### Task Types (7 types)

1. **Navigate**: Go to URL with `waitUntil: networkidle`
2. **Click**: Click element with retry policy
3. **Fill**: Fill form field with retry policy
4. **Screenshot**: Capture full page or element
5. **Extract**: Extract data via selector or custom script
6. **Wait**: Wait for duration, selector, or URL
7. **Custom**: Execute custom JavaScript

See [PHASE3_README.md](./PHASE3_README.md) for detailed task type documentation.

## 🔄 Real-Time Updates (WebSocket)

### Connection
- JWT-based authentication
- Auto-reconnect on disconnect
- Room-based subscriptions (user, org, project, run)

### Events

**Run Events**:
- `run:started` - Run execution begins
- `run:progress` - Task completed (updates progress bar)
- `run:task_completed` - Individual task done
- `run:completed` - Run finishes successfully
- `run:failed` - Run fails
- `run:log` - New log entry

**Chat Events**:
- `chat:message` - New chat message

**Plan Events**:
- `plan:created` - New plan created
- `plan:updated` - Plan updated
- `plan:approved` - Plan approved

**Notification Events**:
- `notification` - Generic notification

See [PHASE3_README.md](./PHASE3_README.md) for complete WebSocket documentation.

## 🗄️ Database Schema

### Core Models (Phase 1 & 2)
- **User**: User accounts with authentication
- **Organization**: Multi-tenant support for teams
- **Project**: Automation projects
- **ApiKey**: API keys for programmatic access
- **Session**: JWT session management

### Phase 3 Models
- **Plan**: Automation plans with JSON tasks (draft/approved/running/completed/failed)
- **Run**: Execution runs with status tracking (queued/running/completed/failed/cancelled)
- **LogEntry**: Execution logs with levels (info/warn/error/debug)
- **ChatMessage**: AI conversation history
- **ActivityLog**: Audit trail for plan/run actions
- **ProjectCollaborator**: RBAC with roles (owner/admin/member/viewer)

## 🔒 Security

- **Password hashing** with bcrypt (10 salt rounds)
- **JWT authentication** with 7-day expiration
- **HTTP-only cookies** for secure session storage
- **CORS protection** configured for frontend
- **Helmet.js** for security headers
- **Rate limiting** on auth endpoints
- **Input validation** with Zod schemas
- **SQL injection protection** via Prisma ORM
- **Comprehensive test coverage** for auth flows

## 🚀 Deployment

### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Worker:**
```bash
cd backend
NODE_ENV=production npx tsx src/queue/runWorker.ts
```

**Frontend:**
```bash
cd frontend
npm run build
npm start
```

### Environment Variables for Production

Make sure to set secure values for:
- `JWT_SECRET` - Use a strong random string (32+ characters)
- `COOKIE_SECRET` - Use a strong random string
- `DATABASE_URL` - Production database connection
- `REDIS_URL` - Production Redis connection
- `GEMINI_API_KEY` - Your Gemini API key
- `NODE_ENV=production`
- `STORAGE_TYPE` - 's3' recommended for production
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` - If using S3

## 📚 Documentation

- **[PHASE3_README.md](./PHASE3_README.md)**: Detailed Phase 3 documentation
  - Complete architecture overview
  - Task types reference
  - WebSocket events reference
  - API endpoints reference
  - Troubleshooting guide
  - Next steps and pending features

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue in the repository.

---

**Phase 1: Foundation** ✅  
**Phase 2: Auth System** ✅  
**Phase 3: CMS Core & AI Automation** ✅