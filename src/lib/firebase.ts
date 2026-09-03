import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBc865ufd5GN9nq_dyP45lI5rImXnoHVGM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mysheetpay.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mysheetpay',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mysheetpay.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '215386811331',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:215386811331:web:ff424fd616564a65fb6b76',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-XERV3CX9XN',
};

// Prevent duplicate app initialization
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
