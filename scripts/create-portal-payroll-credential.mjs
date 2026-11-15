import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
const [deployment, businessId, portalOrganizationId] = process.argv.slice(2);
if (!deployment || !businessId || !portalOrganizationId) {
  console.error(
    "Usage: node scripts/create-portal-payroll-credential.mjs https://ENGINE.convex.cloud BUSINESS_ID PORTAL_ORGANIZATION_ID (or DEPLOYMENT --revoke CONNECTION_ID)",
  );
  process.exit(2);
}
const url = new URL(deployment);
if (
  url.protocol !== "https:" ||
  !url.hostname.endsWith(".convex.cloud") ||
  url.pathname !== "/" ||
  url.search ||
  url.hash ||
  url.username ||
  url.password
)
  throw new Error("Use the exact Sheetpay payroll Convex deployment URL");
let token = process.env.SHEETPAY_OWNER_ID_TOKEN;
try {
  if (!token) {
    const project = process.env.SHEETPAY_OWNER_FIREBASE_PROJECT || "myglowtext";
    if (!["myglowtext", "mysheetpay"].includes(project))
      throw new Error(
        "Choose the Firebase project used by your existing Sheetpay account",
      );
    if (
      !process.env.SHEETPAY_OWNER_EMAIL ||
      !process.env.SHEETPAY_OWNER_PASSWORD
    )
      throw new Error(
        "Provide SHEETPAY_OWNER_ID_TOKEN or enter Sheetpay email/password through temporary environment variables as described in docs/PORTAL_PAYROLL_API.md",
      );
    const configResponse = await fetch(
      `https://${project}.firebaseapp.com/__/firebase/init.json`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!configResponse.ok)
      throw new Error("Could not retrieve the public Firebase configuration");
    const config = await configResponse.json();
    if (config.projectId !== project || typeof config.apiKey !== "string")
      throw new Error("Firebase configuration mismatch");
    const response = await fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
        encodeURIComponent(config.apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.SHEETPAY_OWNER_EMAIL,
          password: process.env.SHEETPAY_OWNER_PASSWORD,
          returnSecureToken: true,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await response.json();
    if (!response.ok || typeof data.idToken !== "string")
      throw new Error(
        "Sheetpay sign-in failed. Check the account and Firebase project. Google-only accounts can use an existing Firebase ID token instead.",
      );
    token = data.idToken;
  }
  const client = new ConvexHttpClient(url.origin);
  client.setAuth(token);
  const result =
    businessId === "--revoke"
      ? await client.mutation(anyApi.portalPayroll.revokeConnection, {
          id: portalOrganizationId,
        })
      : await client.mutation(anyApi.portalPayroll.createConnection, {
          businessId,
          portalOrganizationId,
        });
  console.log(
    businessId === "--revoke"
      ? "Credential revoked."
      : "Created a business-scoped credential. Copy it into the Portal payroll connection form. It is shown only now; do not commit it or paste it into chat.",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  token = undefined;
  delete process.env.SHEETPAY_OWNER_ID_TOKEN;
  delete process.env.SHEETPAY_OWNER_PASSWORD;
}
