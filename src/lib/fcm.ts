/**
 * Firebase Cloud Messaging — browser-side token registration.
 *
 * Prerequisites (one-time setup):
 *   1. Firebase Console → Project Settings → Cloud Messaging → Web configuration
 *      → Generate a Web Push certificate (VAPID key pair).
 *      Save the "Key pair" value to VITE_FIREBASE_VAPID_KEY (env).
 *   2. Add `public/firebase-messaging-sw.js` with the same Firebase config as
 *      src/lib/firebase.ts (Firebase Messaging requires a service worker
 *      registered from an HTTPS origin — sheetpay.app works, localhost works).
 *   3. iOS support: only Safari 16.4+ on a home-screen-installed PWA can
 *      receive Web Push. Feature-detect gracefully on iOS.
 *
 * Server side, this token is what convex/fcm.ts targets via FCM v1 API.
 */

import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import app from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export async function registerForPush(
  registerMutation: (args: {
    requesterUid: string;
    token: string;
    platform?: string;
    userAgent?: string;
  }) => Promise<unknown>,
  currentUid: string
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  try {
    if (!(await isSupported())) {
      return { ok: false, reason: 'Push messaging is not supported in this browser.' };
    }
    if (!VAPID_KEY) {
      return { ok: false, reason: 'VITE_FIREBASE_VAPID_KEY is not set — push cannot be enabled.' };
    }
    if (!('Notification' in window)) {
      return { ok: false, reason: 'Notifications are not available in this browser.' };
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return { ok: false, reason: 'Push permission denied.' };
    }

    // Firebase Messaging requires the SW registered at the origin root.
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return { ok: false, reason: 'Firebase did not return a token.' };

    await registerMutation({
      requesterUid: currentUid,
      token,
      platform: 'web',
      userAgent: navigator.userAgent,
    });
    return { ok: true, token };
  } catch (err: any) {
    return { ok: false, reason: String(err?.message ?? err) };
  }
}

export async function unregisterFromPush(
  unregisterMutation: (args: { requesterUid: string; token: string }) => Promise<unknown>,
  currentUid: string
): Promise<void> {
  try {
    if (!(await isSupported())) return;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      await unregisterMutation({ requesterUid: currentUid, token });
      await deleteToken(messaging);
    }
  } catch {
    // Silent — the user is trying to opt out; token cleanup is best-effort.
  }
}
