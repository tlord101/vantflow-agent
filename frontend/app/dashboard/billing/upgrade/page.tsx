'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { billingApi } from '@/lib/api';
import { CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface PricingPlan {
  tier: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  quotas: {
    projects: number;
    geminiTokensPerMonth: number;
    runMinutesPerMonth: number;
    screenshotsPerMonth: number;
    concurrentRuns: number;
    teamMembers: number;
  };
  features: string[];
  popular?: boolean;
  trialDays: number;
}

export default function UpgradePage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState<string>('free');

  useEffect(() => {
    loadPlans();
    loadCurrentSubscription();
  }, []);

  const loadPlans = async () => {
    try {
      const res = await billingApi.getPlans();
      setPlans(res.data.plans);
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const loadCurrentSubscription = async () => {
    try {
      const res = await billingApi.getSubscription();
      if (res.data.subscription) {
        setCurrentTier(res.data.subscription.planTier);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const handleSelectPlan = async (plan: PricingPlan) => {
    if (plan.tier === 'free' || plan.tier === 'enterprise') {
      return; // Free tier or enterprise requires contact
    }

    try {
      setLoading(true);
      
      const priceId = billingCycle === 'monthly' 
        ? (plan as any).stripePriceIdMonthly 
        : (plan as any).stripePriceIdYearly;

      const successUrl = `${window.location.origin}/dashboard/billing?success=true`;
      const cancelUrl = `${window.location.origin}/dashboard/billing/upgrade`;

      const res = await billingApi.createCheckout({
        priceId,
        successUrl,
        cancelUrl,
      });

      // Redirect to Stripe Checkout
      window.location.href = res.data.url;
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatQuota = (value: number) => {
    if (value === -1) return 'Unlimited';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose the Perfect Plan
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Scale your automation as you grow. All plans include 14-day free trial.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const isCurrentPlan = plan.tier === currentTier;

            return (
              <div
                key={plan.tier}
                className={`relative bg-white rounded-lg shadow-lg border-2 ${
                  plan.popular
                    ? 'border-blue-600'
                    : isCurrentPlan
                    ? 'border-green-500'
                    : 'border-gray-200'
                } overflow-hidden hover:shadow-xl transition-shadow`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg flex items-center">
                    <SparklesIcon className="w-4 h-4 mr-1" />
                    POPULAR
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute top-0 left-0 bg-green-500 text-white px-3 py-1 text-xs font-semibold rounded-br-lg">
                    CURRENT PLAN
                  </div>
                )}

                <div className="p-6">
                  {/* Plan Name */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mb-6">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    {price === 0 ? (
                      <div className="text-4xl font-bold text-gray-900">Free</div>
                    ) : (
                      <>
                        <div className="text-4xl font-bold text-gray-900">
                          {formatPrice(price)}
                        </div>
                        <div className="text-sm text-gray-600">
                          per {billingCycle === 'monthly' ? 'month' : 'year'}
                        </div>
                        {billingCycle === 'yearly' && (
                          <div className="text-xs text-green-600 mt-1">
                            {formatPrice(price / 12)}/month when billed yearly
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Key Quotas */}
                  <div className="space-y-2 mb-6 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">AI Tokens</span>
                      <span className="font-semibold">
                        {formatQuota(plan.quotas.geminiTokensPerMonth)}/mo
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Run Minutes</span>
                      <span className="font-semibold">
                        {formatQuota(plan.quotas.runMinutesPerMonth)}/mo
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Projects</span>
                      <span className="font-semibold">
                        {formatQuota(plan.quotas.projects)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Team Members</span>
                      <span className="font-semibold">
                        {formatQuota(plan.quotas.teamMembers)}
                      </span>
                    </div>
                  </div>

                  {/* CTA Button */}
                  {plan.tier === 'enterprise' ? (
                    <button
                      onClick={() => window.open('mailto:sales@vantflow.com', '_blank')}
                      className="w-full py-3 px-4 border-2 border-gray-900 text-gray-900 rounded-lg font-semibold hover:bg-gray-900 hover:text-white transition-colors"
                    >
                      Contact Sales
                    </button>
                  ) : plan.tier === 'free' ? (
                    <button
                      disabled
                      className="w-full py-3 px-4 bg-gray-100 text-gray-400 rounded-lg font-semibold cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : isCurrentPlan ? (
                    <button
                      onClick={() => router.push('/dashboard/billing')}
                      className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Manage Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={loading}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                        plan.popular
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {plan.trialDays > 0 ? `Start ${plan.trialDays}-Day Trial` : 'Get Started'}
                    </button>
                  )}

                  {/* Features List */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start text-sm">
                          <CheckIcon className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-gray-600">
            All paid plans include a {plans.find(p => p.tier === 'pro')?.trialDays || 14}-day free trial. No credit card required to start.
          </p>
          <p className="text-gray-600 mt-2">
            Questions? <a href="mailto:support@vantflow.com" className="text-blue-600 hover:underline">Contact our team</a>
          </p>
        </div>
      </div>
    </div>
  );
}
