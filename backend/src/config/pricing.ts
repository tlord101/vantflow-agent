/**
 * Pricing Configuration for VantFlow Agent CMS
 * 
 * Defines subscription tiers, quotas, and overage pricing.
 */

export interface PlanQuotas {
  projects: number;
  geminiTokensPerMonth: number;
  runMinutesPerMonth: number;
  screenshotsPerMonth: number;
  concurrentRuns: number;
  teamMembers: number;
  aiModels: string[];
  support: string;
  features: string[];
}

export interface PlanPricing {
  tier: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  quotas: PlanQuotas;
  overagePricing: {
    perThousandTokens: number; // cents
    perRunMinute: number; // cents
    perScreenshot: number; // cents
  };
  trialDays: number;
  popular?: boolean;
}

export const PRICING_PLANS: Record<string, PlanPricing> = {
  free: {
    tier: 'free',
    name: 'Free',
    description: 'Perfect for trying out VantFlow',
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    stripePriceIdMonthly: '', // No Stripe price for free tier
    stripePriceIdYearly: '',
    quotas: {
      projects: 1,
      geminiTokensPerMonth: 1000,
      runMinutesPerMonth: 50,
      screenshotsPerMonth: 20,
      concurrentRuns: 1,
      teamMembers: 1,
      aiModels: ['gemini-1.5-flash'],
      support: 'Community',
      features: [
        '1 Project',
        '1,000 AI tokens/month',
        '50 automation minutes/month',
        '20 screenshots/month',
        'Basic Playwright automation',
        'Community support',
      ],
    },
    overagePricing: {
      perThousandTokens: 0, // No overage on free
      perRunMinute: 0,
      perScreenshot: 0,
    },
    trialDays: 0,
  },
  
  pro: {
    tier: 'pro',
    name: 'Pro',
    description: 'For professionals and growing teams',
    monthlyPriceCents: 2900, // $29
    yearlyPriceCents: 29000, // $290 (17% discount)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    quotas: {
      projects: 10,
      geminiTokensPerMonth: 100000,
      runMinutesPerMonth: 500,
      screenshotsPerMonth: 1000,
      concurrentRuns: 3,
      teamMembers: 5,
      aiModels: ['gemini-1.5-flash', 'gemini-1.5-pro'],
      support: 'Email',
      features: [
        'Up to 10 projects',
        '100K AI tokens/month',
        '500 automation minutes/month',
        '1,000 screenshots/month',
        '3 concurrent runs',
        'Up to 5 team members',
        'Advanced AI models',
        'Email support',
        'Priority queue',
      ],
    },
    overagePricing: {
      perThousandTokens: 20, // $0.20 per 1K tokens
      perRunMinute: 10, // $0.10 per minute
      perScreenshot: 5, // $0.05 per screenshot
    },
    trialDays: 14,
    popular: true,
  },
  
  business: {
    tier: 'business',
    name: 'Business',
    description: 'For teams that need scale and reliability',
    monthlyPriceCents: 14900, // $149
    yearlyPriceCents: 149000, // $1,490 (17% discount)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || '',
    quotas: {
      projects: 50,
      geminiTokensPerMonth: 1000000,
      runMinutesPerMonth: 5000,
      screenshotsPerMonth: 10000,
      concurrentRuns: 10,
      teamMembers: 50,
      aiModels: ['gemini-1.5-flash', 'gemini-1.5-pro'],
      support: 'Priority',
      features: [
        'Up to 50 projects',
        '1M AI tokens/month',
        '5,000 automation minutes/month',
        '10,000 screenshots/month',
        '10 concurrent runs',
        'Up to 50 team members',
        'All AI models',
        'Priority support',
        'Advanced analytics',
        'Custom webhooks',
        'SLA: 99.9% uptime',
      ],
    },
    overagePricing: {
      perThousandTokens: 15, // $0.15 per 1K tokens (discounted)
      perRunMinute: 8, // $0.08 per minute
      perScreenshot: 3, // $0.03 per screenshot
    },
    trialDays: 14,
  },
  
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPriceCents: 0, // Custom pricing
    yearlyPriceCents: 0,
    stripePriceIdMonthly: '', // Handled via sales
    stripePriceIdYearly: '',
    quotas: {
      projects: -1, // Unlimited
      geminiTokensPerMonth: -1,
      runMinutesPerMonth: -1,
      screenshotsPerMonth: -1,
      concurrentRuns: -1,
      teamMembers: -1,
      aiModels: ['gemini-1.5-flash', 'gemini-1.5-pro'],
      support: 'Dedicated',
      features: [
        'Unlimited projects',
        'Unlimited AI tokens',
        'Unlimited automation minutes',
        'Unlimited screenshots',
        'Unlimited concurrent runs',
        'Unlimited team members',
        'All AI models',
        'Dedicated support',
        'Custom SLA',
        'SSO/SAML',
        'Advanced security controls',
        'Custom integrations',
        'On-premise deployment option',
      ],
    },
    overagePricing: {
      perThousandTokens: 0, // Negotiated
      perRunMinute: 0,
      perScreenshot: 0,
    },
    trialDays: 30,
  },
};

export const USAGE_METRICS = {
  GEMINI_TOKENS: 'gemini_tokens',
  RUN_MINUTES: 'run_minutes',
  SCREENSHOTS: 'screenshots',
  API_CALLS: 'api_calls',
} as const;

export const QUOTA_WARNING_THRESHOLDS = {
  WARNING: 0.8, // 80%
  CRITICAL: 0.95, // 95%
} as const;

export function getPlanByTier(tier: string): PlanPricing | null {
  return PRICING_PLANS[tier] || null;
}

export function getQuotaLimit(tier: string, metric: string): number {
  const plan = getPlanByTier(tier);
  if (!plan) return 0;
  
  switch (metric) {
    case USAGE_METRICS.GEMINI_TOKENS:
      return plan.quotas.geminiTokensPerMonth;
    case USAGE_METRICS.RUN_MINUTES:
      return plan.quotas.runMinutesPerMonth;
    case USAGE_METRICS.SCREENSHOTS:
      return plan.quotas.screenshotsPerMonth;
    default:
      return 0;
  }
}

export function calculateOverageCost(
  tier: string,
  metric: string,
  overageAmount: number
): number {
  const plan = getPlanByTier(tier);
  if (!plan || overageAmount <= 0) return 0;
  
  switch (metric) {
    case USAGE_METRICS.GEMINI_TOKENS:
      return Math.ceil(overageAmount / 1000) * plan.overagePricing.perThousandTokens;
    case USAGE_METRICS.RUN_MINUTES:
      return Math.ceil(overageAmount) * plan.overagePricing.perRunMinute;
    case USAGE_METRICS.SCREENSHOTS:
      return Math.ceil(overageAmount) * plan.overagePricing.perScreenshot;
    default:
      return 0;
  }
}

export function isUnlimitedQuota(quota: number): boolean {
  return quota === -1;
}

export function formatPlanPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function getTrialEndDate(tier: string): Date | null {
  const plan = getPlanByTier(tier);
  if (!plan || plan.trialDays === 0) return null;
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.trialDays);
  return endDate;
}
