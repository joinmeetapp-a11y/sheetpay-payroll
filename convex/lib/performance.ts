import type { MutationCtx, QueryCtx } from "../_generated/server";

export const PERFORMANCE_TABLES = ["users", "businesses", "accountantClients", "employees", "payrollRuns", "accountantMemberships", "caylaConversations", "caylaUsageLogs", "bulkEmailRecipients", "usageCounters"] as const;
type Contributions = Record<string, Record<string, number>>;
const accepted = new Set(["sent", "delivered", "delayed", "bounced", "complained"]);
export function contributions(table: string, doc: any): Contributions {
  if (!doc) return {};
  const user = `user:${doc.userId || doc.accountantUserId || doc.workspaceOwnerId}`;
  if (table === "users") {
    const plan = doc.plan || "free", status = doc.planStatus || (plan === "free" ? "none" : "active");
    const paid = plan !== "free" && ["active", "pending"].includes(doc.planStatus || "active");
    const mrr = paid ? ({ pro: 29, accountant: 99, accountant_monthly: 97, accountant_yearly: 97 } as Record<string, number>)[plan] || 0 : 0;
    return { global: { totalUsers: 1, paidUsers: +paid, freeUsers: +!paid, mrr, [`plan:${plan}`]: 1, [`type:${doc.accountType}`]: 1, [`status:${status}`]: 1 }, ...(typeof doc.createdAt === "number" ? { [`signup:${new Date(doc.createdAt).toISOString().slice(0, 10)}`]: { count: 1 } } : {}) };
  }
  if (table === "employees") return { global: { totalEmployees: 1 }, [user]: { employees: 1 }, [`business:${doc.businessId}`]: { employees: 1, gross: Number(doc.grossPay || doc.basicPay || 0) } };
  if (table === "businesses") return { [user]: { clients: 1 } };
  if (table === "accountantClients") return { [user]: { legacyClients: 1 } };
  if (table === "accountantMemberships") return { [user]: { members: doc.status === "active" ? 1 : 0 } };
  if (table === "payrollRuns") return { global: { payrollsProcessed: 1, payslipsGenerated: doc.employeesSnapshot.length }, [user]: { payrolls: 1 }, [`business:${doc.businessId}`]: { payrolls: 1 } };
  if (table === "caylaConversations") return { global: { caylaConversations: 1 } };
  if (table === "caylaUsageLogs") return { global: { caylaPayrollActions: +["payroll_completed", "cayla_payroll_completed"].includes(doc.action) } };
  if (table === 'usageCounters') return { [`usage:${doc.period}`]: {payrollRuns:doc.payrollRunsUsed||0,payslips:doc.payslipsUsed||0,ocrScans:doc.ocrScansUsed||0,caylaActions:doc.caylaActionsUsed||0,emails:doc.payslipEmailsUsed||doc.emailsReserved||0,reminderEmails:doc.reminderEmailsReserved||0} };
  if (table === "bulkEmailRecipients") return { [`job:${doc.jobId}`]: { sent: +accepted.has(doc.status), failed: +(doc.status === "failed"), skipped: +(doc.status === "skipped"), pending: +["queued", "sending"].includes(doc.status) } };
  return {};
}

/** Ledger makes backfill and live changes commute in one transaction. Never reset counters. */
export async function syncPerformance(ctx: MutationCtx, table: string, sourceId: string, doc: any) {
  const old = await ctx.db.query("performanceContributions").withIndex("by_source", q => q.eq("sourceId", sourceId)).unique();
  const next = contributions(table, doc), previous = (old?.values || {}) as Contributions;
  if (JSON.stringify(previous) !== JSON.stringify(next)) {
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      const deltas: Record<string, number> = {};
      for (const field of new Set([...Object.keys(previous[key] || {}), ...Object.keys(next[key] || {})])) {
        const delta = (next[key]?.[field] || 0) - (previous[key]?.[field] || 0);
        if (delta) deltas[field] = delta;
      }
      if (!Object.keys(deltas).length) continue;
      const row = await ctx.db.query("performanceCounters").withIndex("by_key", q => q.eq("key", key)).unique();
      const values = { ...(row?.values || {}) };
      for (const [field, delta] of Object.entries(deltas)) values[field] = (values[field] || 0) + delta;
      if (row) await ctx.db.patch(row._id, { values }); else await ctx.db.insert("performanceCounters", { key, values });
    }
    if (doc) {
      if (old) await ctx.db.patch(old._id, { values: next });
      else await ctx.db.insert("performanceContributions", { sourceId, table, values: next });
    } else if (old) await ctx.db.delete(old._id);
  }
  if(table==='usageCounters' && doc){
    const activityScore=(doc.payrollRunsUsed||0)+(doc.payslipsUsed||0)+(doc.ocrScansUsed||0)+(doc.caylaActionsUsed||0)+(doc.payslipEmailsUsed||doc.emailsReserved||0);
    if(doc.activityScore!==activityScore)await ctx.db.patch(doc._id,{activityScore});
  }
  if(table==='users' && doc){
    const searchText=`${doc.displayName||''} ${doc.email||''}`.toLowerCase();
    if(doc.searchText!==searchText)await ctx.db.patch(doc._id,{searchText});
  }
  if(table==='businesses'){
    const row=await ctx.db.query('businessDirectory').withIndex('by_source',q=>q.eq('sourceId',doc?._id||sourceId as any)).unique();
    if(!doc){if(row)await ctx.db.delete(row._id);}
    else {
      const value={sourceId:doc._id,userId:doc.userId,name:doc.name,countryCode:doc.countryCode,countryName:doc.countryName,currency:doc.currency,currencySymbol:doc.currencySymbol,defaultPayrollFrequency:doc.defaultPayrollFrequency};
      if(row){const {_id,_creationTime,...before}=row;if(JSON.stringify(before)!==JSON.stringify(value))await ctx.db.replace(row._id,value);}else await ctx.db.insert('businessDirectory',value);
    }
  }
  if(table==='employees'){
    const row=await ctx.db.query('employeeDirectory').withIndex('by_source',q=>q.eq('sourceId',doc?._id||sourceId as any)).unique();
    if(!doc){if(row)await ctx.db.delete(row._id);}
    else {
      const value={sourceId:doc._id,businessId:doc.businessId,name:doc.name,employeeId:doc.employeeId,email:doc.email,position:doc.position,status:doc.status,searchText:`${doc.name} ${doc.employeeId} ${doc.email||''}`.toLowerCase()};
      if(row){const {_id,_creationTime,...before}=row;if(JSON.stringify(before)!==JSON.stringify(value))await ctx.db.replace(row._id,value);}else await ctx.db.insert('employeeDirectory',value);
    }
  }
  if (table === "payrollRuns") {
    const row = await ctx.db.query("payrollRunSummaries").withIndex("by_run", q => q.eq("runId", doc?._id || sourceId as any)).unique();
    if (!doc) { if (row) await ctx.db.delete(row._id); return; }
    const { _id, _creationTime, employeesSnapshot, statutoryBreakdown, ...summary } = doc;
    const value = { ...summary, runId: _id, employeeCount: employeesSnapshot.length };
    if (row) { const { _id: ignored, _creationTime: ignoredTime, ...before } = row; if (JSON.stringify(before) !== JSON.stringify(value)) await ctx.db.replace(row._id, value); }
    else await ctx.db.insert("payrollRunSummaries", value);
  }
}
export async function performanceReady(ctx: QueryCtx | MutationCtx, table: string) {
  return (await ctx.db.query("performanceMigrations").withIndex("by_key", q => q.eq("key", table)).unique())?.done === true;
}
export async function performanceCounter(ctx: QueryCtx | MutationCtx, key: string) {
  return (await ctx.db.query("performanceCounters").withIndex("by_key", q => q.eq("key", key)).unique())?.values || {};
}
