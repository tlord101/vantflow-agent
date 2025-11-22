/**
 * Firebase Service Layer
 * 
 * Provides Firestore CRUD operations with TypeScript type safety
 */

import { db, COLLECTIONS } from '../config/firebase';
import { 
  DocumentData, 
  QueryDocumentSnapshot, 
  Timestamp,
  FieldValue 
} from 'firebase-admin/firestore';
import logger from '../utils/logger';

// Type helpers
export type FirestoreTimestamp = Timestamp;
export const serverTimestamp = () => FieldValue.serverTimestamp();

// Base document interface
export interface BaseDocument {
  id: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// User interface
export interface User extends BaseDocument {
  email: string;
  name: string;
  organizationId: string | null;
  role: 'user' | 'admin';
  firebaseUid: string; // Firebase Auth UID
}

// Organization interface
export interface Organization extends BaseDocument {
  name: string;
  slug: string;
  stripeCustomerId?: string | null;
}

// Project interface
export interface Project extends BaseDocument {
  userId: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  settings: any;
}

// Plan interface
export interface Plan extends BaseDocument {
  userId: string;
  projectId: string;
  name: string;
  description: string;
  steps: any[];
  status: 'draft' | 'active' | 'completed' | 'failed';
}

// Run interface
export interface Run extends BaseDocument {
  userId: string;
  planId: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result: any;
  error: string | null;
  startedAt: Timestamp | Date | null;
  completedAt: Timestamp | Date | null;
}

// Agent interface
export interface Agent extends BaseDocument {
  name: string;
  description: string;
  organizationId: string;
  config: any;
  status: 'active' | 'inactive';
}

// Chat interface
export interface Chat extends BaseDocument {
  userId: string;
  projectId: string | null;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Timestamp | Date;
  }>;
}

// API Key interface
export interface ApiKey extends BaseDocument {
  userId: string;
  name: string;
  key: string;
  lastUsedAt: Timestamp | Date | null;
}

// Subscription interface
export interface Subscription extends BaseDocument {
  organizationId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  tier: string;
  currentPeriodStart: Timestamp | Date;
  currentPeriodEnd: Timestamp | Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Timestamp | Date | null;
}

// Usage Record interface
export interface UsageRecord extends BaseDocument {
  organizationId: string;
  subscriptionId: string | null;
  metric: string;
  quantity: number;
  periodStart: Timestamp | Date;
  periodEnd: Timestamp | Date;
}

// Invoice interface
export interface InvoiceRecord extends BaseDocument {
  organizationId: string;
  stripeInvoiceId: string;
  subscriptionId: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  periodStart: Timestamp | Date;
  periodEnd: Timestamp | Date;
  paidAt: Timestamp | Date | null;
}

// Billing Event interface
export interface BillingEvent extends BaseDocument {
  organizationId: string | null;
  stripeEventId: string;
  type: string;
  data: any;
  processed: boolean;
  error: string | null;
}

// Payment Method interface
export interface PaymentMethod extends BaseDocument {
  organizationId: string;
  stripePaymentMethodId: string;
  type: string;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
}

// Billing Credit interface
export interface BillingCredit extends BaseDocument {
  organizationId: string;
  amount: number;
  reason: string;
  appliedAt: Timestamp | Date | null;
}

// Generic CRUD operations
export class FirestoreService {
  /**
   * Create a document
   */
  static async create<T extends BaseDocument>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T> {
    try {
      const docRef = db.collection(collection).doc();
      const timestamp = serverTimestamp();
      
      const newData = {
        ...data,
        id: docRef.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      
      await docRef.set(newData);
      
      // Return with current timestamp for immediate use
      return {
        ...newData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as T;
    } catch (error) {
      logger.error(`Error creating document in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  static async getById<T extends BaseDocument>(
    collection: string,
    id: string
  ): Promise<T | null> {
    try {
      const doc = await db.collection(collection).doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return doc.data() as T;
    } catch (error) {
      logger.error(`Error getting document ${id} from ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Update document
   */
  static async update<T extends BaseDocument>(
    collection: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt'>>
  ): Promise<void> {
    try {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      await db.collection(collection).doc(id).update(updateData);
    } catch (error) {
      logger.error(`Error updating document ${id} in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  static async delete(collection: string, id: string): Promise<void> {
    try {
      await db.collection(collection).doc(id).delete();
    } catch (error) {
      logger.error(`Error deleting document ${id} from ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Find documents with query
   */
  static async find<T extends BaseDocument>(
    collection: string,
    filters: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }> = [],
    orderBy?: { field: string; direction?: 'asc' | 'desc' },
    limit?: number
  ): Promise<T[]> {
    try {
      let query: FirebaseFirestore.Query = db.collection(collection);
      
      // Apply filters
      filters.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });
      
      // Apply ordering
      if (orderBy) {
        query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
      }
      
      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => doc.data() as T);
    } catch (error) {
      logger.error(`Error querying ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Find one document
   */
  static async findOne<T extends BaseDocument>(
    collection: string,
    filters: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }>
  ): Promise<T | null> {
    const results = await this.find<T>(collection, filters, undefined, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Count documents
   */
  static async count(
    collection: string,
    filters: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }> = []
  ): Promise<number> {
    try {
      let query: FirebaseFirestore.Query = db.collection(collection);
      
      filters.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });
      
      const snapshot = await query.count().get();
      return snapshot.data().count;
    } catch (error) {
      logger.error(`Error counting documents in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Batch operations
   */
  static batch() {
    return db.batch();
  }

  /**
   * Transaction
   */
  static async runTransaction<T>(
    updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>
  ): Promise<T> {
    return db.runTransaction(updateFunction);
  }
}

export default FirestoreService;
