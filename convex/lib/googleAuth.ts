/**
 * Service-account JWT → OAuth2 access token exchange for Google APIs.
 *
 * Set the Convex env var GOOGLE_SERVICE_ACCOUNT_JSON to the full JSON of a
 * service account key that has been granted:
 *   • "Viewer" on the GA4 property (Admin → Property Access Management)
 *   • "Owner" (verified) or "Restricted" on the Search Console site
 *
 * Convex actions run in V8, so we sign the JWT with crypto.subtle (RS256).
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlEncodeString(s: string): string {
  return b64urlEncode(new TextEncoder().encode(s));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

let cachedToken: { token: string; expiresAt: number; scope: string } | null = null;

export async function getGoogleAccessToken(scope: string): Promise<string | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.scope === scope && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!sa.client_email || !sa.private_key) return null;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${b64urlEncodeString(JSON.stringify(header))}.${b64urlEncodeString(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${b64urlEncode(sig)}`;

  const resp = await fetch(claim.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    console.error("google token exchange failed:", await resp.text());
    return null;
  }
  const body = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: body.access_token,
    expiresAt: now + body.expires_in,
    scope,
  };
  return body.access_token;
}
