#!/bin/bash

# VantFlow Agent - Quick Setup Script
set -e

echo "🚀 VantFlow Agent Setup"
echo "======================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v18+) first."
    exit 1
fi

echo "✓ Prerequisites check passed"
echo ""

# Start PostgreSQL and Redis with Docker
echo "📦 Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Backend setup
echo ""
echo "🔧 Setting up backend..."
cd backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

cd ..

# Frontend setup
echo ""
echo "🎨 Setting up frontend..."
cd frontend

# Install dependencies
npm install

# Install additional packages for new features
npm install socket.io-client @dnd-kit/core @dnd-kit/sortable

cd ..

# Create artifacts directory
echo ""
echo "📁 Creating artifacts directory..."
mkdir -p backend/artifacts

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Copy .env.example to .env in both backend and frontend directories"
echo "2. Update the environment variables with your configuration"
echo "3. Start the backend: cd backend && npm run dev"
echo "4. Start the worker: cd backend && npx tsx src/queue/planWorker.ts"
echo "5. Start the frontend: cd frontend && npm run dev"
echo ""
echo "🌐 The application will be available at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:4000"
echo "   WebSocket: ws://localhost:4000/ws"
echo ""
echo "Happy automating! 🎉"
