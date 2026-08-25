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

export default crons;
