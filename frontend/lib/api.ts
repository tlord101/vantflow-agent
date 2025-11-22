import axios from 'axios';
import { cookieUtils } from './cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS with credentials
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = cookieUtils.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (token expired/invalid)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired
      cookieUtils.removeToken();
      // Redirect to login if not already there
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getSession: () => api.get('/auth/session'),
};

// User
export const userApi = {
  getMe: () => api.get('/user/me'),
  update: (data: { name?: string; password?: string }) =>
    api.put('/user/update', data),
  createApiKey: () => api.post('/user/api-key'),
  getApiKeys: () => api.get('/user/api-keys'),
  deleteApiKey: (id: string) => api.delete(`/user/api-key/${id}`),
};

// Projects
export const projectsApi = {
  create: (data: { name: string; description?: string }) =>
    api.post('/projects/create', data),
  list: () => api.get('/projects/list'),
  get: (id: string) => api.get(`/projects/${id}`),
  update: (id: string, data: any) => api.put(`/projects/${id}/update`, data),
  delete: (id: string) => api.delete(`/projects/${id}/delete`),
};

// Agent
export const agentApi = {
  chat: (data: { projectId: string; prompt: string }) =>
    api.post('/agent/chat', data),
  run: (data: { projectId: string }) => api.post('/agent/run', data),
  getExecutionStatus: (executionId: string) =>
    api.get(`/agent/execution/${executionId}`),
};

// Chat
export const chatApi = {
  getHistory: (projectId: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/chat/projects/${projectId}/history`, { params }),
  sendMessage: (projectId: string, data: { 
    content: string; 
    context?: Array<{ role: string; content: string }>; 
    attachments?: Array<{ type: string; url: string; name: string }> 
  }) =>
    api.post(`/chat/projects/${projectId}/message`, data),
  clearHistory: (projectId: string) =>
    api.delete(`/chat/projects/${projectId}/history`),
};

// Plans
export const plansApi = {
  list: (projectId: string, params?: { status?: string; limit?: number; offset?: number }) =>
    api.get(`/plans/projects/${projectId}/plans`, { params }),
  get: (planId: string) => api.get(`/plans/${planId}`),
  create: (projectId: string, data: {
    name: string;
    description?: string;
    jsonPlan: any;
    estimatedCost?: number;
    estimatedTime?: number;
  }) =>
    api.post(`/plans/projects/${projectId}/plans`, data),
  update: (planId: string, data: {
    name?: string;
    description?: string;
    jsonPlan?: any;
    estimatedCost?: number;
    estimatedTime?: number;
  }) =>
    api.put(`/plans/${planId}`, data),
  approve: (planId: string) => api.post(`/plans/${planId}/approve`),
  run: (planId: string) => api.post(`/plans/${planId}/run`),
  delete: (planId: string) => api.delete(`/plans/${planId}`),
};

// Runs
export const runsApi = {
  list: (projectId: string, params?: { 
    status?: string; 
    planId?: string; 
    limit?: number; 
    offset?: number 
  }) =>
    api.get(`/runs/projects/${projectId}/runs`, { params }),
  get: (runId: string) => api.get(`/runs/${runId}`),
  getLogs: (runId: string, params?: { level?: string; limit?: number; offset?: number }) =>
    api.get(`/runs/${runId}/logs`, { params }),
  cancel: (runId: string) => api.post(`/runs/${runId}/cancel`),
  getStats: (projectId: string) => api.get(`/runs/projects/${projectId}/runs/stats`),
};

// Activity
export const activityApi = {
  list: (projectId: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/activity/projects/${projectId}`, { params }),
};

// Billing
export const billingApi = {
  // Plans
  getPlans: () => api.get('/billing/plans'),
  
  // Subscription
  getSubscription: () => api.get('/billing/subscription'),
  createCheckout: (data: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    promoCode?: string;
  }) => api.post('/billing/checkout', data),
  createPortalSession: (returnUrl: string) =>
    api.post('/billing/portal', { returnUrl }),
  cancelSubscription: (immediate = false) =>
    api.post('/billing/subscription/cancel', { immediate }),
  
  // Usage
  getUsage: () => api.get('/billing/usage'),
  getUsageHistory: (metric: string, months = 6) =>
    api.get(`/billing/usage/${metric}/history`, { params: { months } }),
  getQuota: () => api.get('/billing/quota'),
  
  // Invoices
  getInvoices: (limit = 20) => api.get('/billing/invoices', { params: { limit } }),
  getInvoice: (id: string) => api.get(`/billing/invoices/${id}`),
  
  // Payment Methods
  getPaymentMethods: () => api.get('/billing/payment-methods'),
  addPaymentMethod: (paymentMethodId: string) =>
    api.post('/billing/payment-methods', { paymentMethodId }),
};

export default api;
