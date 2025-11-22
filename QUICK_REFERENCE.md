# VantFlow Agent - Quick Reference Card

## 🚀 Quick Start (30 seconds)

```bash
# 1. Run setup
./quick-setup.sh

# 2. Add your Gemini API key
echo "GEMINI_API_KEY=your-key-here" >> backend/.env

# 3. Start everything
docker-compose up -d postgres redis
cd backend && npm run dev &
npx tsx src/queue/planWorker.ts &
cd ../frontend && npm run dev
```

**Open**: http://localhost:3000

---

## 📡 Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Sign up |
| POST | `/api/auth/login` | Log in |
| POST | `/api/chat/projects/:id/message` | Generate plan from chat |
| POST | `/api/plans/:id/approve` | Approve plan |
| POST | `/api/plans/:id/run` | Execute plan |
| GET | `/api/runs/:id/logs` | Get execution logs |

---

## 🎯 Task Types

| Type | Purpose | Required Fields |
|------|---------|----------------|
| `navigate` | Go to URL | `url` |
| `click` | Click element | `selector` |
| `fill` | Fill input | `selector`, `payload` |
| `screenshot` | Take screenshot | - |
| `extract` | Get data | `selector` |
| `wait` | Pause | `payload.duration` |
| `custom` | Run JS | `payload.script` |

---

## 🔌 WebSocket Events

### Subscribe
```javascript
socket.emit('subscribe:project', projectId);
socket.emit('subscribe:run', runId);
```

### Listen
```javascript
socket.on('run:started', (data) => { });
socket.on('run:progress', (data) => { });
socket.on('run:log', (data) => { });
socket.on('run:completed', (data) => { });
```

---

## 🛠️ Common Commands

### Backend
```bash
npm run dev              # Start development
npm run prisma:studio    # Open database GUI
npm run prisma:migrate   # Run migrations
npm test                 # Run tests
```

### Frontend
```bash
npm run dev              # Start development
npm run build            # Build for production
```

### Docker
```bash
docker-compose up -d                    # Start all
docker-compose logs -f backend worker   # View logs
docker-compose down                     # Stop all
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Database error | `docker-compose restart postgres` |
| Worker not running | Check Redis: `docker ps \| grep redis` |
| WebSocket fails | Verify `CORS_ORIGIN` in backend/.env |
| AI not working | Check `GEMINI_API_KEY` is set |

---

## 📊 Example Plan JSON

```json
{
  "tasks": [
    {
      "id": "1",
      "type": "navigate",
      "name": "Go to site",
      "url": "https://example.com",
      "timeout": 30000
    },
    {
      "id": "2",
      "type": "click",
      "name": "Click button",
      "selector": "button.submit",
      "retryPolicy": {
        "maxRetries": 3,
        "delayMs": 1000
      }
    },
    {
      "id": "3",
      "type": "screenshot",
      "name": "Capture result"
    }
  ],
  "metadata": {
    "estimatedDuration": 45,
    "estimatedCost": 0.02
  }
}
```

---

## 🔐 Roles & Permissions

| Role | Create Plans | Approve | Run | Delete |
|------|-------------|---------|-----|--------|
| **Owner** | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Collaborator** | ✅ | ❌ | ✅ | ❌ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ |

---

## 📁 Important Files

```
backend/
├── src/
│   ├── services/planService.ts     # Plan logic
│   ├── queue/planWorker.ts         # Execution engine
│   ├── websocket/server.ts         # Real-time events
│   └── controllers/chatController.ts # AI integration
├── prisma/schema.prisma            # Database schema
└── .env                            # Configuration

frontend/
├── lib/api.ts                      # API client
├── hooks/useWebSocketEnhanced.ts   # WebSocket hook
├── components/ChatInterface.tsx    # Chat UI
└── .env.local                      # Frontend config
```

---

## 💡 Quick Examples

### Generate a plan via API
```bash
curl -X POST http://localhost:4000/api/chat/projects/PROJECT_ID/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Navigate to google.com and take a screenshot"}'
```

### Run a plan via API
```bash
curl -X POST http://localhost:4000/api/plans/PLAN_ID/run \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Connect to WebSocket
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000', {
  path: '/ws',
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('subscribe:project', 'PROJECT_ID');
});

socket.on('run:log', (log) => {
  console.log('Log:', log.message);
});
```

---

## 🎓 User Workflow

1. **Sign Up** → `/signup`
2. **Create Project** → `/projects/new`
3. **Open Chat** → Project → Chat tab
4. **Send Message** → "Describe automation"
5. **Review Plan** → AI generates tasks
6. **Approve** → Click "Approve & Run"
7. **Monitor** → Runs tab → View logs
8. **Download** → Get screenshots/artifacts

---

## 📞 Get Help

- **Docs**: See `RUNNING_GUIDE.md`
- **API**: See `docs/API.md`
- **Architecture**: See `IMPLEMENTATION_SUMMARY.md`

---

**Happy Automating! 🤖✨**
