# Sheetpay Accountant: Cloud Shell release and rollback

This release has not been deployed. The live Accountant frontend is on **myglowtext**, not the different app currently served by mysheetpay.web.app. Convex must be **sure-book-me / sheetpay-accountant / production**, expected URL **https://clear-avocet-926.convex.cloud**. The GCP project printed in the shell prompt does not choose Convex.

Run these sections in order. Do not publish the new frontend before all summary backfills report ready. Keep the previous live frontend while migrations run. Existing backend APIs continue to serve it.

## 1. Preserve the confirmed backend checkout and pull the new branch

The backup command preserves the user's currently unpushed social fix. Run the initial backup once, before switching branches.

```bash
set -e
cd ~/sheetpay-payroll
test -z "$(git status --porcelain --untracked-files=no)"
git branch backup/pre-io-20261118
git push origin backup/pre-io-20261118
git fetch origin
git switch -c perf/accountant-convex-io-20261117 --track origin/perf/accountant-convex-io-20261117
git pull --ff-only origin perf/accountant-convex-io-20261117
git log -1 --oneline
npm ci --no-audit --no-fund
npm run check:convex
npx vitest run
npm run check:social-bundle
node scripts/verify-performance-target.mjs
```

If this optimization branch already exists locally, use `git switch perf/accountant-convex-io-20261117` instead of the `-c` command. A dirty-check failure means save those changes first; do not discard them.

## 2. Prepare and validate the frontend before production changes

Use the existing GitHub authentication in Cloud Shell for the private frontend repository. No token belongs in a shell command or source file.

```bash
set -e
cd ~
git clone --branch perf/accountant-convex-io-20261117 https://github.com/joinmeetapp-a11y/Sheetpay-Payslip-.git sheetpay-accountant-io-web
cd ~/sheetpay-accountant-io-web
git pull --ff-only origin perf/accountant-convex-io-20261117
npm ci --no-audit --no-fund
npm run lint
node --test tests/config/*.mjs
npx playwright install chromium
npm run test:bulk-browser
npm run test:social-browser
```

For an existing `~/sheetpay-accountant-io-web` checkout, fetch/switch/pull rather than cloning over it. The browser suites could not execute in the preparation environment because Chromium socket creation is restricted. Resolve browser failures before a production release; don't skip them to make deployment pass.

## 3. Save production data, usage baseline and the live Hosting version

The export stays outside Git. Cloning the current live channel creates a precise frontend rollback version without rebuilding old source.

```bash
set -e
cd ~/sheetpay-payroll
node scripts/verify-performance-target.mjs
mkdir -p ~/sheetpay-io-backups
npx convex export --deployment sure-book-me:sheetpay-accountant:prod --include-file-storage --path ~/sheetpay-io-backups/convex-before-io-20261118.zip
npx convex deployment usage --deployment sure-book-me:sheetpay-accountant:prod --json > ~/sheetpay-io-backups/usage-before-io-20261118.json
cd ~/sheetpay-accountant-io-web
npx firebase-tools hosting:sites:list --project myglowtext
npx firebase-tools hosting:clone myglowtext:live myglowtext:pre-io-20261118 --project myglowtext
```

Confirm that the Hosting site list is the expected myglowtext site serving sheetpay.app. Keep the backup channel until the seven-day review ends. Do not run this backup step again after releasing the new frontend, as that would replace the saved version.

## 4. Deploy the backend and wait for indexes

The explicit environment file contains only a public deployment selector. It prevents the development/Portal selection in another shell or dotenv file from choosing the target. Normal deployment waits for index backfill; do not bypass large-index checks.

```bash
set -e
cd ~/sheetpay-payroll
node scripts/verify-performance-target.mjs
printf '%s\n' 'CONVEX_DEPLOYMENT=prod:clear-avocet-926' > /tmp/sheetpay-accountant-io-production.env
env -u CONVEX_DEPLOY_KEY npx convex deploy --env-file /tmp/sheetpay-accountant-io-production.env --typecheck enable
```

## 5. Migrate summaries and pending scheduled jobs

All commands are scoped to the named production project. They are non-destructive, bounded and resumable. Running backfill again for an incomplete table resumes its stored cursor. Completed tables are no-ops.

```bash
set -e
cd ~/sheetpay-payroll
for table in users businesses accountantClients employees payrollRuns accountantMemberships caylaConversations caylaUsageLogs bulkEmailRecipients usageCounters
do
  npx convex run --deployment sure-book-me:sheetpay-accountant:prod performanceMigration:backfill "{\"table\":\"$table\"}"
done
npx convex run --deployment sure-book-me:sheetpay-accountant:prod social:migrateSchedules '{"paginationOpts":{"numItems":50,"cursor":null}}'
npx convex run --deployment sure-book-me:sheetpay-accountant:prod performanceMigration:migrateBackground '{"table":"reminders"}'
npx convex run --deployment sure-book-me:sheetpay-accountant:prod performanceMigration:migrateBackground '{"table":"accountantEmailCampaigns"}'
node scripts/wait-performance-ready.mjs
npx convex run --deployment sure-book-me:sheetpay-accountant:prod performanceMigration:readiness '{}'
```

The wait command stops after 15 minutes if summaries remain incomplete. Inspect logs and resume the incomplete tables; keep the old frontend live. Scheduled-job migration continuations should also finish before the following smoke checks.

## 6. Build and deploy the reviewed frontend

The corrected predeploy hook validates the same branch and production URL and rebuilds without pulling main. It retains the existing Firebase auth and Paddle public configuration.

```bash
set -e
cd ~/sheetpay-accountant-io-web
git pull --ff-only origin perf/accountant-convex-io-20261117
export SHEETPAY_DEPLOY_BRANCH=perf/accountant-convex-io-20261117
export SHEETPAY_HOSTING_PROJECT=myglowtext
export VITE_ACCOUNTANT_CONVEX_URL=https://clear-avocet-926.convex.cloud
npm run lint
npm run build
npx firebase-tools deploy --project myglowtext --only hosting
```

The public build also needs the existing auth/Paddle browser settings. Firebase predeploy supplies missing values from `scripts/hosting-public-config.json`, preserving explicit configured overrides except that the Accountant production Convex URL is checked. To build with all those defaults before the deploy hook, run:

```bash
node --input-type=module -e 'import fs from "node:fs"; import {spawnSync} from "node:child_process"; const defaults=JSON.parse(fs.readFileSync("scripts/hosting-public-config.json","utf8")); const result=spawnSync("npm",["run","build"],{stdio:"inherit",env:{...defaults,...process.env}}); process.exit(result.status ?? 1);'
```

## 7. Verify the released application

```bash
curl --fail --silent --show-error https://sheetpay.app/accountant -o /tmp/sheetpay-accountant-live.html
cd ~/sheetpay-payroll
node scripts/verify-performance-target.mjs
npx convex run --deployment sure-book-me:sheetpay-accountant:prod performanceMigration:readiness '{}'
npx convex logs --deployment sure-book-me:sheetpay-accountant:prod --history 100
npx convex deployment usage --deployment sure-book-me:sheetpay-accountant:prod --json
```

Stop the streaming logs with Ctrl+C after reviewing them. HTTP success alone does not verify login or payroll. In a browser verify Firebase/Google sign-in, a new/existing client, employee import/edit, selected-only and full payroll approval, historical run pagination and selection, payslip preview/download/print, compliance forms for TT/BB/LC/BZ, bulk email/progress/history, Cayla voice/text, notifications/read-all, reminders, social approval/scheduling, team restriction/revocation, free-plan limits and Paddle sandbox/approved billing checks. Check both mobile and desktop. Do not create real charges or send customer emails just for an unapproved smoke test; use the existing test accounts and synthetic recipients.

## 8. Roll back without discarding additive data or stranding jobs

First restore the exact saved frontend:

```bash
set -e
cd ~/sheetpay-accountant-io-web
npx firebase-tools hosting:clone myglowtext:pre-io-20261118 myglowtext:live --project myglowtext
```

If backend rollback is necessary, use the prepared compatibility rollback branch. It restores legacy heavy query/processing behavior and one-minute recovery polling while retaining additive schema, transactional bookkeeping and new scheduled-function entry points. This avoids dropping new fields or leaving pending jobs pointed at missing functions. It is not a destructive data rollback.

```bash
set -e
cd ~/sheetpay-payroll
git fetch origin
git switch --track origin/perf/accountant-convex-io-compat-rollback-20261118
npm ci --no-audit --no-fund
npm run check:convex
node scripts/verify-performance-target.mjs
printf '%s\n' 'CONVEX_DEPLOYMENT=prod:clear-avocet-926' > /tmp/sheetpay-accountant-io-production.env
env -u CONVEX_DEPLOY_KEY npx convex deploy --env-file /tmp/sheetpay-accountant-io-production.env --typecheck enable
```

Do not deploy the old schema directly or import the pre-release database snapshot over live customer activity. Both could discard or invalidate work completed since the release. The export is a recovery asset for a separately reviewed incident response. New optional fields and summary tables can safely remain after compatibility rollback.

## Seven-day usage checks

```bash
cd ~/sheetpay-payroll
npx convex deployment usage --deployment sure-book-me:sheetpay-accountant:prod --json > ~/sheetpay-io-backups/usage-after-io-$(date -u +%Y%m%d).json
```

Run once daily for seven days, and review the production function usage dashboard. Separate one-time backfill cost, genuinely idle windows and active user operations. Compare per-operation I/O and egress, errors, transaction retries, scheduled backlog, delivery timing and correctness; team-combined totals include other deployments. Fixture reductions are not proof of production savings.
