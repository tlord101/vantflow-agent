#!/bin/bash

echo "🚀 VantFlow Agent - Quick Start Script"
echo "======================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your GEMINI_API_KEY and JWT_SECRET"
    echo ""
    read -p "Press enter after you've configured .env..."
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "🐘 Starting PostgreSQL database..."
docker-compose up -d postgres

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

echo "📦 Installing backend dependencies..."
cd backend
npm install

echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

echo "🔧 Generating Prisma client..."
npx prisma generate

cd ..

echo "📦 Installing frontend dependencies..."
cd frontend
npm install

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  1. Terminal 1: cd backend && npm run dev"
echo "  2. Terminal 2: cd frontend && npm run dev"
echo ""
echo "Or use Docker Compose:"
echo "  docker-compose up"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:4000"
echo ""
