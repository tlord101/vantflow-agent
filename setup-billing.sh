#!/bin/bash

# VantFlow Agent - Billing System Setup Script
# This script sets up the complete billing infrastructure

set -e

echo "🚀 VantFlow Agent - Billing System Setup"
echo "========================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Warning: Redis CLI not found. Please ensure Redis is installed and running."
fi

echo "✅ Prerequisites check passed"
echo ""

# Navigate to backend
cd "$(dirname "$0")/backend"

echo "📦 Installing backend dependencies..."
npm install

echo "✅ Backend dependencies installed"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit backend/.env and fill in the following required values:"
    echo "   - STRIPE_SECRET_KEY"
    echo "   - STRIPE_WEBHOOK_SECRET"
    echo "   - STRIPE_PRICE_PRO_MONTHLY"
    echo "   - STRIPE_PRICE_PRO_YEARLY"
    echo "   - STRIPE_PRICE_BUSINESS_MONTHLY"
    echo "   - STRIPE_PRICE_BUSINESS_YEARLY"
    echo ""
    read -p "Press Enter when you have updated the .env file..."
fi

# Database migration
echo "🗄️  Running database migration..."
npx prisma migrate dev --name billing_system

echo "✅ Database migration completed"
echo ""

# Generate Prisma Client
echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "✅ Prisma Client generated"
echo ""

# Navigate to frontend
cd ../frontend

echo "📦 Installing frontend dependencies..."
npm install

echo "✅ Frontend dependencies installed"
echo ""

# Back to root
cd ..

echo ""
echo "✅ Billing system setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Configure Stripe products and prices (see docs/BILLING_QUICKSTART.md)"
echo "   2. Update backend/.env with Stripe credentials"
echo "   3. Start Redis: redis-server"
echo "   4. Start backend: cd backend && npm run dev"
echo "   5. Start frontend: cd frontend && npm run dev"
echo ""
echo "   For local webhook testing:"
echo "   stripe listen --forward-to http://localhost:4000/api/billing/webhooks/stripe"
echo ""
echo "📖 Full documentation: docs/BILLING.md"
echo "🚀 Quick start guide: docs/BILLING_QUICKSTART.md"
echo ""
echo "Happy automating! 🎉"
