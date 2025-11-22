# Firebase Migration Guide

## Overview
The backend has been migrated from PostgreSQL + Prisma to Firebase (Firestore + Firebase Auth).

## What Changed

### Dependencies
- ✅ Added: `firebase`, `firebase-admin`
- ⚠️ Deprecated (can be removed): `@prisma/client`, `prisma`

### Configuration Files
- **New**: `src/config/firebase.ts` - Firebase initialization
- **New**: `src/lib/firebase.ts` - Firestore service layer with TypeScript interfaces

### Controllers Updated
- ✅ `authController.ts` - Now uses Firebase Auth
- ✅ `userController.ts` - Now uses Firestore
- ✅ `projectController.ts` - Now uses Firestore
- ⚠️ `agentController.ts` - Needs manual update (complex logic)
- ⚠️ `planController.ts` - Needs manual update
- ⚠️ `runController.ts` - Needs manual update
- ⚠️ `chatController.ts` - Needs manual update
- ⚠️ `billingController.ts` - Needs manual update for Firestore

### Middleware Updated
- ✅ `auth.ts` - Now uses Firebase ID token verification

## Environment Variables

Add these to your `.env` file:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Or use Application Default Credentials (for local development)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Keep existing Stripe and other configs
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# ... other env vars
```

## Firebase Setup Steps

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing
3. Enable **Firestore Database** (Native mode)
4. Enable **Authentication** > Email/Password provider

### 2. Get Service Account Key
1. Go to Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Either:
   - Set `FIREBASE_SERVICE_ACCOUNT_KEY` env var with the JSON content (stringify it)
   - OR set `GOOGLE_APPLICATION_CREDENTIALS` to the file path

### 3. Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.firebaseUid;
    }
    
    // Organizations
    match /organizations/{orgId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId == orgId;
    }
    
    // Projects
    match /projects/{projectId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Plans, Runs, Chats (similar pattern)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Firebase Indexes
Create composite indexes for common queries:
```
Collection: projects
Fields: userId (Ascending), createdAt (Descending)

Collection: usageRecords
Fields: organizationId (Ascending), periodStart (Descending)

Collection: subscriptions
Fields: organizationId (Ascending), status (Ascending)
```

## Data Migration

### Option 1: Fresh Start (Recommended for Development)
Simply start using the new Firebase backend. All new registrations will create users in Firebase.

### Option 2: Migrate Existing Data
If you have existing PostgreSQL data, create a migration script:

```typescript
// scripts/migrate-to-firebase.ts
import { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';
import { db } from '../src/config/firebase';

const prisma = new PrismaClient();

async function migrate() {
  // 1. Migrate users
  const users = await prisma.user.findMany();
  for (const user of users) {
    // Create Firebase Auth user
    const firebaseUser = await admin.auth().createUser({
      email: user.email,
      displayName: user.name,
      // Note: Can't migrate passwords directly - users need to reset
    });
    
    // Create Firestore user document
    await db.collection('users').doc().set({
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      firebaseUid: firebaseUser.uid,
      role: 'user',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
  
  // 2. Migrate organizations
  const orgs = await prisma.organization.findMany();
  for (const org of orgs) {
    await db.collection('organizations').doc().set({
      id: org.id,
      name: org.name,
      slug: org.slug,
      stripeCustomerId: org.stripeCustomerId,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    });
  }
  
  // 3. Migrate projects, plans, runs, etc.
  // ... similar pattern
}

migrate().then(() => console.log('Migration complete'));
```

## Authentication Flow Changes

### Before (JWT):
```
1. User logs in with email/password
2. Backend verifies credentials against PostgreSQL
3. Backend generates JWT token
4. Client stores JWT
5. Client sends JWT in Authorization header
6. Backend verifies JWT and checks session in PostgreSQL
```

### After (Firebase):
```
1. User logs in with email/password (on client)
2. Client calls Firebase Auth SDK
3. Client receives Firebase ID token
4. Client sends ID token in Authorization header
5. Backend verifies ID token with Firebase Admin SDK
6. Backend fetches user from Firestore
```

### Frontend Changes Needed:
```typescript
// OLD: Direct API call
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
const { token } = await response.json();

// NEW: Use Firebase Client SDK
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();

// Then use token for API calls
fetch('/api/projects', {
  headers: { 'Authorization': `Bearer ${token}` },
});
```

## Testing

1. Start the backend:
```bash
cd backend
npm run dev
```

2. Test authentication:
```bash
# Register (creates Firebase Auth user + Firestore document)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# The response will include a custom token
# Use this token for subsequent requests
```

3. Test Firestore operations:
```bash
curl http://localhost:3001/api/user/me \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

## Rollback Plan

If you need to rollback to Prisma:

1. Revert the controller files:
```bash
git checkout main -- src/controllers/
git checkout main -- src/middleware/auth.ts
```

2. Remove Firebase dependencies:
```bash
npm uninstall firebase firebase-admin
```

3. Restore Prisma client:
```bash
npx prisma generate
```

## Next Steps

1. Update remaining controllers (`agentController`, `planController`, `runController`, `chatController`)
2. Update billing services to use Firestore
3. Update frontend to use Firebase Client SDK for authentication
4. Test all API endpoints
5. Deploy Firestore security rules
6. Set up Firebase indexes

## Benefits of Firebase

✅ **No database management** - Fully managed NoSQL database
✅ **Real-time sync** - Firestore supports real-time listeners
✅ **Scalability** - Auto-scales with usage
✅ **Built-in authentication** - Firebase Auth handles auth complexity
✅ **Offline support** - Firestore SDK supports offline mode
✅ **Security rules** - Declarative security at database level
✅ **Free tier** - Generous free tier for development
