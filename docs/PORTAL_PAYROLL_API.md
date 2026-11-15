# Sheetpay Portal payroll API v1

This addition connects Sheetpay Portal to the existing Sheetpay payroll engine. It does not change payroll formulas, Firebase providers, deployment targets, statutory rates, or existing approval screens. No deployment or customer payroll execution is performed by CI.

## Repositories and credentials

- Engine: `joinmeetapp-a11y/sheetpay-payroll`, branch `feat/portal-payroll-api`.
- Portal: `surebookme-hue/Sheetpay-Portal`, branch `feat/convex-backend-migration`.
- Engine HTTP action: `POST https://ENGINE.convex.site/v1/portal-payroll`.
- Portal backend environment: `SHEETPAY_PAYROLL_API_URL` must contain that full HTTP action URL. Use the **payroll engine deployment**, not the portal deployment. Configure it with the signed-in Convex CLI/dashboard on the intended portal deployment. The integration needs no OpenAI key.
- Each connection has a separate revocable credential bound to one engine business, its current owner, and one portal organization. There is no shared master API key. The owner must authenticate through the existing Sheetpay Firebase provider and have a verified Firebase email before issuing a key. The portal's `caylaex` token is not reused as a Sheetpay login.
- Only a SHA-256 token hash is stored by the engine. The portal saves the service credential in a dedicated private server-side table. Credential fields never appear in connection queries, generic workspace collections, frontend builds, or local/session storage. Portal owners/administrators can link or disconnect businesses; owners, administrators and accountants can prepare/review/approve payroll. Client/staff accounts cannot use these payroll operations.

## Generate a credential

After deploying this branch to an **engine staging deployment**, obtain the actual business ID from the existing Sheetpay account. Copy the portal organization ID displayed on the Portal Payroll screen. From an engine checkout:

```bash
read -r -p 'Sheetpay account email: ' SHEETPAY_OWNER_EMAIL
read -r -s -p 'Sheetpay account password: ' SHEETPAY_OWNER_PASSWORD
printf '\n'
export SHEETPAY_OWNER_EMAIL SHEETPAY_OWNER_PASSWORD
export SHEETPAY_OWNER_FIREBASE_PROJECT=myglowtext
node scripts/create-portal-payroll-credential.mjs \
  https://YOUR_ENGINE.convex.cloud YOUR_BUSINESS_ID YOUR_PORTAL_ORGANIZATION_ID
unset SHEETPAY_OWNER_PASSWORD SHEETPAY_OWNER_EMAIL
```

Choose `mysheetpay` instead if that is the Firebase project used by the existing Sheetpay account. Google-only accounts can supply an existing short-lived Firebase ID token through `SHEETPAY_OWNER_ID_TOKEN` instead of password authentication. The script uses the real owner identity; it does not impersonate a user with an admin deployment key. Do not paste passwords, tokens or API credentials into chat, source files or issue/PR comments.

The API credential is shown only once. Copy `apiKey` into the portal's password field, select the matching portal client, and click **Verify & connect business**. The portal verifies the business/organization association with the engine before storing anything. Credential expiry is one year; owners can revoke earlier. Reconnect with a newly issued credential to rotate it. One active engine business link is allowed per portal client/business pair.

To revoke a credential, authenticate as the same verified Sheetpay owner and run:

```bash
node scripts/create-portal-payroll-credential.mjs \
  https://YOUR_ENGINE.convex.cloud --revoke CONNECTION_ID
```

Portal **Disconnect** removes the credential from portal storage and blocks further portal use. Revoke in Sheetpay as well when permanently retiring or suspecting a leaked credential. Neither command deletes existing employee/payroll history.

## Protocol

Requests are JSON with `Authorization: Bearer sp_portal_...`. All include `organizationId`. They are server-to-server; the HTTP action deliberately provides no browser CORS bypass. JSON bodies are limited to 40 KB, response reads to 1.5 MB, and successful credentials to 30 requests per minute. Failed domain operations consume the rate allowance in a separate transaction. Authorization checks run again in the operation transaction so concurrent revocation cannot be bypassed.

| `operation` | Additional input | Result |
| --- | --- | --- |
| `status` | none | API version, scoped business identity, expiry, employee limit |
| `employees` | optional `cursor` | Cursor page of up to 25 active non-demo employees |
| `prepare` | `key`, `employeeIds`, `period: {start,end,payDate}` | Immutable review, rows, totals, exceptions, expiry, SHA-256 review hash |
| `approve` | `draftId`, `reviewHash`, `confirmed: true`, `acknowledgeWarnings` | Confirmed engine run ID; exact retries return the same run |
| `history` | optional `cursor` | Cursor page of up to 20 business runs, respecting the owner's history allowance |
| `run` | `runId` | Business-scoped run snapshot, bounded to 100 employees |
| `payslip` | `runId`, `employeeId` | Private Storage download URL for a matching current saved PDF |

Preparation uses saved engine employee records and the existing `calculateReviewEmployee` / `calculateStatutoryForBusiness` helpers. It does not accept browser-calculated totals or statutory deductions. Effective rule resolution is bounded and shared once per batch. Existing non-API callers keep their original behavior. At most 100 employees are prepared per review. Unsupported country/year combinations and invalid employee inputs block automatic approval rather than returning made-up deductions.

The review hash uses canonical object ordering and includes the business country/currency, dates, calculated rows, totals and issues. Before approval, the engine rechecks employee ownership, current roster, rule output, expiry and quota. Any change requires a new review. Warnings require acknowledgement; blocking issues cannot be overridden. Approval writes one real engine `payrollRuns` record and reserves the existing usage quotas transactionally. It does not disburse money or automatically email payslips.

Preparing a review does not create finalized payroll. Abandoned unapproved reviews expire after two days with per-record scheduled cleanup. Successful approval cancels cleanup and retains the approval receipt for idempotency. No recurring table scans or database polling are introduced. Portal status counters update incrementally.

## Portal flow

1. Link an existing client/business using its scoped credential.
2. Click **Load employees**, select the saved employees and enter the payroll period/pay date. Additional roster pages load only on request.
3. Click **Calculate & prepare review**. Review each employee, totals, dates and exceptions. Edit earnings/hours in the existing Sheetpay editor, then prepare a new review if changes are needed.
4. Tick the explicit review checkbox and approve. The portal stores `synced` only after the engine confirms the matching approved run ID; the UI labels it **Approved in Sheetpay**. It does not label payroll paid.
5. Unknown preparation/approval outcomes have explicit retry controls that retain the same request/draft identity. The portal never blindly generates a fresh finalized run after a lost response.
6. View paginated engine history and download saved payslip PDFs. PDF downloads reuse existing `bulkPayslipUploads` and Convex Storage, checking business, employee, run revision, readiness and expiry. A PDF that has not been generated/saved in Sheetpay produces a clear message. This API does not replace existing payslip templates or render fabricated PDFs.

Legacy portal payroll rows remain visible as historical records. The old local-approval endpoint refuses engine-linked runs, preventing bypass of engine review.

## Validation and rollout

Engine checks:

```bash
npx tsc --noEmit --project tsconfig.portal-payroll.json
npx vitest run --config vitest.portal.config.ts
node --check scripts/create-portal-payroll-credential.mjs
```

Portal checks: `npm run lint`, `npm test`, `npm run build`.

First deploy both branches to their respective development/staging deployments. Issue a staging business credential and configure the portal staging endpoint. Validate the complete flow with non-customer records: linking, cross-organization rejection, roster paging, unsupported rules, field changes after review, warning acknowledgement, quota rejection, lost response recovery, single-run approval, history, saved PDF access and revocation. Confirm totals against the existing Sheetpay review for the same employees and period. Do not point staging at a production engine or use production customer payroll for testing.

Live OAuth/Firebase sessions, deployment-specific codegen and provider/account configuration cannot be certified by local emulator tests. Only after staging acceptance should operators deploy the engine and portal production backends, configure the production engine URL, issue fresh business-scoped credentials, and publish Firebase Hosting. No engine URL or credentials are guessed or automatically imported. Never use a deployment/admin key as the payroll API credential.
