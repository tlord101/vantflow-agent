/**
 * Firebase Configuration
 * 
 * Initializes Firebase Admin SDK for server-side operations
 */

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import logger from '../utils/logger';

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!serviceAccount && !process.env.FIREBASE_PROJECT_ID) {
  throw new Error('Firebase configuration is required. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID');
}

// Initialize app
if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount 
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
  logger.info('Firebase Admin SDK initialized');
}

// Export services
export const db = getFirestore();
export const auth = getAuth();
export const firebaseAdmin = admin;

// Firestore settings
db.settings({ ignoreUndefinedProperties: true });

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  ORGANIZATIONS: 'organizations',
  PROJECTS: 'projects',
  PLANS: 'plans',
  RUNS: 'runs',
  AGENTS: 'agents',
  CHATS: 'chats',
  API_KEYS: 'apiKeys',
  // Billing
  SUBSCRIPTIONS: 'subscriptions',
  USAGE_RECORDS: 'usageRecords',
  INVOICES: 'invoices',
  BILLING_EVENTS: 'billingEvents',
  PAYMENT_METHODS: 'paymentMethods',
  BILLING_CREDITS: 'billingCredits',
} as const;

export default { db, auth, firebaseAdmin, COLLECTIONS };
