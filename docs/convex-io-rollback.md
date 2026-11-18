# Compatibility rollback

Branch: perf/accountant-convex-io-compat-rollback-20261118.

This restores pre-optimization query and bulk-processing behavior, membership activity writes, Cayla conversation reads and one-minute polling. The original notification and social fixes are retained. Financial calculations, permission checks and billing operations remain unchanged.

Additive schema, summaries, transactional mutation wrappers and new read/scheduler entry points remain available. Pending scheduled jobs therefore continue to resolve, and clients with the newer frontend cached can still call its APIs. Do not replace this branch with an old schema or delete summary/customer data to roll back.

Restore the saved Firebase live channel first, then deploy this backend only if needed, using docs/convex-io-deploy.md. No production deployment was performed while preparing the rollback.

Validation: 225 original tests passed (15 files), backend TypeScript passed and both Convex runtime bundle/renderer checks passed. Performance fixtures intentionally target the optimized branch and are not rollback acceptance tests.
