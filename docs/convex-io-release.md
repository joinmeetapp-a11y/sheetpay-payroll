# Sheetpay Accountant: Convex I/O optimization release

Prepared November 18, 2026. Code is prepared for review; production has not been deployed or migrated. No production savings are claimed.

## Verified source and deployment boundaries

- Frontend: `joinmeetapp-a11y/Sheetpay-Payslip-`, source main `56e0ca485b73fc983db0f78eb4a8f588720c8492`.
- Backend: separate `joinmeetapp-a11y/sheetpay-payroll`. The user confirmed Cloud Shell main `2424108`, notification fix `d08b287`, and unpushed social fix `965f1f1`, with a clean worktree. The implementation preserves the notification fix and the equivalent social patch from `cb916fb`.
- Optimization branch in both repositories: `perf/accountant-convex-io-20261117`.
- Required Convex target: `sure-book-me:sheetpay-accountant:prod`.
- Actual live frontend bundle inspected: `https://sheetpay.app/accountant` and `https://myglowtext.web.app/accountant` both served `/assets/index-C8sCBpHA.js`, containing `https://clear-avocet-926.convex.cloud`.
- `https://mysheetpay.web.app/accountant` served a different bundle (`index-B3qInkA_.js`), referencing `glad-bat-528` and `happy-otter-123`. Accordingly the existing Accountant frontend Hosting target is **myglowtext**, consistent with its checked-in `.firebaserc`. Do not overwrite mysheetpay with this frontend.
- The frontend environment key is `VITE_ACCOUNTANT_CONVEX_URL`; it is intentionally preserved.
- Account-level production mapping still must pass `node scripts/verify-performance-target.mjs` in the authorized Cloud Shell account before deployment. No Convex production credentials were available here.
- No deployment targets, Firebase auth providers, Paddle configuration or financial calculation formulas were changed.

The historical before-audit is available on `perf/convex-io-audit-20261117` in the frontend repository at `docs/internal/convex-io-audit-20261117.md`.

## Root causes and implemented changes

| Area | Before | After |
| --- | --- | --- |
| Social | Minute cron, even when idle; prior social patch bounded status reads but still polled for publication/generation | Scheduled publishing and local-calendar generation, stored/cancelled IDs, stale callback guards, policy revisions, existing atomic publishing claims and uncertainty protection; 15-minute bounded lease recovery |
| Reminders and onboarding campaigns | Minute dispatch crons | Event jobs scheduled from authoritative next-run fields; cancellation/rescheduling on updates; existing occurrence/lease/provider deduplication retained; 15-minute recovery |
| Notifications | Always-active enriched 100-item bell, including employee and delivery lookups | Bounded unread preview without delivery dependencies; full detail subscription only when opened; 20-item initial cursor history; membership/business caches retained; batched mark-all covers older unread rows |
| Payroll history | Every run and embedded employee snapshot on dashboard | Separate materialized run summaries, recent eight-run chart query, 20-item cursor history and one authorized saved run detail loaded when needed |
| Monthly usage | Operation counters already existed, but four collections were loaded for capacity counts | Existing monthly counters and operation dedupe unchanged; authoritative transactional capacity summaries after bounded backfill; original enforcement fallback until ready |
| Employees | Full documents on every root page and local roster search | Five-row dashboard preview, lightweight searchable/paginated directory, detail on edit; full data remains available on payroll/report paths, with a separate complete ID query for explicit dashboard payroll actions |
| Businesses | All branding documents returned for selector; restricted members scanned all workspace clients | Lightweight directory for selector, selected full business loaded separately, assigned-client lookups and owner checks retained |
| Activity / team | Workspace events read before client filtering; actor reads repeated; team always subscribed | Indexed client/workspace recent merge, actor deduplication, bounded historical pages, active-member index, Team-only subscription; membership last-active writes throttled to five minutes |
| Admin | Five-table overview scan, per-user employee/payroll collection counts, all-period usage scan | Transactional totals and per-user counts, indexed current-period usage summary/ranking, cursor user pages and word-prefix search; secondary subscriptions gated behind authorization |
| Bulk email | Full recipient batch read for every claim and completion; historical job lists enriched every recipient | Job/status indexed claims; transactional per-job progress after backfill; summary job pages and on-demand recipient log pages; existing billing reservation, unknown-outcome and provider idempotency unchanged |
| Cayla conversations | Collected all conversations for a user before finding business | Compound user/business lookup; message retention unchanged |
| Deployment hook | Pulled main and reinstalled during deployment, rejecting feature branch | Validates explicitly chosen clean branch, repository, Hosting target and production URL; typechecks/builds reviewed source without changing its ref |

Calculations, statutory tables, employee snapshots, payroll approvals, compliance exports, user data and delivery logs are retained. UI pagination is not a payroll input limit. The dashboard Run payroll action obtains the complete authorized ID set instead of using its five-row preview.

## Transactional summaries and migration safety

`convex/functions.ts` wraps all application mutations/internal mutations with database triggers. The financial/auth handlers remain in place. A source-record contribution ledger makes summary backfill and live writes commute transactionally, including updates, transfers and deletion. Summary records are patched only when their contributions change. Payroll, employee and business directories are maintained by the same transaction.

New tables: `performanceContributions`, `performanceCounters`, `performanceMigrations`, `payrollRunSummaries`, `employeeDirectory`, `businessDirectory`.

Backfill is internal-only, 50 source rows per batch with a 2 MiB read bound, cursor checkpoints, idempotent upserts and scheduled continuation. A failed batch rolls back and resumes from its previous checkpoint. Readers switch to authoritative counters only after the required source tables are marked complete. Existing operation usage is neither reset nor inferred from historical payrolls.

New frontend history/directory APIs require completed backfill; deploy the backend first, finish migrations, then publish the frontend. Normal Convex index deployment blocks until new indexes are backfilled before switching functions; do not use flags to bypass that check. No customer/history table is deleted or pruned by these migrations.

Pending social and reminder/campaign jobs have separate bounded migration functions. Existing publishing and email claims remain the final duplication guards. Unknown LinkedIn POST outcomes are never retried automatically. Existing explicit retry flows and bounded generation attempts remain available.

Direct dashboard database edits or `convex import` bypass application triggers. Use application mutations after migration; any future direct import requires a controlled reconciliation before trusting summaries. Added contribution records/directories increase storage and write work; this trades bounded transactional work for removing repeated historical reads.

## Indexes added and access patterns

| Table | Index | Reason |
| --- | --- | --- |
| users | by_created; by_plan; by_account_type; search_users | Rolling signup boundary, indexed filters, name/email word-prefix search |
| accountantMemberships | by_workspace_status | Active team rows |
| accountantActivity | by_workspace_business | Recent selected-client and workspace-wide events |
| notifications | by_user_read | Bounded unread view and mark-all batches |
| bulkEmailRecipients | by_job_status | One sending/queued recipient without a batch scan |
| usageCounters | by_period_activity | Current-period top usage; prefix also serves period-only fallback |
| caylaConversations | by_user_business | One user's selected-client conversation |
| socialPosts | by_status_lease | Only expired active worker leases |
| performanceContributions | by_source | Per-source dedupe/reconciliation ledger |
| performanceCounters | by_key | Exact scoped aggregate lookup |
| performanceMigrations | by_key | Per-table checkpoint/readiness |
| payrollRunSummaries | by_run; by_business_created; by_business_status_created | Run identity, date pagination and status/date filters |
| employeeDirectory | by_source; by_business; by_business_status; search_directory | Detail identity, roster pagination, status and name/ID/email search |
| businessDirectory | by_source; by_user | Selected/assigned clients and owned-client selector |

All existing indexes remain. No duplicate period-only index was added where the new compound index serves that prefix.

## Measurements

`tests/performance.test.ts` instruments database methods on synthetic Convex-test fixtures, counting returned documents and their UTF-8 JSON sizes. These are measured **application method reads**, not Convex billed I/O, physical index bytes, browser loading timings or production measurements. Authorization lookups are included. The notification comparison is the former closed-bell enriched list versus the new closed-bell preview; opened history is intentionally richer. Payroll compares the former full history with the bounded dashboard chart query. Bulk queue compares legacy candidate scanning with a full optimized claim, including its bookkeeping.

| Fixture / operation | Documents before | Documents after | JSON read bytes before | JSON read bytes after |
| --- | ---: | ---: | ---: | ---: |
| one client / usage | 12 | 6 | 6,013 | 1,062 |
| one client / payroll | 13 | 12 | 32,480 | 4,445 |
| one client / notificationsRead | 152 | 32 | 59,331 | 11,094 |
| large employee list / usage | 502 | 6 | 281,397 | 1,066 |
| large employee list / payroll | 13 | 12 | 32,472 | 4,443 |
| extensive history / usage | 12 | 6 | 6,013 | 1,064 |
| extensive history / payroll | 1,003 | 12 | 3,176,455 | 4,447 |
| large notification history / usage | 3 | 6 | 1,020 | 1,057 |
| large notification history / payroll | 4 | 5 | 1,673 | 1,378 |
| large notification history / notificationsRead | 502 | 102 | 196,962 | 36,075 |
| 10 accountants / admin | 167 | 8 | 192,393 | 1,475 |
| 100 accountants / admin | 1,607 | 8 | 1,736,314 | 1,486 |
| 250 bulk recipients / queue | 251 | 18 | 136,332 | 6,103 |

The one-employee fixture increases monthly-usage method reads from 3 to 6, and one-run summary reads from 4 to 5 because readiness/summary lookups have a fixed overhead. This is not an across-the-board reduction for tiny accounts. Larger histories show the intended benefit. A 250-recipient batch completion reads 3 documents after migration rather than collecting its batch.

Full raw fixture results are in `docs/performance-fixtures.json`.

Idle cron frequency (configuration-derived estimate): social, reminders and onboarding campaigns each fall from 1,440 to 96 nominal invocations/day. Including unchanged Mia and retention crons, total nominal cron invocations fall from 4,464 to 432/day: **90.3% fewer**. Active event jobs, retries and downstream functions are additional; this is not a measured total database I/O reduction.

## Regression validation

- Backend: 244 tests across 16 files passed; new performance, permission, free-plan, directory, admin pagination, bulk progress and scheduling tests included.
- Backend Convex TypeScript check passed.
- Convex browser/Node runtime bundles and renderer compatibility checks passed.
- Backend production build passed.
- Requested frontend TypeScript and production build passed, including a build with the actual checked-in public production configuration and optimized API checks.
- All 10 frontend Node/config/React-rendering test entries passed. Pending-account query gating, every dashboard tab, selected-only payroll, zero selection, review edits, approval gating, approved snapshots, roster editing/deletion, profiles, signatures and deploy guards are covered.
- Two pre-existing stale frontend tests were reproduced on the original source, then updated: literal hidden-wrapper markup and obsolete direct payroll creation. Current approval behavior remains checked by the companion approval regression.
- Playwright was attempted but Chromium cannot launch in this execution environment: `socket() failed: Operation not permitted`. Browser assertions did not execute; they must run in Cloud Shell or another browser-capable environment.
- The separate backend repository's bundled frontend retains 13 pre-existing full-project TypeScript errors; the actual deployed frontend's TypeScript passes. That bundled frontend is not the Hosting build in this release.
- Live Firebase/Google login, Paddle transactions, real Resend delivery, production Cayla voice/text, actual push delivery and mobile/desktop visual smoke tests were not executed. Existing financial/compliance and authorization suites passed; statutory formulas/rates were not rewritten.

## Remaining bottlenecks and limits

- Explicit full payroll, export/compliance, selected-run review and report workflows still read the complete authorized data they require.
- The unread badge is a bounded 100-unread-record window with visibility/preferences enforced, not a lifetime unread total. Full history is available through pagination.
- Activity pagination bounds scanned workspace rows to 100, so sparse client histories may need additional pages. Recent events use direct client/workspace indexes.
- Admin exact rolling 7/30-day boundaries still read the partial oldest day's signup records; they do not scan all users/history. Other less-used admin analytical endpoints retain legacy scans.
- Very large single-mutation employee imports incur contribution/directory write overhead; fixture coverage includes 500 employees. Further import-job batching and contention measurement should precede much larger deployments.
- Global administrative summaries can become write-contention points at substantially greater concurrency; production contention and transaction retries need monitoring.
- Large embedded payroll snapshots and branding remain in authoritative detail records. They are removed from normal selector/history payloads, not destructively restructured.
- React invalidation and wall-clock loading improvements are architectural expectations, not measured browser/production timings here.

## Files modified

Backend implementation/source files (many financial feature files change only their mutation constructor import so summaries cannot be bypassed):

- `convex/_generated/api.d.ts` (generated with the installed Convex API template)
- `convex/accountantCampaign.ts`
- `convex/accountantCheckouts.ts`
- `convex/accountantClients.ts`
- `convex/accountantVerification.ts`
- `convex/accountantWorkspace.ts`
- `convex/admin.ts`
- `convex/announcements.ts`
- `convex/betaUsage.ts`
- `convex/bulkPayslipEmail.ts`
- `convex/businesses.ts`
- `convex/caylaAgent.ts`
- `convex/caylaQueries.ts`
- `convex/compliance.ts`
- `convex/complianceVerification.ts`
- `convex/countryPayroll.ts`
- `convex/crons.ts`
- `convex/emailLogs.ts`
- `convex/emailPreferences.ts`
- `convex/emailSubscriptions.ts`
- `convex/employees.ts`
- `convex/functions.ts`
- `convex/guestDashboard.ts`
- `convex/invitations.ts`
- `convex/lib/accountantAccess.ts`
- `convex/lib/backgroundScheduling.ts`
- `convex/lib/performance.ts`
- `convex/lib/socialScheduling.ts`
- `convex/messages.ts`
- `convex/miaInternal.ts`
- `convex/mobileReminders.ts`
- `convex/niaInternal.ts`
- `convex/notifications.ts`
- `convex/payrollRuns.ts`
- `convex/performanceMigration.ts`
- `convex/performanceSchema.ts`
- `convex/privacyRetention.ts`
- `convex/profile.ts`
- `convex/reminders.ts`
- `convex/schema.ts`
- `convex/social.ts`
- `convex/socialInternal.ts`
- `convex/socialSchema.ts`
- `convex/subscriptions.ts`
- `convex/usage.ts`
- `convex/users.ts`
- `docs/performance-fixtures.json`
- `package-lock.json`
- `package.json`
- `scripts/verify-performance-target.mjs`
- `scripts/wait-performance-ready.mjs`
- `tests/performance.test.ts`
- `tests/social.test.ts`

Frontend: `scripts/firebase-predeploy.mjs`, `src/components/AdminDashboard.tsx`, `src/components/accountant/{AccountantExperience,AccountantNotifications,BulkPayslipActions,EmployeeRoster}.tsx`, `tests/browser/mock-convex.tsx`, and the dashboard rendering, deployment guard and roster interaction config tests. Release report, deployment instructions and fixture measurements accompany the changes.

## Deployment, verification and rollback

See `docs/convex-io-deploy.md` for exact Cloud Shell commands, backup, migrations, frontend build/Hosting deployment, verification and compatibility rollback. No GitHub Actions deployment is used.

## Seven-day production monitoring

Before rollout save `convex deployment usage --deployment sure-book-me:sheetpay-accountant:prod --json`, the usage-dashboard function breakdown and the current live Hosting backup. Keep development, production, Portal and combined team totals separate.

For seven daily checks compare per-function database I/O, egress, executions, errors, transaction retries and scheduled backlog. Normalize by accountant sessions, payroll runs and recipients sent. Check social publish idempotency, campaign/reminder delivery timing, unread visibility after team changes, accurate capacity/usage enforcement, and job progress against provider logs. Review genuinely idle windows separately from active processing. Expect one-time backfill cost during rollout. Do not declare success from team totals or fixture ratios alone. Record production results after one day and again after seven days before claiming savings.
