'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { billingApi } from '@/lib/api';
import {
  CreditCardIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface UsageStats {
  metric: string;
  current: number;
  limit: number;
  percentage: number;
  unlimited: boolean;
  periodStart: string;
  periodEnd: string;
}

interface Subscription {
  id: string;
  planTier: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

interface Plan {
  tier: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}

export default function BillingDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<UsageStats[]>([]);
  const [quota, setQuota] = useState<any>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [subRes, usageRes, quotaRes] = await Promise.all([
        billingApi.getSubscription(),
        billingApi.getUsage(),
        billingApi.getQuota(),
      ]);

      setSubscription(subRes.data.subscription);
      setPlan(subRes.data.plan);
      setUsage(usageRes.data.usage);
      setQuota(quotaRes.data);
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const returnUrl = `${window.location.origin}/dashboard/billing`;
      const res = await billingApi.createPortalSession(returnUrl);
      window.location.href = res.data.url;
    } catch (error) {
      console.error('Failed to open portal:', error);
    }
  };

  const handleUpgrade = () => {
    router.push('/dashboard/billing/upgrade');
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any; text: string }> = {
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, text: 'Active' },
      trialing: { color: 'bg-blue-100 text-blue-800', icon: CheckCircleIcon, text: 'Trial' },
      past_due: { color: 'bg-yellow-100 text-yellow-800', icon: ExclamationTriangleIcon, text: 'Past Due' },
      canceled: { color: 'bg-red-100 text-red-800', icon: XCircleIcon, text: 'Canceled' },
      unpaid: { color: 'bg-red-100 text-red-800', icon: XCircleIcon, text: 'Unpaid' },
    };

    const badge = badges[status] || badges.active;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {badge.text}
      </span>
    );
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const formatMetricName = (metric: string) => {
    const names: Record<string, string> = {
      gemini_tokens: 'AI Tokens',
      run_minutes: 'Automation Minutes',
      screenshots: 'Screenshots',
      api_calls: 'API Calls',
    };
    return names[metric] || metric;
  };

  const formatQuantity = (metric: string, quantity: number) => {
    if (metric === 'gemini_tokens') {
      return `${(quantity / 1000).toFixed(1)}K`;
    }
    return quantity.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your subscription, usage, and billing information
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <CreditCardIcon className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
          </div>
          {subscription && getStatusBadge(subscription.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{plan?.name || 'Free'}</h3>
            {plan && plan.monthlyPrice > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {formatPrice(plan.monthlyPrice)}/month
              </p>
            )}
            {subscription?.trialEndsAt && (
              <p className="text-sm text-blue-600 mt-2">
                Trial ends {formatDate(subscription.trialEndsAt)}
              </p>
            )}
          </div>

          {subscription && (
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Current Period</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
              {subscription.cancelAtPeriodEnd && (
                <p className="text-sm text-red-600">
                  Cancels on {formatDate(subscription.currentPeriodEnd)}
                </p>
              )}
            </div>
          )}

          <div className="flex items-end justify-end space-x-3">
            {subscription && subscription.status !== 'canceled' && (
              <button
                onClick={handleManageSubscription}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Manage Subscription
              </button>
            )}
            <button
              onClick={handleUpgrade}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              {subscription ? 'Change Plan' : 'Upgrade'}
            </button>
          </div>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center mb-6">
          <ChartBarIcon className="w-6 h-6 text-blue-600 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">Usage This Period</h2>
        </div>

        <div className="space-y-6">
          {usage.map((stat) => (
            <div key={stat.metric}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-900">
                  {formatMetricName(stat.metric)}
                </span>
                <span className="text-sm text-gray-600">
                  {formatQuantity(stat.metric, stat.current)} / {stat.unlimited ? 'Unlimited' : formatQuantity(stat.metric, stat.limit)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getUsageColor(stat.percentage)}`}
                  style={{ width: stat.unlimited ? '0%' : `${Math.min(stat.percentage, 100)}%` }}
                />
              </div>
              {!stat.unlimited && stat.percentage >= 80 && (
                <p className="text-xs text-yellow-600 mt-1">
                  {stat.percentage >= 95 ? 'Quota almost exceeded!' : 'Approaching quota limit'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => router.push('/dashboard/billing/invoices')}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-left hover:shadow-md transition-shadow"
        >
          <DocumentTextIcon className="w-8 h-8 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Invoices</h3>
          <p className="text-sm text-gray-600">View and download past invoices</p>
        </button>

        <button
          onClick={() => router.push('/dashboard/billing/payment-methods')}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-left hover:shadow-md transition-shadow"
        >
          <CreditCardIcon className="w-8 h-8 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Methods</h3>
          <p className="text-sm text-gray-600">Manage your payment methods</p>
        </button>

        <button
          onClick={() => router.push('/dashboard/billing/usage')}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-left hover:shadow-md transition-shadow"
        >
          <ChartBarIcon className="w-8 h-8 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Usage Analytics</h3>
          <p className="text-sm text-gray-600">Detailed usage history and trends</p>
        </button>
      </div>
    </div>
  );
}
