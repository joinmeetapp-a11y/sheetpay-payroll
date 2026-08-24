/**
 * Client-side Paddle Billing checkout (Paddle.js overlay).
 *
 * This opens the hosted Paddle checkout overlay directly in the browser, so the
 * pricing / upgrade buttons work even if the Convex backend is unreachable and
 * without needing a "default payment link" configured in the Paddle dashboard.
 *
 * Requires a **client-side token** (Paddle dashboard → Developer Tools →
 * Authentication → Client-side tokens, starts with `live_` or `test_`), exposed
 * to the frontend as VITE_PADDLE_CLIENT_TOKEN.
 */

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
const PADDLE_ENV =
  (import.meta.env.VITE_PADDLE_ENVIRONMENT as string | undefined) || 'production';

declare global {
  interface Window {
    Paddle?: any;
  }
}

let scriptPromise: Promise<void> | null = null;
let initialized = false;
let completeHandler: (() => void) | null = null;

export function isPaddleConfigured(): boolean {
  return typeof CLIENT_TOKEN === 'string' && CLIENT_TOKEN.length > 0;
}

function loadPaddleScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Paddle) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paddle-js]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Paddle.js')));
      if (window.Paddle) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    s.async = true;
    s.setAttribute('data-paddle-js', 'true');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Paddle.js'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function getPaddle(): Promise<any> {
  if (!isPaddleConfigured()) {
    throw new Error('VITE_PADDLE_CLIENT_TOKEN is not configured');
  }
  await loadPaddleScript();
  const Paddle = window.Paddle;
  if (!Paddle) throw new Error('Paddle.js did not initialize');

  if (!initialized) {
    if (PADDLE_ENV && PADDLE_ENV !== 'production') {
      try {
        Paddle.Environment.set(PADDLE_ENV);
      } catch {
        /* ignore — defaults to production */
      }
    }
    Paddle.Initialize({
      token: CLIENT_TOKEN,
      eventCallback: (event: any) => {
        if (event?.name === 'checkout.completed' && completeHandler) {
          completeHandler();
        }
      },
    });
    initialized = true;
  }
  return Paddle;
}

export interface OpenCheckoutOptions {
  priceId: string;
  email?: string;
  customData?: Record<string, string>;
  successUrl?: string;
  onComplete?: () => void;
}

/**
 * Opens the Paddle checkout overlay. Resolves once the overlay has been opened
 * (not once payment completes — use onComplete / successUrl for that).
 */
export async function openPaddleCheckout(opts: OpenCheckoutOptions): Promise<void> {
  const Paddle = await getPaddle();
  completeHandler = opts.onComplete ?? null;

  Paddle.Checkout.open({
    items: [{ priceId: opts.priceId, quantity: 1 }],
    ...(opts.email ? { customer: { email: opts.email } } : {}),
    ...(opts.customData ? { customData: opts.customData } : {}),
    settings: {
      displayMode: 'overlay',
      theme: 'light',
      ...(opts.successUrl ? { successUrl: opts.successUrl } : {}),
    },
  });
}
