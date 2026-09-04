import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider,
  signInWithCredential,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function nativePlatform(): 'android' | 'ios' | 'web' {
  const p = Capacitor.getPlatform();
  return p === 'android' || p === 'ios' ? p : 'web';
}

// Native Google Sign-In for Capacitor (Android/iOS). Uses the platform's
// Google account picker via @capacitor-firebase/authentication, then hands
// the resulting ID token back to the Firebase JS SDK via signInWithCredential
// so that useFirebaseConvexAuth picks up auth.currentUser exactly as it does
// on the web. Do not call from a web build — use signInWithPopup instead.
export async function signInWithGoogleNative(): Promise<UserCredential> {
  const { FirebaseAuthentication } = await import(
    '@capacitor-firebase/authentication'
  );

  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) {
    throw new Error('Google Sign-In did not return an ID token.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

// Called on sign-out to make sure the native Google account cache is cleared
// too — otherwise a re-open silently reuses the previous Google account.
export async function signOutNative(): Promise<void> {
  if (!isNativeApp()) return;
  const { FirebaseAuthentication } = await import(
    '@capacitor-firebase/authentication'
  );
  try {
    await FirebaseAuthentication.signOut();
  } catch {
    // Best-effort — the plugin throws if no session; safe to ignore.
  }
}
