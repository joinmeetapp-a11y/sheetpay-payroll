import { syncBackgroundSchedule } from "./lib/backgroundScheduling";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { PERFORMANCE_TABLES, syncPerformance } from "./lib/performance";

// Deliberately uses the raw constructor: backfill does not recursively trigger itself.
// Internal-only operator entry point. Each table's cursor is committed atomically.
export const backfill = internalMutation({ args: { table: v.string() }, handler: async (ctx, { table }) => {
  if (!PERFORMANCE_TABLES.includes(table as any)) throw new Error("Unsupported summary table");
  const state = await ctx.db.query("performanceMigrations").withIndex("by_key", q => q.eq("key", table)).unique();
  if (state?.done) return { done: true };
  const page = await ctx.db.query(table as typeof PERFORMANCE_TABLES[number]).paginate({ cursor: state?.cursor || null, numItems: 50, maximumBytesRead: 2 * 1024 * 1024 });
  for (const doc of page.page) await syncPerformance(ctx, table, String(doc._id), doc);
  const next = { key: table, cursor: page.continueCursor, done: page.isDone, processed: (state?.processed || 0) + page.page.length };
  if (state) await ctx.db.patch(state._id, next); else await ctx.db.insert("performanceMigrations", next);
  if (!page.isDone) await ctx.scheduler.runAfter(1000, (internal as any).performanceMigration.backfill, { table });
  return next;
} });
export const status = internalQuery({ args: {}, handler: ctx => ctx.db.query("performanceMigrations").take(20) });

export const migrateBackground=internalMutation({args:{table:v.union(v.literal('reminders'),v.literal('accountantEmailCampaigns')),cursor:v.optional(v.string())},handler:async(ctx,a)=>{
 const page=await ctx.db.query(a.table).paginate({numItems:50,cursor:a.cursor||null});
 for(const row of page.page)if(!row.scheduledFunctionId)await syncBackgroundSchedule(ctx,a.table,null,row);
 if(!page.isDone)await ctx.scheduler.runAfter(1000,(internal as any).performanceMigration.migrateBackground,{table:a.table,cursor:page.continueCursor});
 return {isDone:page.isDone,continueCursor:page.continueCursor};
}});

export const readiness=internalQuery({args:{},handler:async(ctx)=>{
 const states=await ctx.db.query('performanceMigrations').take(20);
 return {productionUrl:process.env.CONVEX_CLOUD_URL,ready:PERFORMANCE_TABLES.every(table=>states.some(s=>s.key===table&&s.done)),states};
}});
