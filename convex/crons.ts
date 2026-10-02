import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every minute, look for reminders whose nextRunAt <= now.
// The by_next_run_at index bounds this to just due rows — never a table scan.
crons.interval(
  "dispatch-due-reminders",
  { minutes: 1 },
  internal.fcm.dispatchDueReminders,
  {}
);

crons.interval('mia-retention', { hours: 1 }, (internal as any).miaInternal.purgeExpired, {});
crons.interval('mia-ack-retry', { minutes: 15 }, (internal as any).mia.retryAcknowledgements, {});

crons.interval('temporary-payroll-attachments-retention', { hours: 1 }, (internal as any).privacyRetention.purgeExpiredAttachments, {});

crons.interval("accountant-free-onboarding-campaign", { minutes: 1 }, (internal as any).accountantCampaignWorker.dispatch, {});
export default crons;
