# Accountant free-user campaign operations

Campaign: accountant_free_7_day_v1. New authenticated Accountant accounts only.
This is internal documentation, not a public route. Never paste tokens, addresses, provider keys or payroll records into public logs.

## Enrollment and schedule
The existing Firebase-authenticated users.createOrUpdate mutation inserts campaign state in the same transaction as a new Accountant user. Existing-user callbacks do not enroll or restart. A background Node action generates a 256-bit unsubscribe token; the dispatcher repairs missing token initialization after an interrupted action.
Day 1 is due one hour after enrollment. Days 2–7 are due 24 hours after the preceding accepted send. A one-minute Convex cron processes at most 20 due campaigns per invocation, with pacing; lease recovery prevents overlapping cron workers from claiming the same day. Provider rejection and downtime may extend the sequence rather than bunch emails together.

## Data and authorization
Private accountantEmailCampaigns holds timing/status and unsubscribe tokens. Private accountantCampaignEvents holds one canonical record per campaign day and lifecycle/failure history. Records are not returned by public user queries. Marketing messages contain account first name and generic product content only. No employee details, amounts, identifiers or files are used. Activity checks select existence of records; they never include payroll data in an email.
users.marketingUnsubscribedAt is separate from operational notification preferences. Existing product-email opt-outs and email suppression records are respected.
No open pixels or click tracking are introduced. Resend's workspace tracking configuration is an operator responsibility.

## Upgrade and unavoidable in-flight boundary
Verified Paddle subscription mutations stop an active campaign in the same billing transaction. Every claimed send revalidates current user, subscription, preference, suppression, recipient and lease immediately before the single Resend HTTP request. Previously converted campaigns never restart after cancellation.
No system can recall a provider request already in flight when a billing update or unsubscribe arrives. A confirmed upgrade before the final validation blocks the request; a request already accepted by Resend may still arrive. Do not claim absolute recall or zero race-window guarantees.

## Duplicate prevention and failures
A permanent per-day record prevents repeated sends across days or cron retries. A lease prevents concurrent attempts; a stable provider Idempotency-Key and frozen payload handle interrupted acknowledgements. Transient failures retry with backoff, at most ten attempts and only within 20 hours of the first request. Resend currently retains keys for 24 hours: https://resend.com/docs/dashboard/emails/idempotency-keys
After this safe window or a permanent failure, the campaign fails closed for operator reconciliation. Never blindly reset a failed send or replace its key. Check Resend acceptance using the recorded provider ID or key before marking a result. Delivery acceptance is not proof of inbox delivery.
If an email changes before a new day's first attempt, the next send uses the current authenticated address. If it changes during a retry, pause for review instead of submitting a different recipient with the same key.

## Unsubscribe
Footer and List-Unsubscribe link use a random token rather than a user ID. GET displays a confirmation form, so link scanners do not unsubscribe users. POST, including one-click List-Unsubscribe POST, verifies the token hash and records marketing opt-out. Tokens remain usable on old emails; repeated requests are harmless. Authentication, security, billing, payslip and requested reminder delivery are unchanged.

## Diagnostics and tests
Run internal accountantCampaign:inspect with a user database ID via the authenticated operator CLI/dashboard. It returns status, current day, next send, stop reason, failures and provider IDs, with token/content redacted. This is not a public API or an admin browser route.
Run npx vitest run tests/accountantCampaign.test.ts to exercise seven days in seconds using test database clock advancement. Production timing constants are immutable and there is no accelerated production environment flag. Test data never calls real Resend.
Existing pricing, Mia, private bulk-email and privacy suites must pass with campaign tests. Production CI deploys the pinned reviewed backend, checks configured sender readiness, then deploys the existing web app.

## Configuration and rollout
Reuse RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME, RESEND_REPLY_TO and automatic CONVEX_SITE_URL. No new secret is required. Configure the sender-domain name/address using the established verified Sheetpay sender; do not enable a new domain casually. Review Resend promotional-email policy, unsubscribe/DKIM requirements and applicable marketing rules before targeting new jurisdictions. Signup explains the seven-email marketing sequence with opt-out. Where prior opt-in is legally required, add and record it before enrolling those users; account creation alone is not universal marketing consent.
Confirm Sheetpay's legal sender identity/business contact disclosures with counsel. No invented address is included. Existing free accounts are intentionally not backfilled.
After deployment, inspect one authorized synthetic Firebase signup, its single delayed campaign record, and verified monthly/yearly update handling. Never send seven promotional test emails to an actual customer or activate accelerated schedules in production.
