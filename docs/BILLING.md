# VantFlow Agent CMS - Billing & Subscription System

## Overview

This document describes the complete billing, subscription management, metered usage tracking, invoicing, and payment integration system for the VantFlow Agent CMS SaaS product.

## Table of Contents

1. [Architecture](#architecture)
2. [Pricing & Plans](#pricing--plans)
3. [Usage Metering](#usage-metering)
4. [Quota Enforcement](#quota-enforcement)
5. [Stripe Integration](#stripe-integration)
6. [Webhooks](#webhooks)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [Scheduled Jobs](#scheduled-jobs)
10. [Testing](#testing)
11. [Deployment](#deployment)

---

## Architecture

### High-Level Components

```
┌─────────────────┐
│   Frontend      │
│   (Next.js)     │
└────────┬────────┘
         │
         ├── Billing Dashboard
         ├── Pricing Page
         ├── Invoices UI
         └── Usage Analytics
         │
         ↓
┌─────────────────┐
│   Backend API   │
│   (Express.js)  │
└────────┬────────┘
         │
         ├── Billing Controller
         ├── Quota Middleware
         └── Webhook Handler
         │
         ↓
┌─────────────────┬─────────────────┐
│  Stripe API     │  Redis          │
│  (Payments)     │  (Usage Counters)│
└─────────────────┴─────────────────┘
         │
         ↓
┌─────────────────┐
│   PostgreSQL    │
│   (Data Store)  │
└─────────────────┘
```

### Database Schema

**Key Models:**

- **Subscription**: Manages organization subscriptions with Stripe integration
- **UsageRecord**: Stores aggregated usage metrics per billing period
- **InvoiceRecord**: Tracks invoices from Stripe
- **BillingEvent**: Logs all billing events for audit trail
- **PaymentMethod**: Stores payment method metadata
- **BillingCredit**: Manages manual credits and refunds

---

## Pricing & Plans

### Tiers

#### Free
- **Price**: $0/month
- **Quotas**:
  - 1 Project
  - 1,000 AI tokens/month
  - 50 automation minutes/month
  - 20 screenshots/month
  - 1 concurrent run
  - 1 team member
- **Features**: Basic automation, community support
- **Trial**: None

#### Pro
- **Price**: $29/month or $290/year (17% savings)
- **Quotas**:
  - 10 Projects
  - 100K AI tokens/month
  - 500 automation minutes/month
  - 1,000 screenshots/month
  - 3 concurrent runs
  - 5 team members
- **Features**: Advanced AI models, email support, priority queue
- **Overage Pricing**:
  - Tokens: $0.20 per 1K tokens
  - Run minutes: $0.10 per minute
  - Screenshots: $0.05 each
- **Trial**: 14 days

#### Business
- **Price**: $149/month or $1,490/year (17% savings)
- **Quotas**:
  - 50 Projects
  - 1M AI tokens/month
  - 5,000 automation minutes/month
  - 10,000 screenshots/month
  - 10 concurrent runs
  - 50 team members
- **Features**: All AI models, priority support, advanced analytics, custom webhooks, 99.9% SLA
- **Overage Pricing**:
  - Tokens: $0.15 per 1K tokens
  - Run minutes: $0.08 per minute
  - Screenshots: $0.03 each
- **Trial**: 14 days

#### Enterprise
- **Price**: Custom (contact sales)
- **Quotas**: Unlimited everything
- **Features**: All features + SSO/SAML, dedicated support, custom SLA, on-premise option
- **Trial**: 30 days

### Configuration

Pricing is defined in `backend/src/config/pricing.ts`:

```typescript
export const PRICING_PLANS: Record<string, PlanPricing> = {
  free: { ... },
  pro: { ... },
  business: { ... },
  enterprise: { ... },
};
```

Stripe Price IDs are configured via environment variables:
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_BUSINESS_MONTHLY`
- `STRIPE_PRICE_BUSINESS_YEARLY`

---

## Usage Metering

### Metrics Tracked

1. **gemini_tokens**: AI token consumption from Gemini API calls
2. **run_minutes**: Automation execution time (rounded up to nearest minute)
3. **screenshots**: Number of screenshots taken during runs
4. **api_calls**: General API usage (optional)

### Redis-Based Counters

Usage is tracked in Redis for real-time atomic increments:

```typescript
// Increment usage
await UsageMeteringService.incrementUsage({
  organizationId: 'org_123',
  projectId: 'proj_456',
  metric: 'gemini_tokens',
  amount: 1250,
  metadata: { model: 'gemini-pro' },
});
```

**Key Pattern**: `usage:org:{orgId}:metric:{metric}:YYYY-MM`

### Usage Flush Job

Runs **hourly** to flush Redis counters to PostgreSQL:

```typescript
// backend/src/jobs/billing/usageFlushJob.ts
cron.schedule('0 * * * *', async () => {
  await UsageMeteringService.flushToDatabase();
});
```

### Quota Warnings

Emits WebSocket events at 80% and 95% thresholds:

```typescript
io.to(`org:${organizationId}`).emit('quota:warning', {
  metric: 'gemini_tokens',
  current: 80000,
  limit: 100000,
  percentage: 80,
});
```

---

## Quota Enforcement

### Middleware

Quota enforcement middleware checks usage before allowing operations:

```typescript
// Check before starting a run
router.post(
  '/api/runs',
  authenticateToken,
  checkActiveSubscription,
  checkRunQuota(5), // Estimated 5 minutes
  checkConcurrentRunsLimit,
  runController.create
);
```

### HTTP 402 Response

When quota is exceeded:

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

### Enforcement Points

1. **Projects**: Check project count before creating new project
2. **Team Members**: Check before inviting new users
3. **Concurrent Runs**: Check before enqueueing run
4. **AI Tokens**: Check before Gemini API call
5. **Run Minutes**: Check before starting execution

---

## Stripe Integration

### Customer Management

Organizations are linked to Stripe customers:

```typescript
const customerId = await StripeService.ensureCustomer({
  organizationId: 'org_123',
  email: 'admin@company.com',
  name: 'Company Inc',
});
```

### Checkout Sessions

Create hosted Checkout for new subscriptions:

```typescript
const session = await StripeService.createCheckoutSession({
  organizationId: 'org_123',
  priceId: 'price_pro_monthly',
  successUrl: 'https://app.vantflow.com/billing?success=true',
  cancelUrl: 'https://app.vantflow.com/billing/upgrade',
  trialDays: 14,
});

// Redirect user to session.url
```

### Customer Portal

Stripe's hosted portal for managing subscriptions:

```typescript
const portalUrl = await StripeService.createPortalSession(
  organizationId,
  'https://app.vantflow.com/billing'
);

// Redirect user to portalUrl
```

Customers can:
- Update payment methods
- Change subscription plans
- Cancel subscriptions
- View invoices
- Download receipts

### Subscriptions

Managed automatically via webhooks. Supports:
- Trials (14 days for Pro/Business)
- Proration when upgrading/downgrading
- Cancellation (at period end or immediate)
- Automatic renewal

---

## Webhooks

### Endpoint

**POST** `/api/billing/webhooks/stripe`

Must be configured in Stripe Dashboard:
- URL: `https://yourdomain.com/api/billing/webhooks/stripe`
- Events: Select all `customer.*`, `invoice.*`, `subscription.*`, `checkout.*`

### Signature Verification

```typescript
const event = StripeService.constructWebhookEvent(
  req.body,
  req.headers['stripe-signature']
);
```

Requires `STRIPE_WEBHOOK_SECRET` environment variable.

### Handled Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Notify organization of successful checkout |
| `customer.subscription.created` | Create subscription record in database |
| `customer.subscription.updated` | Update subscription status, period, plan tier |
| `customer.subscription.deleted` | Mark subscription as canceled |
| `invoice.created` | Create invoice record |
| `invoice.paid` | Update invoice status, emit payment success event |
| `invoice.payment_failed` | Update status, send payment failure notification |
| `invoice.finalized` | Update invoice with PDF URL |
| `payment_intent.succeeded` | Log successful payment |
| `payment_intent.payment_failed` | Log failed payment |
| `charge.refunded` | Create billing credit |

### Idempotency

All webhook events are deduplicated using `stripeEventId`:

```typescript
const existing = await prisma.billingEvent.findUnique({
  where: { stripeEventId: event.id },
});

if (existing) {
  return res.json({ received: true, duplicate: true });
}
```

### Error Handling

Failed webhooks are retried with exponential backoff:

```typescript
await prisma.billingEvent.update({
  where: { id: billingEventId },
  data: {
    retryCount: { increment: 1 },
    errorMessage: error.message,
  },
});
```

---

## API Endpoints

### Public

#### GET `/api/billing/plans`
Get available pricing plans.

**Response:**
```json
{
  "plans": [
    {
      "tier": "pro",
      "name": "Pro",
      "description": "For professionals and growing teams",
      "monthlyPrice": 2900,
      "yearlyPrice": 29000,
      "quotas": { ... },
      "features": [ ... ],
      "popular": true,
      "trialDays": 14
    }
  ]
}
```

### Protected (require authentication)

#### GET `/api/billing/subscription`
Get current subscription.

**Response:**
```json
{
  "subscription": {
    "id": "sub_123",
    "planTier": "pro",
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "trialEndsAt": null,
    "cancelAtPeriodEnd": false
  },
  "plan": { ... }
}
```

#### POST `/api/billing/checkout`
Create Stripe Checkout session.

**Request:**
```json
{
  "priceId": "price_pro_monthly",
  "successUrl": "https://app.vantflow.com/billing?success=true",
  "cancelUrl": "https://app.vantflow.com/billing/upgrade",
  "promoCode": "LAUNCH50"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_123",
  "url": "https://checkout.stripe.com/pay/cs_test_123"
}
```

#### POST `/api/billing/portal`
Create Customer Portal session.

**Request:**
```json
{
  "returnUrl": "https://app.vantflow.com/billing"
}
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/abc123"
}
```

#### POST `/api/billing/subscription/cancel`
Cancel subscription.

**Request:**
```json
{
  "immediate": false
}
```

#### GET `/api/billing/usage`
Get usage statistics.

**Response:**
```json
{
  "usage": [
    {
      "metric": "gemini_tokens",
      "current": 45000,
      "limit": 100000,
      "percentage": 45,
      "unlimited": false,
      "periodStart": "2024-01-01T00:00:00Z",
      "periodEnd": "2024-02-01T00:00:00Z"
    }
  ]
}
```

#### GET `/api/billing/usage/:metric/history`
Get usage history for a metric.

**Query Params:**
- `months`: Number of months (default: 6)

**Response:**
```json
{
  "history": [
    { "period": "2024-01", "quantity": 95000 },
    { "period": "2023-12", "quantity": 82000 }
  ]
}
```

#### GET `/api/billing/quota`
Get comprehensive quota summary.

**Response:**
```json
{
  "plan": {
    "tier": "pro",
    "name": "Pro"
  },
  "subscription": { ... },
  "usage": [ ... ],
  "limits": {
    "projects": { "current": 3, "limit": 10, "unlimited": false },
    "teamMembers": { "current": 2, "limit": 5, "unlimited": false },
    "concurrentRuns": { "current": 1, "limit": 3, "unlimited": false }
  }
}
```

#### GET `/api/billing/invoices`
List invoices.

**Query Params:**
- `limit`: Number of invoices (default: 20)

**Response:**
```json
{
  "invoices": [
    {
      "id": "inv_123",
      "invoiceNumber": "INV-2024-0001",
      "amountCents": 2900,
      "totalCents": 2900,
      "status": "paid",
      "pdfUrl": "https://pay.stripe.com/invoice/inv_123/pdf",
      "paidAt": "2024-01-15T12:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET `/api/billing/invoices/:id`
Get invoice details.

#### GET `/api/billing/payment-methods`
List payment methods.

**Response:**
```json
{
  "paymentMethods": [
    {
      "id": "pm_123",
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "exp_month": 12,
        "exp_year": 2025
      }
    }
  ]
}
```

#### POST `/api/billing/payment-methods`
Add payment method.

**Request:**
```json
{
  "paymentMethodId": "pm_new_card"
}
```

---

## Frontend Components

### Billing Dashboard
**Path**: `/app/dashboard/billing/page.tsx`

Features:
- Current plan display
- Subscription status badge
- Usage meters with progress bars
- Quick actions (invoices, payment methods, usage analytics)
- "Manage Subscription" button (opens Stripe Portal)
- "Upgrade" button (navigates to pricing)

### Pricing/Upgrade Page
**Path**: `/app/dashboard/billing/upgrade/page.tsx`

Features:
- All pricing tiers displayed
- Monthly/yearly toggle with savings badge
- Current plan highlighted
- Popular plan badge
- Detailed quota comparison
- Feature lists
- Trial information
- "Start Trial" or "Get Started" CTAs
- Opens Stripe Checkout on selection

### Invoices Page
**Path**: `/app/dashboard/billing/invoices/page.tsx` (to be created)

Features:
- Invoice list with status badges
- Download PDF links
- Payment status
- Date and amount
- Filters by status

### Payment Methods Page
**Path**: `/app/dashboard/billing/payment-methods/page.tsx` (to be created)

Features:
- List of cards
- Last 4 digits, brand, expiry
- Default indicator
- Add new card via Stripe Elements
- Remove card option

### Usage Analytics Page
**Path**: `/app/dashboard/billing/usage/page.tsx` (to be created)

Features:
- Historical usage charts (6 months)
- Per-metric breakdown
- Export CSV
- Overage projections

---

## Scheduled Jobs

### Billing Sync Job
**File**: `backend/src/jobs/billing/syncJob.ts`

**Schedule**: Daily at 2 AM

**Tasks**:
1. Sync subscription statuses with Stripe
2. Sync invoice statuses
3. Check trial expirations (send notifications)
4. Check payment failures (send reminders)
5. Process usage overages (create invoices)
6. Clean up old billing events (30+ days)

**Start**:
```typescript
BillingSyncJob.start();
```

### Usage Flush Job
**File**: `backend/src/jobs/billing/usageFlushJob.ts`

**Schedule**: Hourly

**Tasks**:
1. Scan all Redis usage keys
2. Aggregate and write to PostgreSQL `UsageRecord` table
3. Keep Redis counters for real-time access

**Start**:
```typescript
UsageFlushJob.start();
```

---

## Testing

### Unit Tests

```bash
npm test -- billing
```

**Coverage**:
- `stripeService.test.ts`: Stripe API wrapper
- `usageMeteringService.test.ts`: Redis atomic operations
- `quotaEnforcement.test.ts`: Middleware logic
- `webhookHandler.test.ts`: Event processing

### Integration Tests

```bash
npm test:integration
```

**Scenarios**:
- Complete signup → trial → upgrade flow
- Usage tracking → quota exceeded → upgrade
- Webhook processing → subscription status changes
- Overage calculation → invoice generation

### Manual Testing with Stripe CLI

```bash
# Listen to webhooks locally
stripe listen --forward-to http://localhost:4000/api/billing/webhooks/stripe

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.paid
stripe trigger payment_intent.payment_failed
```

---

## Deployment

### Environment Variables

**Required**:
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
REDIS_URL=redis://...
DATABASE_URL=postgresql://...
```

**Optional**:
```bash
SENDGRID_API_KEY=SG....
BILLING_ADMIN_EMAILS=admin@vantflow.com
```

### Database Migration

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### Stripe Setup

1. **Create Products in Stripe**:
   - Pro Monthly
   - Pro Yearly
   - Business Monthly
   - Business Yearly

2. **Get Price IDs** and update environment variables

3. **Configure Webhook**:
   - URL: `https://yourdomain.com/api/billing/webhooks/stripe`
   - Select events: All `customer.*`, `invoice.*`, `subscription.*`
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

4. **Test Mode**: Use `sk_test_...` keys for development

### Monitoring

**Key Metrics**:
- Webhook processing latency
- Payment failure rate
- Quota exceeded events
- Revenue per customer
- Churn rate

**Alerts**:
- Payment failure rate > 5% in 24 hours
- Unreconciled invoices > 24 hours old
- Redis usage flush job failures
- Stripe API errors

### Scaling Considerations

1. **Redis**: Use Redis cluster for high availability
2. **Worker Processes**: Scale usage flush jobs horizontally
3. **Database**: Add read replicas for usage analytics queries
4. **Rate Limits**: Stripe API rate limits (100 req/sec)

---

## UX Copy Examples

### Quota Exceeded

> **Your organization has reached its monthly token quota.**  
> Upgrade now to continue running automations without interruption.  
> [Upgrade Plan →]

### Trial Ending

> **Your 14-day trial ends in 3 days.**  
> Add a payment method to avoid downtime and keep your automations running.  
> [Add Payment Method →]

### Payment Failed

> **We weren't able to process your recent payment.**  
> Please update your payment method to avoid service interruption.  
> [Update Payment Method →]

### Subscription Canceled

> **Your subscription has been canceled.**  
> Your access will continue until February 1, 2024.  
> [Reactivate →]

---

## Security & Compliance

### PCI Compliance

- **Never store raw card data** on your servers
- Use Stripe Elements or Checkout for card capture
- All payment data is handled by Stripe (PCI Level 1 certified)

### Webhook Security

- Verify webhook signatures using `STRIPE_WEBHOOK_SECRET`
- Use HTTPS for all webhook endpoints
- Implement idempotency to prevent duplicate processing

### Data Privacy

- Redact billing info from logs (no full card numbers)
- Store Stripe webhook secret encrypted (use KMS)
- Apply least-privilege IAM for artifacts storage

### SOC2 Considerations

- Audit trail via `BillingEvent` table
- Role-based access control for billing admin features
- Regular reconciliation (daily sync job)

---

## Troubleshooting

### Webhook not received

1. Check Stripe Dashboard → Webhooks → Events
2. Verify webhook URL is publicly accessible
3. Check signature verification (correct secret?)
4. Review logs for errors

### Usage not tracking

1. Check Redis connection
2. Verify `REDIS_URL` environment variable
3. Check usage flush job is running
4. Review logs for metering errors

### Quota not enforcing

1. Check middleware is applied to routes
2. Verify organization has active subscription record
3. Check quota limits in pricing config
4. Review logs for enforcement bypass

### Invoice discrepancies

1. Run manual reconciliation: `BillingSyncJob.run()`
2. Check `BillingEvent` table for unprocessed events
3. Compare Stripe Dashboard with database
4. Look for failed webhook processing

---

## Support & Contacts

- **Sales**: sales@vantflow.com
- **Support**: support@vantflow.com
- **Documentation**: https://docs.vantflow.com/billing
- **Status Page**: https://status.vantflow.com

---

**Last Updated**: November 22, 2025  
**Version**: 1.0.0
