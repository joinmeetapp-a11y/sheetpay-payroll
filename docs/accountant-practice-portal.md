# Accountant booking, CRM and client portal release

This extends **https://sheetpay.app/accountant** in `joinmeetapp-a11y/Sheetpay-Payslip-`, with the backend in `joinmeetapp-a11y/sheetpay-payroll`. Both feature branches are `feat/accountant-practice-portal-20261118`, based on `perf/accountant-convex-io-20261117`. It does not use Sheetpay-Portal, accountants.sheetpay.app, or caylaex.

## What is implemented

- Accountant sidebar: Booking Pages, Website Widget, CRM, Appointments and Client Portal. The landing page's existing Accountant entry remains `/accountant`.
- One practice profile per workspace owner, with logo/cover uploads, brand color, headline, description, up to 20 services, prices, IANA timezone and weekly availability. Existing team roles govern editing; client messaging requires manageClients, and practice administration requires workspace Owner/Admin access.
- Published links `/book/{slug}`, PNG QR download and calendar downloads. Existing published slugs cannot change until unpublished.
- Embed loader `/sheetpay-widget.js`, isolated styles, lazy iframe `/widget/{slug}`, configured HTTPS origins, published branding, service questions, voice transcription and optional spoken replies where the browser supports them. Visitors complete explicit inquiry/booking forms; chat never executes a booking.
- Lead stages New/Contacted/Qualified/Proposal/Won/Lost, notes, linking to existing clients, follow-ups, practice inbox and appointments. The Create client button opens the existing client setup with a proposed name; existing capacity checks still apply.
- `/client-portal` uses existing Accountant Firebase authentication without invoking accountant onboarding or creating a payroll workspace. Clients accept a shareable invitation with a matching verified email. Accountants can revoke access.
- Paginated real-time messages, per-client document requests, uploads, review/correction, due reminders and authenticated document opening. Accepted invitations cannot restore revoked access.
- Ask Cayla includes a separate practice task panel. OpenAI prepares lead, appointment, document request, message or follow-up drafts. Review shows the selected client/lead. Approval is explicit, recorded, permission-checked and idempotent; stale appointment slots are revalidated at approval. Existing payroll Cayla and payroll approvals remain separate and unchanged.

## Runtime requirements and limits

- Keep existing Firebase and Convex browser environment variables. The verified production Convex URL is `https://clear-avocet-926.convex.cloud`; hosting is `myglowtext`.
- `OPENAI_API_KEY` belongs only in the Accountant Convex deployment. Optional `OPENAI_PRACTICE_MODEL` defaults to `gpt-4o-mini`. Without the key, forms work; public chat offers service information and the buttons, and practice AI commands explain that configuration is required.
- Enable the existing Firebase email/password provider and preserve authorized domains. Client verification and password reset use Firebase email delivery. Invitation links are generated for the accountant to share. This release does not automatically email/SMS chat messages, document requests or booking confirmations. Reminders are in-app; calendar export is available.
- Speech input and speech playback depend on browser support and microphone permission. Text is always available. Parent websites need to permit microphone use by the Sheetpay iframe.
- Public form submissions are consent checked, honeypot checked and limited per practice/email. Public chat and authenticated commands/uploads are bounded. These are application limits, not an edge CAPTCHA/WAF.
- Documents: PDF, PNG/JPEG/WebP, CSV, XLSX and DOCX, up to 10 MB. Images up to 2 MB. Upload type/size/signature checks are not antivirus scanning. Financial document extraction into payroll is not introduced by this release.
- Storage URLs are returned only after client authorization. Treat an obtained download URL as a bearer link. Revoking portal membership blocks new access; it cannot recall files already downloaded or links already obtained.
- Booking availability extends 14 days, with at least one hour's notice. One window per weekday; slots use real UTC instants matched to the practice timezone, including DST transitions. No external Google/Outlook calendar sync is introduced.
- Public pages render branding immediately in the application. Custom social-crawler OG previews are not generated server-side in this static Hosting release.
- No global history subscriptions or new polling crons. Lists paginate and new queries mount only on their relevant screens. Follow-up/document/appointment callbacks run at their due times; temporary throttle rows expire and unattached document uploads are cleaned up.

## Verification

Local frontend typecheck/build and existing configuration/payroll render/approval tests passed. Backend suite passed (253 tests before the final added appointment conflict test; the final practice suite has 10 passing tests). Backend typecheck and Convex runtime bundles passed. The isolated renderer test also renders all five practice screens and verifies explicit Cayla approval.

Local Playwright execution is blocked: Chromium fails on `socket() ... Operation not permitted`; the browser downloader also returned truncated archives. This is an environment limitation, not a browser-test pass. `.github/workflows/verify-practice-workspace.yml` runs the new desktop/mobile browser scenarios plus existing bulk-payslip/Cayla scenarios on GitHub. Require the workflow to pass and inspect its artifacts before production release. Fixtures do not use customer data, charge accounts or send emails.

## Release order

1. Review both feature branches and pass CI. Keep the current live frontend while deploying the additive backend.
2. If the optimization branch has not already been deployed and backfilled, follow `docs/convex-io-deploy.md` in the frontend repository first. The new branch includes its optimized frontend APIs; do not skip summary migrations/readiness checks.
3. Preserve local uncommitted/unpushed work and take the existing Convex/Hosting backups from that guide. Never reset or clean a Cloud Shell checkout containing user work.
4. Deploy the backend feature branch to the verified Accountant production project; then deploy the matching frontend feature branch. No destructive schema migration is needed for the new practice tables.

Backend commands, using the existing authenticated Cloud Shell checkout:

```bash
cd ~/sheetpay-payroll
git status --short
git fetch origin
git switch --track origin/feat/accountant-practice-portal-20261118
npm ci --no-audit --no-fund
npm run check:convex
npx vitest run
npm run check:social-bundle
node scripts/verify-performance-target.mjs
printf '%s\n' 'CONVEX_DEPLOYMENT=prod:clear-avocet-926' > /tmp/sheetpay-accountant-practice-production.env
env -u CONVEX_DEPLOY_KEY npx convex deploy --env-file /tmp/sheetpay-accountant-practice-production.env --typecheck enable
```

Use `git switch feat/accountant-practice-portal-20261118` if that local branch already exists. Stop if local changes prevent switching; preserve them. After deployment, confirm `performanceMigration:readiness` is ready as described in the optimization guide.

Frontend commands (use an existing checkout if available, otherwise clone to a fresh directory):

```bash
git clone --branch feat/accountant-practice-portal-20261118 https://github.com/joinmeetapp-a11y/Sheetpay-Payslip-.git ~/sheetpay-accountant-practice-web
cd ~/sheetpay-accountant-practice-web
npm ci --no-audit --no-fund
npm run lint
node --test tests/config/*.mjs
npx playwright install chromium
npm run test:bulk-browser
export SHEETPAY_DEPLOY_BRANCH=feat/accountant-practice-portal-20261118
export SHEETPAY_HOSTING_PROJECT=myglowtext
export VITE_ACCOUNTANT_CONVEX_URL=https://clear-avocet-926.convex.cloud
npx firebase-tools deploy --project myglowtext --only hosting
```

The existing predeploy hook checks the repository, reviewed branch and production backend and builds with the existing browser configuration. It does not switch branches or pull main.

## Before making the release live

Using synthetic accounts: open the main landing page's Accountant entry; sign in; check old onboarding, employee imports, payroll review/approval, statutory calculations, payslip preview/download/print, existing reminders, billing navigation and team restrictions. Then publish a practice profile; scan its downloaded QR code on a phone; book a slot and try it again; embed on an allowed website; test widget chat/voice; move an inquiry through CRM; create/complete a follow-up; invite a verified client; request/upload/review a document; revoke access; and prepare/approve/discard Cayla drafts. Check desktop and mobile, including unsupported microphone/browser fallback.

## Rollback

Restore the saved previous Hosting channel first. Leave the additive practice tables, scheduler entry points and backend in place: the old frontend ignores them, and pending reminders/uploads can finish safely. Disable practice publication through saved profiles if public booking must stop. Do not deploy an old schema that removes these tables or scheduled function targets. Do not import a pre-release backup over newer client activity.
