# Growth and activation analytics

This change adds /admin/analytics to the existing Sheetpay administration workspace. It depends on the corresponding growth/activation-analytics change in joinmeetapp-a11y/sheetpay-payroll. Deploy the backend before exposing the frontend route.

## Scope and evidence

Production figures have not been queried in this environment. No claim about the approximately 30 existing registrations, their activation, or payments has been verified. Dashboard queries read actual Convex summaries and verified Paddle subscription state after deployment. Production components contain no mock numbers; test fixtures are separate.

## Files

New: src/lib/growthAnalytics.ts, GrowthAnalyticsTracker.tsx, GrowthAnalyticsAdmin.tsx, ProductIntentChoices.tsx, growth-analytics.css and browser analytics fixtures/specification.

Updated: App.tsx, router.tsx, AdminDashboard.tsx, CookieConsentBanner.tsx, BetaTesterModal.tsx, SeoPhoneCta.tsx, CalculatorPage.tsx, AccountantExperience.tsx, BulkPayslipActions.tsx, legalDocuments.mjs and the browser-only Convex mock.

Backend: growthSchema.ts, growthAnalytics.ts, lib/growth.ts, schema.ts, businesses.ts, employees.ts, payrollRuns.ts, caylaAgent.ts, caylaAgentSchema.ts, ai.ts, accountantCheckouts.ts, subscriptions.ts and tests/growthAnalytics.test.ts.

## Dashboard

Overview and first-100 scorecard; sources; SEO first-landing conversion table; explicit Mobile/Accountant choices and calculator-only observed usage; stage reach and ordered funnel; Cayla starts/successes; first and repeat payroll; verified subscription MRR/ARR and billing-cycle mix; future retention/churn; diagnostics; reconstructed historical activity; authorized JSON export.

The first-100 counter counts verified live active Accountant subscriptions. Free admin entitlement, trialing, checkout redirects, sandbox billing and overdue/canceled/expired subscriptions are excluded. Scheduled cancellations remain active until the verified effective date. A first-paid-in-30-days count includes subsequently canceled customers with a known first-paid timestamp.

## Collection and privacy

Browser collection and attribution association require Allow analytics. Necessary only and Global Privacy Control disable collection. Withdrawing consent clears local visitor/session IDs and requests removal of optional attribution association. Anonymous first-touch is captured in memory before consent and persisted only after consent; it is preserved across internal navigation and registration. Last-touch is separate. Mobile beta and Accountant authentication use their existing Firebase identities.

Visitor capabilities use 256-bit cryptographic randomness and are hashed in Convex. Anonymous clients receive no visitor records or user data. Association derives the Firebase subject from authenticated Convex context. A visitor already associated with another user cannot be claimed. Existing users do not receive invented signup attribution from a new visit.

Only public page paths, referring domains, constrained campaign slugs, event names, allowlisted error categories, product context and counts enter analytics. Query strings, auth codes, click-ID values, employee identities, payroll values, files and Cayla text are not copied. Campaign values are sanitized before transmission and again on the server. UTMs are labels; exact organic Google queries are unknown.

Signup uses the persisted creation date. Verification and onboarding completion are observed from authoritative account fields by a separate authenticated analytics mutation when the workspace receives those fields; their new event timestamps record observation time. It does not invoke signup/verification functions or any email flow. Automatic approval review blocked edits to authentication files because those files contained existing welcome/marketing enrollment calls; those edits were removed, and the observer avoids changing those files.

Server completion events cannot be submitted through the public UI-event mutation. Admin authorization is enforced in Convex using resolveAdmin and verified email. Analytics-only roles receive aggregates; revenue and individual historical rows are restricted to existing full-admin roles. Export uses the same authorized report.

## Cohort and metric definitions

Registration cohort: users whose persisted signup date is in the selected UTC date range. Acquisition cohort: consented visitors whose first visit is in the range, with registrations associated to that first touch. Conversions are observed through query time, including follow-up after the acquisition/signup window. Do not compare either cohort with an all-time registration denominator.

SEO signup rates are shown for acquisition cohorts. Visitors are unique capabilities, not guaranteed unique humans/devices. Sessions are browser-session IDs; the displayed total is lifetime sessions for the selected first-visit visitors, not sessions occurring within the date window. Authenticated users are deduplicated by Convex user ID. Cross-device visitors remain separate; a signup has one primary first-touch visitor.

Product interest reflects observed use or explicit choice, not account type or entering Accountant onboarding. Calculator use does not override explicit Mobile/Accountant interest. First declared interest is preserved separately from current interest, and switched interest is recorded.

Funnel reach is known/observed stage reach. Ordered conversion requires preceding events with chronological timestamps. The existing onboarding provisions the first client before its completion milestone, so some users reach stages without satisfying that strict order. Missing historical timestamps prevent a reliable ordered conversion; known historical completion is marked reconstructed rather than assigned a guessed date. Diagnostics describe missing observed activity, not proven psychological reasons for abandonment.

First real payroll follows savePreparedCaylaPayroll, after the existing statutory/review engine and persisted approval. Every employee must exist, belong to the client, and be non-demo. A permanent client-period ledger prevents repeat clicks, duplicate runs and event-retention cleanup from re-counting payroll. A second payroll means another client-period, including a different client's payroll; this is not a same-client cycle-retention percentage. Client-rendered PDFs are acknowledged only after successful rendering/download/print/share and validated against the stored run. They are not server-rendered PDF proof.

MRR uses verified recurring Paddle line-item amounts, before tax, with yearly prices divided by 12. A missing price/amount makes MRR unavailable rather than guessing from a configured plan price. Different currencies are not summed. ARR is MRR times 12. Billing snapshots preserve observed transitions, including cancellations, expirations, reactivations and future gross recurring-revenue loss. Churn is available only for a period wholly after the dated billing baseline. Existing signature verification, webhook event-id deduplication and billing behavior remain in place. Approved refund adjustments are recorded if their signed webhooks reach the existing endpoint; refund-adjusted collected revenue is unavailable.

## History, retention and limits

Opening the authorized admin report starts an analytics-only scheduled job, paginates users, and reconstructs only supported records: signup dates, verification boolean, known onboarding flag, client/employee creation, recorded imports/actions, and approved payroll with retained server-review proof. Verification/onboarding timestamps absent from old records remain unknown. Historical completion proof may have expired with temporary review records; a persisted client-calculated snapshot alone is not treated as server-engine completion. No historical landing pages, search queries or errors are invented.

Detailed events expire after 180 days. Visitors expire after 365 days without a visit. Rate buckets expire after ten minutes. Operational milestone summaries, billing snapshots and payroll cycle keys remain for account-level reporting and are removed in bounded scheduled batches after account deletion. Cleanup runs every minute through an analytics-only scheduled loop. The existing cron file and its marketing dispatcher are not modified or invoked by this feature. Public collection has per-visitor/user and global per-minute budgets.

Reports read indexed summary/visitor records, not the full production event table in the browser. Reports bound acquisition/registration/current-paid cohorts to 5,000 records and mark oversized reports partial; export is disabled when partial. Historical display is bounded to 100 users. Historical reconstruction bounds clients/activity/Cayla records and payroll runs and flags rows that reach its safety limit; it is not an exhaustive arbitrary-scale forensic export. Narrow date ranges if a report reaches its bound.

## Unavailable metrics

Historical landing pages and pre-instrumentation public workflow events; exact organic search keywords; Search Console impressions/rankings/clicks without an integrated verified source; attributable spend/CAC; collected/refund-adjusted SEO revenue; dated historical churn and same-client cycle retention; trial-to-paid baselines; and estimated time to 100 without sufficient paid acquisition history. These display as unknown or unavailable. Zero recorded ad spend is not presented as fully loaded organic CAC.

## Verification and deployment

Validation performed: ten focused backend analytics tests and existing verification/admin/pricing/Cayla regressions (88 total tests); frontend and backend TypeScript checks; configured production frontend build; four new desktop/mobile analytics browser tests; public mobile smoke checks on /, /nis-calculator-trinidad, /income-tax-calculator-belize and /privacy-policy with no JavaScript exceptions or horizontal overflow.

The wider browser run had 37 passes and 25 failures, mainly existing Cayla fixtures expecting a Prepare payroll button not rendered by the current source. A representative failure was reproduced against unchanged baseline source. A desktop print case timed out in the broad concurrent run and passed its isolated rerun (ten isolated print pages). The wider browser suite is not claimed green. Existing large-bundle build warnings remain.

Deployment is blocked: no CONVEX_DEPLOY_KEY, Firebase login, FIREBASE_TOKEN or application-default credentials were available. firebase projects:list returned Failed to authenticate, have you run firebase login? No production deployment, production admin query, historical reconstruction execution or production sign-in/payment test has been claimed. No marketing email was sent. No GitHub Actions workflow was created or triggered. Automatic review also rejected the existing cron file because it contains the marketing dispatcher; its changes were removed in favor of the separate analytics-only maintenance loop.

After promoting the reviewed changes into the deployment branches without running GitHub Actions, use the existing direct flow:

```sh
# In the full sheetpay-payroll checkout, with a production Convex credential
npm install
npx convex deploy

# In the full Sheetpay-Payslip- checkout
npm ci
npm run build
npx firebase-tools deploy --only hosting --project myglowtext
```

The existing Firebase predeploy hook requires a clean main checkout with the correct origin, pulls published main, loads scripts/hosting-public-config.json, and rebuilds. It must see the reviewed frontend changes on main before deployment; deploying only the feature branch with the existing hook would not publish this implementation. Do not use or trigger a GitHub Actions workflow to deploy.

After backend deployment, open /admin/analytics with the existing verified admin login to start initialization, or invoke growthAnalytics.initialize through the authenticated Convex CLI. This starts the dedicated analytics-only maintenance loop without changing existing cron jobs. Backfill runs without sending emails. Confirm the job completes, use the existing verified admin login, open /admin/analytics, verify denied access for ordinary accounts, then verify one consented visit/signup and an approved real payroll against authoritative production records. Paddle price/subscription/refund webhook availability and consent rates determine reporting coverage.
