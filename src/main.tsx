import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { useFirebaseConvexAuth } from './lib/convexAuth';
import App from './App.tsx';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL || '';

// If no Convex URL is set, use a placeholder so the build succeeds.
// The app degrades gracefully — auth and data still work locally;
// persistence to Convex activates once VITE_CONVEX_URL is configured.
const convex = new ConvexReactClient(convexUrl || 'https://example.convex.cloud');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProviderWithAuth client={convex} useAuth={useFirebaseConvexAuth}>
      <App />
    </ConvexProviderWithAuth>
  </StrictMode>
);
