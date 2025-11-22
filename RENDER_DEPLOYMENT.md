# Render Deployment Guide

Complete guide to deploy VantFlow Agent on Render with one click!

## 🚀 Quick Deploy (Recommended)

### Step 1: Connect Your GitHub Repository

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Blueprint"
3. Connect your GitHub account if not already connected
4. Select the `vantflow-agent` repository
5. Render will detect the `render.yaml` file

### Step 2: Set Environment Variables

Before deploying, you need to add these **secret** environment variables in Render Dashboard:

#### For `vantflow-backend` service:

1. Click on the `vantflow-backend` service
2. Go to "Environment" tab
3. Add these variables:

```
FIREBASE_PROJECT_ID=vantflowv1
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"vantflowv1",...your full JSON here...}
GEMINI_API_KEY=AIzaSyAKYD_WAnLedgm7B_GPA5VcxmUIBdvVs9U
CORS_ORIGIN=https://vantflow-frontend.onrender.com
```

> **Important**: For `CORS_ORIGIN`, use your actual frontend URL after it's deployed

#### For `vantflow-worker` service:

Add the same Firebase and Gemini variables:

```
FIREBASE_PROJECT_ID=vantflowv1
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GEMINI_API_KEY=AIzaSyAKYD_WAnLedgm7B_GPA5VcxmUIBdvVs9U
```

#### For `vantflow-frontend` service:

Add these after backend is deployed:

```
NEXT_PUBLIC_API_URL=https://vantflow-backend.onrender.com/api
NEXT_PUBLIC_WS_URL=https://vantflow-backend.onrender.com
```

> **Note**: Replace `vantflow-backend` with your actual backend service name

### Step 3: Deploy

1. Click "Apply" to create all services
2. Render will automatically:
   - Create Redis database
   - Deploy backend API
   - Deploy background worker
   - Deploy frontend

Wait 5-10 minutes for initial deployment.

## 📋 What Gets Deployed

### Services Created:

1. **vantflow-backend** (Web Service)
   - Express.js API
   - WebSocket server
   - Runs on port 5000
   - URL: `https://vantflow-backend.onrender.com`

2. **vantflow-worker** (Background Worker)
   - Processes automation jobs
   - Uses Playwright for browser automation
   - Connects to Redis queue

3. **vantflow-frontend** (Web Service)
   - Next.js application
   - Serves the UI
   - URL: `https://vantflow-frontend.onrender.com`

4. **vantflow-redis** (Redis Database)
   - Job queue storage
   - Auto-connected to backend and worker

## 🔧 Manual Setup (Alternative)

If you prefer manual setup without Blueprint:

### 1. Create Redis Database

1. Dashboard → New → Redis
2. Name: `vantflow-redis`
3. Plan: Free
4. Click "Create Database"
5. Copy the **Internal Redis URL**

### 2. Create Backend Service

1. Dashboard → New → Web Service
2. Connect GitHub → Select `vantflow-agent`
3. Settings:
   - **Name**: `vantflow-backend`
   - **Region**: Oregon (or nearest)
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Free

4. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=5000
   FIREBASE_PROJECT_ID=vantflowv1
   FIREBASE_SERVICE_ACCOUNT_KEY=<your-service-account-json>
   GEMINI_API_KEY=AIzaSyAKYD_WAnLedgm7B_GPA5VcxmUIBdvVs9U
   REDIS_URL=<redis-internal-url-from-step-1>
   CORS_ORIGIN=https://vantflow-frontend.onrender.com
   STORAGE_TYPE=local
   ARTIFACTS_PATH=/tmp/vantflow-artifacts
   WORKER_CONCURRENCY=2
   ```

5. Click "Create Web Service"

### 3. Create Worker Service

1. Dashboard → New → Background Worker
2. Connect same repository
3. Settings:
   - **Name**: `vantflow-worker`
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && node dist/queue/runWorker.js`

4. Add same environment variables as backend (except CORS_ORIGIN and PORT)

### 4. Create Frontend Service

1. Dashboard → New → Web Service
2. Settings:
   - **Name**: `vantflow-frontend`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Start Command**: `cd frontend && npm start`

3. Add Environment Variables:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://vantflow-backend.onrender.com/api
   NEXT_PUBLIC_WS_URL=https://vantflow-backend.onrender.com
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAwi-x6zG01qxonURhflnGPTz6fhtFQVUw
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vantflowv1.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://vantflowv1-default-rtdb.firebaseio.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=vantflowv1
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vantflowv1.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1047381509296
   NEXT_PUBLIC_FIREBASE_APP_ID=1:1047381509296:web:d834083441fb015a9f2775
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-JPEWFMF61Y
   ```

## ✅ Post-Deployment Checklist

### 1. Update Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/project/vantflowv1/settings/general)
2. Scroll to "Authorized domains"
3. Add your Render domains:
   - `vantflow-frontend.onrender.com`
   - `vantflow-backend.onrender.com`

### 2. Update CORS Origin

After frontend is deployed:
1. Go to backend service settings
2. Update `CORS_ORIGIN` to your actual frontend URL
3. Trigger redeploy

### 3. Add Health Check Endpoint

The backend already has a `/health` endpoint. Verify it works:
```
https://vantflow-backend.onrender.com/health
```

Should return: `{"status":"ok"}`

### 4. Test the Application

1. Visit your frontend URL
2. Sign up for a new account
3. Create a project
4. Send a chat message to test AI integration
5. Verify WebSocket connection in browser console

## 🐛 Troubleshooting

### Backend won't start:
- Check logs: Service → Logs tab
- Verify all environment variables are set
- Ensure Firebase service account key is valid JSON

### Worker not processing jobs:
- Check worker logs
- Verify Redis connection (REDIS_URL)
- Ensure GEMINI_API_KEY is set

### Frontend can't connect to backend:
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS settings on backend
- Ensure backend is running (green status)

### WebSocket connection fails:
- Check `NEXT_PUBLIC_WS_URL` points to backend
- Verify backend supports WebSocket upgrades
- Check browser console for errors

## 💰 Render Free Tier Limits

- **Web Services**: 750 hours/month (enough for 1 service 24/7)
- **Background Workers**: 750 hours/month
- **Redis**: 25 MB storage, 10 concurrent connections
- **Bandwidth**: 100 GB/month
- **Sleep after 15 min inactivity** (free tier)

> **Tip**: Services sleep on free tier. First request may take 30s to wake up.

## 🚀 Upgrade for Production

For production use, consider:
- Paid plans ($7/month) for no sleep
- Larger Redis instance for more jobs
- PostgreSQL for relational data (if needed)
- Custom domains
- Auto-scaling

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)

## 🎉 You're Live!

Once deployed, your app will be available at:
- **Frontend**: `https://vantflow-frontend.onrender.com`
- **API**: `https://vantflow-backend.onrender.com/api`

Share your frontend URL with users! 🚀
