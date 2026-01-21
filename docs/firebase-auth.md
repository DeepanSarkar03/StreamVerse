# Firebase Authentication Integration

## Overview
StreamVerse now uses Firebase Authentication instead of Google OAuth with NextAuth. This provides:
- ✅ Cleaner authentication flow
- ✅ No external server-side OAuth handling needed
- ✅ Support for multiple providers (Google, GitHub, Facebook, etc.)
- ✅ Built-in user management and persistent sessions
- ✅ Smaller bundle size (removed NextAuth dependency)

## How to Use

### In Components
```tsx
'use client';

import { useFirebaseAuth } from '@/components/firebase-auth-provider';

export function MyComponent() {
  const { user, loading, signInWithGoogle, signOut } = useFirebaseAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return (
      <button onClick={signInWithGoogle}>
        Sign in with Google
      </button>
    );
  }

  return (
    <div>
      <p>Welcome, {user.displayName}!</p>
      <img src={user.photoURL || ''} alt="Profile" />
      <button onClick={signOut}>Sign out</button>
    </div>
  );
}
```

### Utility Functions
```tsx
import {
  getCurrentUser,
  getUserToken,
  getUserEmail,
  getUserDisplayName,
  getUserPhotoURL,
  isUserAuthenticated,
} from '@/lib/auth-utils';

// Get current user
const user = getCurrentUser();

// Get user's ID token for API calls
const token = await getUserToken();

// Check if authenticated
if (isUserAuthenticated()) {
  // Do something
}

// Get user info
const email = getUserEmail();
const name = getUserDisplayName();
const photo = getUserPhotoURL();
```

### API Calls with Auth
```tsx
// Get user token and include in API requests
const token = await getUserToken();

const response = await fetch('/api/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Configuration

### Environment Variables
Firebase credentials are configured in `.env.local` and `.env.coolify.example`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

### Firebase Console Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (studio-4918145946-c0025)
3. Go to **Authentication** → **Sign-in method**
4. Enable desired providers (Google, GitHub, etc.)
5. For web app, add authorized domains:
   - `localhost:3000` (local)
   - `streamverse.rizzable.app` (production)

## Key Files
- [src/components/firebase-auth-provider.tsx](src/components/firebase-auth-provider.tsx) - Auth context & provider
- [src/lib/auth-utils.ts](src/lib/auth-utils.ts) - Utility functions
- [src/lib/firebase.ts](src/lib/firebase.ts) - Firebase initialization
- [src/app/layout.tsx](src/app/layout.tsx) - Root layout with FirebaseAuthProvider

## Migration from NextAuth
- ❌ Removed: `next-auth` package
- ❌ Removed: NextAuth session endpoints
- ✅ Added: Firebase Authentication
- ✅ Added: FirebaseAuthProvider for context management
- ✅ Simpler configuration (no .auth folder needed)

## Troubleshooting

### "Untrusted Host" Error
Make sure your production domain is authorized in Firebase Console under Authentication → Settings.

### User Not Persisting
Firebase automatically handles session persistence. Users should stay logged in even after page refresh.

### CORS Issues
Firebase handles CORS automatically. If you get CORS errors, check that your domain is authorized in Firebase.

## Next Steps
- Test Google sign-in locally
- Deploy to Coolify
- Add domain to Firebase authorized domains
- Configure other OAuth providers if needed
