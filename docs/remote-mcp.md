# Remote MCP backend

Frontend/gateway branch: `joinmeetapp-a11y/Sheetpay-Payslip-`, `feat/remote-mcp-20261119`. Backend branch: `feat/remote-mcp-20261119`, based on latest practice-plan implementation. Full operational instructions and configuration: frontend `integrations/mcp-gateway/README.md`.

Existing production target remains **prod:clear-avocet-926**. Existing Firebase auth config is unchanged. New Convex environment variables: `MCP_ISSUER_URL` (actual HTTPS gateway origin) and `MCP_STORAGE_SECRET` (same private generated storage secret as gateway). No gateway signing/encryption key or deployment key is installed in the browser.

`mcpHttp` exposes only fixed `/mcp/tools` and `/mcp/oauth-store` HTTP actions. Tool requests require verified resource JWTs; internal dispatch uses a hardcoded allowlist and strict shared validation. OAuth storage requests require the separate storage-service credential and a fixed operation/model allowlist. Neither endpoint executes arbitrary function names. Settings uses existing Firebase authentication for `mcp.configuration`, `organizations`, `connections`, `connect` and `revoke`; consent also requires a gateway HMAC binding.

The resource JWT is deliberately not added to `auth.config.ts`: doing so would authorize MCP tokens for unrelated existing Firebase endpoints. Instead, `mcpGateway` independently verifies issuer/audience/signature/expiry, then `mcp.execute` checks active encrypted token/grant artifacts, connection binding, membership, per-client access, scope, application role and subscription limits. Internal-only delegation reuses the verified actor with existing payroll/reminder helpers. No shared administrator identity.

Existing `caylaAgent` handlers are extracted into reusable implementations without changing public contracts. The internal MCP context restricts them to one authorized client and bounded source queries. Preparation uses the current engine and review tables, then the current UI performs final approval. Reminder drafts are for the accountant's in-app payroll reminders, not externally sent client messages. Tasks are omitted because the existing lead-followup service is not a client-task implementation.

Additive schema: `mcpConnections`, `mcpOAuthRecords`, `mcpJobs`, `mcpRateWindows`; `businessDirectory.search_name` filtered by owner; `practiceRequests.by_business_status_due`. No unbounded source migration. Current business-directory/payroll-summary projections must already be populated by the existing app's performance migration. OAuth expiry uses scheduled indexed direct deletes and grant revocation chunks of 500, no polling. Job creation and source checks are idempotent and bounded; no payroll histories are duplicated. Existing audit records store tool/actor/workspace/resource/outcome/request ID, never payroll contents.

Verify before deployment:

```bash
npm ci --no-audit --no-fund
npm run check:convex
npx vitest run
npm run check:social-bundle
```

Deployment commands are in the frontend README and `scripts/deploy-mcp-accountant.sh`; they explicitly select clear-avocet-926 and Firebase Hosting myglowtext. These commands are provided for a later operator-run deployment and were not executed. Deploying adds tables/indexes only; no backwards-incompatible migration or historical payroll recalculation is necessary. Configure real OAuth clients and test both platforms before enabling user connections.
