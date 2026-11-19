# Practice plans and Free allowances

Monthly and Yearly keep their existing prices, checkout IDs and payroll/AI limits. Both unlock all six booking layouts and widget styles, and do not have the Free practice operation caps. Existing permissions and abuse throttles still apply.

Free: one booking layout (Signature Split), one widget style (Classic Chat), three services. Monthly UTC allowances: 10 CRM leads, 5 appointments, 5 follow-ups, 1 portal invitation, 20 accountant messages, 3 document requests, 5 portal uploads and 10 widget chat requests. Public bookings also create and consume a CRM lead. Automatic document-request notices do not consume accountant message allowance. Client replies do not consume accountant message allowance. Widget requests reserve allowance before the external AI call.

Premium layouts can be previewed on Free; publishing a new premium choice is blocked server-side. Previously saved premium choices and existing services are retained for compatibility. No records or confirmed appointments are deleted on downgrade. All existing conversations and document downloads remain readable after limits. Cancellation of appointments, completing follow-ups, reviewing documents and revoking client access remain available.

Counters use one indexed owner/UTC-month row. Mutations check and increment atomically; a failed mutation rolls back usage and records together. Upload allowance is checked before file storage and consumed at registration; failed registration deletes the stored blob. Cayla approvals use the same insertion helpers, so they cannot bypass limits. Staff actions resolve the workspace owner's subscription; visitors never choose the plan. Public visitors receive a contact-the-accountant message instead of a checkout.

The existing PLAN_LIMIT_REACHED event opens the existing upgrade modal. The practice workspace shows allowances; reaching a cap opens the paywall once per workspace/month/kind/session. Failed gated saves keep local form state. Payment always uses the existing checkout flow.

## Deployment and compatibility

Deploy backend first, then frontend. Targets are unchanged: Convex prod:clear-avocet-926 and Firebase Hosting myglowtext. The new practiceUsage table is additive; no backfill or destructive migration is required. Counters start with new successful operations after deployment, not inferred from old records. Existing paid subscriptions and payroll counters are unchanged.
