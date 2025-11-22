# VantFlow Agent

AI-powered automation SaaS platform for web task automation using Gemini AI and Playwright.

## ✨ Modern Glassmorphic UI

VantFlow features a professional, modern interface with:
- **Glassmorphic Design**: Dark gradient backgrounds with frosted glass effects
- **Smooth Animations**: Fade-in, slide-up, float, and glow effects throughout
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Professional UX**: Icon-prefixed inputs, gradient buttons, and animated backgrounds
- **Real-time Updates**: Live notifications and progress tracking

## 🚀 Features

### Phase 1: Foundation
- **User Management**: Full authentication with Firebase Auth, multi-tenant organizations
- **Project Management**: Organize automations into projects with RBAC
- **API Keys**: Generate API keys for programmatic access
- **Database**: Firebase Firestore (NoSQL, real-time sync)

### Phase 2: Authentication & Security
- **Firebase Authentication**: Secure email/password authentication with ID tokens
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

### UI/UX Design System
- **Glassmorphism**: Backdrop blur effects with rgba transparency layers
- **Dark Theme**: Dark gradient backgrounds (#0a0a1e → #1a1a3e → #0f0f2e)
- **Animated Orbs**: Floating gradient orbs for depth and visual interest
- **Custom Components**: Reusable glass cards, buttons, inputs with consistent styling
- **Color Palette**: Blue/purple/cyan gradients with professional accents
- **Typography**: Gradient text effects for headings and key elements

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
- **Styling**: Tailwind CSS with custom glassmorphic design system
- **UI Library**: Headless UI + Heroicons
- **State Management**: React Context (Auth) + custom hooks
- **Real-Time**: Socket.io-client for WebSocket connections
- **HTTP Client**: Axios with interceptors
- **Notifications**: React Hot Toast with custom styling
- **Date Handling**: date-fns for formatting
- **Design System**: 
  - Glass effects (backdrop-filter blur + rgba transparency)
  - Custom animations (fade-in, slide-up, float, glow, shimmer)
  - Gradient backgrounds and text effects
  - Icon-prefixed form inputs
  - Responsive dark theme throughout

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
- **Firebase Project** ([Create one](https://console.firebase.google.com/))
  - Enable Firestore Database (Native mode)
  - Enable Authentication (Email/Password provider)
  - Generate Service Account Key
- Redis (for job queue)
- Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))
- Stripe Account ([Sign up](https://dashboard.stripe.com/register)) - for billing features

### Quick Setup Script

```bash
# Run the automated setup script
chmod +x setup.sh
./setup.sh
```

This will:
1. Install all dependencies (backend + frontend)
2. Create environment files from templates
3. Guide you through Firebase configuration
4. Set up Redis connection
5. Start all services in development mode

### Manual Installation

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
   
   Edit `.env` and add your Firebase configuration:
   ```env
   # Server
   PORT=5000
   NODE_ENV=development
   
   # Firebase
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON string
   
   # Gemini AI
   GEMINI_API_KEY=your_gemini_api_key
   
   # Redis
   REDIS_URL=redis://localhost:6379
   
   # Stripe (Optional - for billing features)
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   
   # Storage
   STORAGE_TYPE=local
   ARTIFACTS_PATH=/tmp/vantflow-artifacts
   
   # Worker
   WORKER_CONCURRENCY=2
   ```
   
   > **Note**: See [FIREBASE_MIGRATION.md](./FIREBASE_MIGRATION.md) for detailed Firebase setup instructions

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

5. **Set up Firebase Firestore**
   
   See [FIREBASE_MIGRATION.md](./FIREBASE_MIGRATION.md) for:
   - Creating Firestore database
   - Setting up security rules
   - Creating composite indexes
   - Generating service account credentials

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
- `POST /api/auth/register` - Register new user (creates Firebase user + Firestore org)
- `POST /api/auth/login` - Login user (returns Firebase custom token)
- `POST /api/auth/logout` - Logout user (revokes refresh tokens)
- `GET /api/auth/session` - Get current session with user + org data

### Users
- `GET /api/users/me` - Get current user profile with projects and API keys
- `PUT /api/users/me` - Update user profile (name, password)
- `POST /api/users/api-keys` - Create API key
- `DELETE /api/users/api-keys/:id` - Delete API key

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Plans
- `GET /api/projects/:projectId/plans` - List plans (paginated, filterable by status)
- `GET /api/plans/:id` - Get plan with runs
- `POST /api/projects/:projectId/plans` - Create plan (Zod validation)
- `PUT /api/plans/:id` - Update plan (draft only)
- `POST /api/plans/:id/approve` - Approve plan (admin only)
- `DELETE /api/plans/:id` - Delete plan

### Runs
- `GET /api/projects/:projectId/runs` - List runs (paginated, filterable by status)
- `GET /api/runs/:id` - Get run with plan and logs
- `GET /api/runs/:id/logs` - Get run logs (paginated, filterable by level)
- `POST /api/plans/:id/run` - Start run (creates job in queue)
- `POST /api/runs/:id/cancel` - Cancel run
- `GET /api/projects/:projectId/runs/stats` - Get run statistics

### Chat
- `GET /api/projects/:projectId/chat` - Get chat history
- `POST /api/projects/:projectId/chat` - Send message (generates plan via AI)
- `DELETE /api/projects/:projectId/chat` - Clear chat history

### Billing (Optional - requires Stripe setup)
- `GET /api/billing/subscription` - Get current subscription and plan
- `GET /api/billing/usage` - Get usage stats for current period
- `GET /api/billing/quota` - Get quota limits and remaining
- `POST /api/billing/checkout` - Create Stripe Checkout session
- `POST /api/billing/portal` - Create Stripe Customer Portal session
- `POST /api/billing/webhook` - Stripe webhook endpoint (for automation)

## 🎯 User Workflow

### 1. Sign Up / Login
1. Navigate to signup page with professional glassmorphic design
2. Create account with email/password (Firebase Auth)
3. Auto-creates organization in Firestore
4. Redirects to dashboard with animated glass cards

### 2. Dashboard Overview
1. View project statistics with animated counters
2. See recent projects in glass cards
3. Real-time updates via WebSocket
4. Access profile settings and API keys

### 2. Project → Chat with AI
1. Navigate to project detail page (glassmorphic tabs)
2. Select "Chat" tab with message icon
3. Type natural language automation request:
   - "Go to example.com and take a screenshot"
   - "Fill out the contact form on acme.com with test data"
   - "Extract all product titles from shop.example.com"
4. AI (Gemini 1.5 Flash) generates structured plan with tasks
5. Plan preview shown in chat message with glass styling

### 3. Review Plan → Approve
1. Switch to "Plans" tab
2. View generated plan in glass card with task breakdown
3. Review each task's parameters (URL, selectors, values, retry policies)
4. Click "Approve Plan" button (admin only)
5. Plan status changes to `approved` with animated badge

### 4. Execute Plan → Monitor Progress
1. Click "Run Plan" gradient button
2. Run is queued in Redis and worker picks it up
3. Switch to "Runs" tab to monitor with live updates
4. View real-time progress:
   - Animated progress bar
   - Live streaming logs
   - Screenshot previews in glass cards
5. Toast notifications show run completion/failure

### 5. View Results
1. Click run in list to view details in modal
2. View execution logs with timestamps and color coding
3. Download artifacts (screenshots, extracted data)
4. Review duration, success rate, and error messages
5. Share or re-run successful automations

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

## 🗄️ Database Schema (Firebase Firestore)

### Collections

#### users
- `id` (string) - Firebase Auth UID
- `email` (string) - User email
- `name` (string) - Display name
- `organizationId` (string) - Reference to organization
- `role` (string) - User role (owner/admin/member)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

#### organizations
- `id` (string) - Auto-generated
- `name` (string) - Organization name
- `ownerId` (string) - Reference to owner user
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

#### projects
- `id` (string) - Auto-generated
- `name` (string) - Project name
- `description` (string) - Optional description
- `userId` (string) - Owner user ID
- `organizationId` (string) - Organization ID
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

#### plans
- `id` (string) - Auto-generated
- `projectId` (string) - Parent project
- `name` (string) - Plan name
- `description` (string) - AI-generated description
- `tasks` (array) - JSON task definitions
- `status` (string) - draft/approved/running/completed/failed
- `createdBy` (string) - User ID
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

#### runs
- `id` (string) - Auto-generated
- `planId` (string) - Reference to plan
- `projectId` (string) - Reference to project
- `status` (string) - queued/running/completed/failed/cancelled
- `progress` (number) - 0-100
- `result` (object) - Execution results and artifacts
- `error` (object) - Error details if failed
- `startedAt` (timestamp)
- `completedAt` (timestamp)
- `createdAt` (timestamp)

#### chats
- `id` (string) - Auto-generated
- `projectId` (string) - Reference to project
- `role` (string) - user/assistant/system
- `content` (string) - Message content
- `metadata` (object) - Additional data (plan references, etc.)
- `createdAt` (timestamp)

#### apiKeys
- `id` (string) - Auto-generated
- `userId` (string) - Owner user ID
- `key` (string) - Hashed API key
- `name` (string) - Optional key name
- `createdAt` (timestamp)
- `lastUsedAt` (timestamp)

#### subscriptions (Optional - for billing)
- `id` (string) - Stripe subscription ID
- `organizationId` (string) - Reference to organization
- `planTier` (string) - free/pro/business/enterprise
- `status` (string) - active/canceled/past_due
- `currentPeriodStart` (timestamp)
- `currentPeriodEnd` (timestamp)
- `canceledAt` (timestamp)

> **Note**: Firestore is a NoSQL database. See [FIREBASE_MIGRATION.md](./FIREBASE_MIGRATION.md) for indexing strategies and security rules.

## 🔒 Security

- **Firebase Authentication** with ID token verification
- **Service Account** for secure server-side operations
- **Firestore Security Rules** for data access control
- **HTTP-only cookies** for session management (optional)
- **CORS protection** configured for frontend origin
- **Helmet.js** for security headers
- **Rate limiting** on auth endpoints (express-rate-limit)
- **Input validation** with Zod schemas
- **NoSQL injection protection** via Firebase SDK
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
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Service account JSON (as string)
- `REDIS_URL` - Production Redis connection (consider Redis Cloud)
- `GEMINI_API_KEY` - Your Gemini API key
- `NODE_ENV=production`
- `STORAGE_TYPE` - 's3' recommended for production
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` - If using S3
- `STRIPE_SECRET_KEY` - Production Stripe key (if using billing)
- `STRIPE_WEBHOOK_SECRET` - Production webhook secret

### Firebase Production Setup

1. Enable production Firestore security rules
2. Set up composite indexes for queries
3. Configure Firebase Authentication production settings
4. Set up monitoring and alerts in Firebase Console

See [FIREBASE_MIGRATION.md](./FIREBASE_MIGRATION.md) for production deployment checklist.

## 📚 Documentation

- **[FIREBASE_MIGRATION.md](./FIREBASE_MIGRATION.md)**: Complete Firebase setup guide
  - Project creation and configuration
  - Firestore security rules
  - Service account setup
  - Data migration strategies
  - Production deployment checklist

- **[PHASE3_README.md](./PHASE3_README.md)**: Detailed Phase 3 documentation
  - Complete architecture overview
  - Task types reference
  - WebSocket events reference
  - API endpoints reference
  - Troubleshooting guide

- **[docs/API.md](./docs/API.md)**: Complete API reference
- **[docs/BILLING.md](./docs/BILLING.md)**: Billing system documentation
- **[docs/SETUP.md](./docs/SETUP.md)**: Detailed setup instructions

## 🎨 UI Components

### Reusable Classes
- `.card-glass` - Glass card with backdrop blur and border
- `.btn-primary` - Primary gradient button with animations
- `.btn-glass` - Transparent glass button
- `.input-glass` - Glass input field with focus effects
- `.glass` / `.glass-strong` / `.glass-dark` - Glass utility classes
- `.text-gradient` - Gradient text effect

### Animations
- `animate-fade-in` - Fade in (0.5s)
- `animate-slide-up` - Slide up from bottom (0.5s)
- `animate-scale-in` - Scale in (0.3s)
- `animate-float` - Float effect (3s infinite)
- `animate-glow` - Glow effect (2s alternate)

### Color Palette
- Primary: Blue (#0ea5e9 → #0c4a6e)
- Accent: Purple (#a78bfa)
- Highlight: Cyan (#00f2fe)
- Background: Dark gradient (#0a0a1e → #1a1a3e → #0f0f2e)

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
**Phase 4: Billing & Subscriptions** ✅  
**UI/UX: Glassmorphic Design** ✅

Built with ❤️ using Firebase, Next.js, and Gemini AI