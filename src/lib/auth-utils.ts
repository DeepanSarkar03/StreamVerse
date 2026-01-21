// Firebase Authentication utilities
import { auth } from '@/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Get the user's authentication token
 */
export async function getUserToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Check if user is authenticated
 */
export function isUserAuthenticated(): boolean {
  return auth.currentUser !== null;
}

/**
 * Get user's email
 */
export function getUserEmail(): string | null {
  return auth.currentUser?.email ?? null;
}

/**
 * Get user's display name
 */
export function getUserDisplayName(): string | null {
  return auth.currentUser?.displayName ?? null;
}

/**
 * Get user's profile photo URL
 */
export function getUserPhotoURL(): string | null {
  return auth.currentUser?.photoURL ?? null;
}
