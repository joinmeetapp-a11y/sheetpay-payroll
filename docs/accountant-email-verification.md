# Accountant email verification rollout

New accountant email/password accounts verify email ownership through the existing Resend security template before client setup or dashboard access. Existing accounts retain access. Firebase identities whose email is already verified satisfy the ownership check. Resend confirmation is stored in Convex; it does not change Firebase Auth credentials or Firebase emailVerified claims.

Deploy the backend, then the frontend, then enable ACCOUNTANT_EMAIL_VERIFICATION_ENABLED=true in the production Convex deployment. The switch defaults to disabled so deploying the backend cannot block signup on the older frontend. Both UI and server access checks use the authoritative result from users.getCurrentUser. Never enable the switch before the verification screen is live.

Existing RESEND_API_KEY, RESEND_FROM_EMAIL and the automatically provided CONVEX_SITE_URL are used. No new email provider or Firebase Admin credential is required.

From Google Cloud Shell, after the backend deployment:

```bash
cd ~/sheetpay-firebase-review-release &&
git pull --ff-only origin main &&
npm ci &&
npx firebase-tools deploy --only hosting --project myglowtext &&
cd ~/sheetpay-convex-review-release &&
git pull --ff-only origin main &&
CONVEX_DEPLOYMENT=prod:clear-avocet-926 npx convex env set ACCOUNTANT_EMAIL_VERIFICATION_ENABLED true
```

The Hosting predeploy hook pulls and builds the canonical main branch with the existing public production configuration. If the Firebase CLI requests login, use firebase login --reauth --no-localhost and choose surebookme@gmail.com.

Confirm the verification screen on a new accountant signup, receive the Resend email, and confirm its link. The original dashboard tab should continue automatically with saved setup intact. An unverified account must not create or read clients through direct Convex calls.

Links contain a random 256-bit token; only its SHA-256 hash is stored. GET displays confirmation; POST verifies the address and redirects to sheetpay.app/accountant. Links expire after 24 hours; resending invalidates the old link. Requests are limited to one per minute and five per hour per account. Token consumption is atomic and repeat confirmation does not duplicate welcome or campaign enrollment. Verification remains available despite optional-email unsubscribe.

Disable rollout without changing accounts:

```bash
CONVEX_DEPLOYMENT=prod:clear-avocet-926 npx convex env set ACCOUNTANT_EMAIL_VERIFICATION_ENABLED false
```
