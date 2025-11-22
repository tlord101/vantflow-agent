# VantFlow Agent - Quick Setup Guide

## Quick Start (5 minutes)

### 1. Prerequisites Check

```bash
node --version  # Should be 20+
npm --version   # Should be 10+
docker --version # Optional, for easy database setup
```

### 2. Clone & Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd vantflow-agent

# Copy environment file
cp .env.example .env
```

### 3. Configure Environment

Edit `.env` file:

```env
# Required: Get your Gemini API key from https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your-actual-gemini-api-key-here

# Required: Set a secure JWT secret (use a random string)
JWT_SECRET=your-super-secret-jwt-key-here

# Database (use Docker setup below, or provide your own PostgreSQL)
DATABASE_URL=postgresql://vantflow:vantflow_password@localhost:5432/vantflow
```

### 4. Start Database (Using Docker)

```bash
# Start PostgreSQL in Docker
docker run -d \
  --name vantflow-postgres \
  -e POSTGRES_DB=vantflow \
  -e POSTGRES_USER=vantflow \
  -e POSTGRES_PASSWORD=vantflow_password \
  -p 5432:5432 \
  postgres:16-alpine
```

### 5. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start backend server
npm run dev
```

Backend will be running at: http://localhost:4000

### 6. Setup Frontend (New Terminal)

```bash
cd frontend

# Install dependencies
npm install

# Start frontend server
npm run dev
```

Frontend will be running at: http://localhost:3000

## 🎉 You're Ready!

1. Open http://localhost:3000 in your browser
2. Sign up for a new account
3. Create your first project
4. Chat with the AI agent to create an automation
5. Run your automation!

## Common Issues

### Database Connection Failed

Make sure PostgreSQL is running:
```bash
docker ps | grep postgres
```

If not running, start it:
```bash
docker start vantflow-postgres
```

### Port Already in Use

If port 3000 or 4000 is in use, change the PORT in:
- Backend: `backend/.env` - add `PORT=4001`
- Frontend: Run with `PORT=3001 npm run dev`

### Gemini API Errors

- Verify your API key is correct
- Check you have API quota available
- Ensure billing is enabled if required

## Next Steps

### View Database (Optional)

```bash
cd backend
npx prisma studio
```

This opens a GUI at http://localhost:5555 to view/edit database records.

### Use Docker Compose (Alternative Setup)

Instead of steps 4-6, you can use:

```bash
# Make sure .env is configured
docker-compose up -d
```

This starts everything (database, backend, frontend) in one command.

### Production Deployment

See the main README.md for production deployment instructions.

## Troubleshooting

### Reset Database

```bash
cd backend
npx prisma migrate reset
npx prisma generate
```

### Clear Node Modules

```bash
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

### View Logs

Backend logs are in `backend/logs/` directory:
- `error.log` - Error logs only
- `combined.log` - All logs

## API Testing

You can test the API using curl:

```bash
# Register a user
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Support

If you encounter issues:
1. Check the logs in `backend/logs/`
2. Verify all environment variables are set
3. Ensure database is running and accessible
4. Check Node.js and npm versions match requirements

Happy automating! 🚀
