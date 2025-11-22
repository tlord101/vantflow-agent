# Billing System Quick Start Guide

This guide will help you get the billing system up and running quickly.

## Prerequisites

- Stripe account (sign up at https://stripe.com)
- Redis instance
- PostgreSQL database
- Node.js 18+ and npm

## Step 1: Stripe Setup

### 1.1 Create Products

Log into Stripe Dashboard and create products:

1. **Pro Plan**
   - Create product: "VantFlow Pro"
   - Add price: $29/month (recurring)
   - Add price: $290/year (recurring)
   - Copy price IDs

2. **Business Plan**
   - Create product: "VantFlow Business"
   - Add price: $149/month (recurring)
   - Add price: $1,490/year (recurring)
   - Copy price IDs

### 1.2 Configure Webhook

1. Go to Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/billing/webhooks/stripe`
3. Select events:
   - `customer.*`
   - `invoice.*`
   - `subscription.*`
   - `checkout.*`
   - `payment_intent.*`
4. Copy webhook signing secret

## Step 2: Environment Configuration

Update `backend/.env`:

```bash
# Stripe Keys (from Dashboard → API Keys)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs (from products created above)
STRIPE_PRICE_PRO_MONTHLY=price_1234_pro_monthly
STRIPE_PRICE_PRO_YEARLY=price_5678_pro_yearly
STRIPE_PRICE_BUSINESS_MONTHLY=price_abcd_business_monthly
STRIPE_PRICE_BUSINESS_YEARLY=price_efgh_business_yearly

# Redis (for usage metering)
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vantflow

# Email (optional for now)
SENDGRID_API_KEY=your_sendgrid_key
BILLING_ADMIN_EMAILS=admin@yourcompany.com
```

## Step 3: Database Migration

```bash
cd backend

# Run migration to create billing tables
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

This creates the following tables:
- `Subscription`
- `UsageRecord`
- `InvoiceRecord`
- `BillingEvent`
- `PaymentMethod`
- `BillingCredit`

## Step 4: Install Dependencies

```bash
cd backend
npm install stripe

cd ../frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## Step 5: Start Services

### Terminal 1: Redis
```bash
redis-server
```

### Terminal 2: Backend
```bash
cd backend
npm run dev
```

The backend will:
- Start billing sync job (daily at 2 AM)
- Start usage flush job (hourly)
- Expose billing API at `http://localhost:4000/api/billing`
- Listen for webhooks at `http://localhost:4000/api/billing/webhooks/stripe`

### Terminal 3: Frontend
```bash
cd frontend
npm run dev
```

Frontend billing pages available at:
- `/dashboard/billing` - Main dashboard
- `/dashboard/billing/upgrade` - Pricing & upgrade
- `/dashboard/billing/invoices` - Invoice history
- `/dashboard/billing/payment-methods` - Manage cards

## Step 6: Test Webhook Locally (Development)

Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.5/stripe_1.19.5_linux_x86_64.tar.gz
tar -xvf stripe_1.19.5_linux_x86_64.tar.gz
```

Forward webhooks to local server:
```bash
stripe login
stripe listen --forward-to http://localhost:4000/api/billing/webhooks/stripe
```

Trigger test events:
```bash
# Test subscription creation
stripe trigger customer.subscription.created

# Test successful payment
stripe trigger invoice.paid

# Test failed payment
stripe trigger invoice.payment_failed
```

## Step 7: Test Full Flow

### 7.1 Create Test Organization

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 7.2 Navigate to Billing

1. Login at `http://localhost:3000/login`
2. Go to `/dashboard/billing`
3. Click "Upgrade"
4. Select "Pro" plan
5. Click "Start 14-Day Trial"

This will:
- Create Stripe Checkout session
- Redirect to Stripe's hosted page
- Capture payment method
- Start trial subscription

### 7.3 Verify Subscription

Check database:
```sql
SELECT * FROM "Subscription" WHERE "organizationId" = 'your_org_id';
```

Check Stripe Dashboard:
- Go to Customers
- Find your test customer
- Verify subscription is active with trial

### 7.4 Test Usage Tracking

Trigger some API calls that use tokens:
```bash
curl -X POST http://localhost:4000/api/chat/projects/proj_123/message \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Generate a plan to scrape product data from Amazon"
  }'
```

This will:
- Call Gemini API (tracked automatically)
- Increment `gemini_tokens` usage in Redis
- Show updated usage in `/dashboard/billing`

### 7.5 Check Usage

```bash
curl http://localhost:4000/api/billing/usage \
  -H "Authorization: Bearer your_jwt_token"
```

Response:
```json
{
  "usage": [
    {
      "metric": "gemini_tokens",
      "current": 1250,
      "limit": 100000,
      "percentage": 1.25,
      "unlimited": false
    }
  ]
}
```

## Step 8: Test Quota Enforcement

### 8.1 Manually Exceed Quota

Update Redis to simulate quota exceeded:
```bash
redis-cli
SET usage:org:your_org_id:metric:gemini_tokens:2024-11 101000
```

### 8.2 Try Creating a Chat

```bash
curl -X POST http://localhost:4000/api/chat/projects/proj_123/message \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test"}'
```

Response (HTTP 402):
```json
{
  "error": "Quota exceeded",
  "message": "Your organization has reached its monthly token quota. Upgrade now to continue running automations without interruption.",
  "quota": {
    "metric": "gemini_tokens",
    "current": 101000,
    "limit": 100000,
    "percentage": 101
  },
  "upgradeUrl": "/billing/upgrade"
}
```

## Step 9: Production Deployment

### 9.1 Update Environment

Switch to production Stripe keys:
```bash
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
```

Update price IDs to production prices.

### 9.2 Configure Production Webhook

1. Stripe Dashboard → Webhooks
2. Add endpoint: `https://api.yourproductiondomain.com/api/billing/webhooks/stripe`
3. Select same events as before
4. Update `STRIPE_WEBHOOK_SECRET`

### 9.3 Deploy Services

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build

# Deploy to your infrastructure
# (Docker, Kubernetes, etc.)
```

### 9.4 Verify Deployment

Test health:
```bash
curl https://api.yourproductiondomain.com/health
```

Test billing endpoint:
```bash
curl https://api.yourproductiondomain.com/api/billing/plans
```

## Common Issues

### Webhook signature verification fails

**Problem**: `Webhook signature verification failed`

**Solution**:
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check webhook endpoint is using raw body (`express.raw()`)
- Ensure HTTPS in production

### Usage not tracking

**Problem**: Usage stays at 0

**Solution**:
- Check Redis is running: `redis-cli ping`
- Verify `REDIS_URL` in `.env`
- Check logs for metering errors
- Run flush job manually: `UsageFlushJob.run()`

### Quota not enforcing

**Problem**: Requests succeed even when quota exceeded

**Solution**:
- Verify middleware is applied to routes
- Check organization has active subscription
- Review quota limits in `pricing.ts`

### Checkout session fails

**Problem**: Error creating checkout session

**Solution**:
- Verify price IDs in environment variables
- Check Stripe key is correct (test vs live)
- Ensure customer exists in Stripe

## Next Steps

1. **Customize Pricing**: Update `backend/src/config/pricing.ts`
2. **Add Email Notifications**: Integrate SendGrid or similar
3. **Create Admin Dashboard**: Build UI for billing operations
4. **Set Up Monitoring**: Track payment failures, quota exceeded events
5. **Add Tests**: Write integration tests for billing flows

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Billing System Docs](./BILLING.md)
- [API Reference](./API.md)
- [Deployment Guide](./SETUP.md)

## Support

Questions or issues? Contact:
- **Email**: support@vantflow.com
- **Docs**: https://docs.vantflow.com
