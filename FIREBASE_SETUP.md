# Firebase Setup Guide

Your Firebase project credentials have been configured! Here's what you need to do next:

## ✅ What's Already Done

1. ✅ Frontend Firebase config added to `.env.local`
2. ✅ Backend Firebase config template added to `.env`
3. ✅ Firebase client SDK initialized in `frontend/lib/firebase.ts`

## 🔧 Next Steps

### 1. Get Your Service Account Key

You need to complete the backend Firebase setup:

1. Go to [Firebase Console](https://console.firebase.google.com/project/vantflowv1/settings/serviceaccounts/adminsdk)
2. Click "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. Copy the **entire JSON content**
6. Open `/workspaces/vantflow-agent/backend/.env`
7. Replace the `FIREBASE_SERVICE_ACCOUNT_KEY` value with your JSON (as a single-line string)

Example:
```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"vantflowv1","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_KEY_HERE\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@vantflowv1.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40vantflowv1.iam.gserviceaccount.com"}'
```

### 2. Enable Firestore Database

1. Go to [Firestore Console](https://console.firebase.google.com/project/vantflowv1/firestore)
2. Click "Create database"
3. Choose "Start in production mode" (we'll add rules next)
4. Select your region (choose one close to your users)
5. Click "Enable"

### 3. Set Up Firestore Security Rules

1. Go to Firestore > Rules
2. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }
    
    // Organizations collection
    match /organizations/{orgId} {
      allow read: if isAuthenticated() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId == orgId;
      allow write: if isAuthenticated();
    }
    
    // Projects collection
    match /projects/{projectId} {
      allow read: if isAuthenticated() && 
        resource.data.organizationId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId;
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
    }
    
    // Plans collection
    match /plans/{planId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && 
        resource.data.createdBy == request.auth.uid;
    }
    
    // Runs collection
    match /runs/{runId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
    }
    
    // Chats collection
    match /chats/{chatId} {
      allow read, write: if isAuthenticated();
    }
    
    // API Keys collection
    match /apiKeys/{keyId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create, delete: if isAuthenticated() && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

3. Click "Publish"

### 4. Enable Authentication

1. Go to [Authentication Console](https://console.firebase.google.com/project/vantflowv1/authentication/providers)
2. Click "Get started"
3. Click "Email/Password"
4. Enable "Email/Password"
5. Click "Save"

### 5. Create Firestore Indexes (for better performance)

1. Go to Firestore > Indexes
2. Click "Create index"
3. Add these composite indexes:

**Projects Index:**
- Collection: `projects`
- Fields: `organizationId` (Ascending), `createdAt` (Descending)

**Plans Index:**
- Collection: `plans`
- Fields: `projectId` (Ascending), `status` (Ascending), `createdAt` (Descending)

**Runs Index:**
- Collection: `runs`
- Fields: `projectId` (Ascending), `status` (Ascending), `createdAt` (Descending)

**Chats Index:**
- Collection: `chats`
- Fields: `projectId` (Ascending), `createdAt` (Ascending)

### 6. Install Firebase Dependencies

```bash
# Backend (already installed if you ran npm install)
cd backend
npm install firebase-admin

# Frontend
cd ../frontend
npm install firebase
```

### 7. Add Your Gemini API Key

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Open `/workspaces/vantflow-agent/backend/.env`
3. Replace `your_gemini_api_key_here` with your actual key

### 8. Test Your Setup

```bash
# Start Redis (in a new terminal)
docker run -d -p 6379:6379 redis:alpine

# Start Backend (in a new terminal)
cd backend
npm run dev

# Start Frontend (in a new terminal)
cd frontend
npm run dev
```

Visit http://localhost:3000 and try:
1. Sign up for a new account
2. Check Firebase Console > Authentication to see the user
3. Check Firebase Console > Firestore to see the organization created

## 🔒 Security Checklist

- [ ] Service account key added to backend `.env`
- [ ] Firestore security rules published
- [ ] Email/Password authentication enabled
- [ ] Firestore indexes created
- [ ] `.env` files added to `.gitignore` (already done)
- [ ] Service account key NEVER committed to Git

## 📚 Additional Resources

- [Firebase Console](https://console.firebase.google.com/project/vantflowv1)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)

## ⚠️ Important Notes

1. **Never commit** your service account key to Git
2. The `.env` files are already in `.gitignore`
3. For production, use environment variables in your hosting platform
4. Keep your Firebase API keys secure
5. Review security rules before going to production

## 🎉 You're All Set!

Once you complete these steps, your VantFlow Agent will be fully connected to Firebase!
