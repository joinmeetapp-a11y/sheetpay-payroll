/// <reference types="vite/client" />
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import type { Id } from '../convex/_generated/dataModel';
import { anyApi } from 'convex/server';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import schema from '../convex/schema';
import { PERFORMANCE_TABLES } from '../convex/lib/performance';
import { getMonthlyUsage } from '../convex/usage';
import { getByBusiness, recentSummaries } from '../convex/payrollRuns';
import { takeQueued, finishBatch } from '../convex/bulkPayslipEmail';
import { getOverview } from '../convex/admin';
import { listForCurrentUser, unreadPreview } from '../convex/notifications';
const measurements:any[]=[];
afterAll(()=>{if(process.env.WRITE_PERF_REPORT)writeFileSync('docs/performance-fixtures.json',JSON.stringify({instrumentation:'Application database methods: documents returned and UTF-8 JSON bytes; not production billing',measurements},null,2)+'\n');});
const api=anyApi, modules=import.meta.glob('../convex/**/*.{ts,js}');
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-18T12:00Z'));});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
const employee=(userId:any,businessId:any,i:number)=>({userId,businessId,name:`Employee ${i}`,email:`e${i}@example.com`,employeeId:`E${i}`,position:'Worker',department:'General',payFrequency:'monthly',basicPay:100,frequencySalary:100,overtimeHours:0,overtimeRate:0,bonus:0,commission:0,allowances:0,paye:0,nis:0,healthSurcharge:0,otherDeductions:0,grossPay:100,netPay:100,status:'active',localId:String(i),createdAt:Date.now()});
async function fixture(employees=10,runs=10,notifications=0){
 const t=convexTest(schema,modules);const ids=await t.run(async ctx=>{
  const user=await ctx.db.insert('users',{firebaseUid:'perf-owner',email:'surebookme@gmail.com',emailVerified:true,accountType:'accountant',plan:'accountant_monthly',planStatus:'active',createdAt:Date.now()});
  const other=await ctx.db.insert('users',{firebaseUid:'perf-other',email:'other@example.com',emailVerified:true,accountType:'accountant',createdAt:Date.now()});
  const business=await ctx.db.insert('businesses',{userId:user,name:'Performance client',currency:'TTD',currencySymbol:'$',updatedAt:Date.now()});
  return {user,other,business};
 });
 const employeesIds:any[]=[];for(let start=0;start<employees;start+=100)await t.run(async ctx=>{for(let i=start;i<Math.min(employees,start+100);i++)employeesIds.push(await ctx.db.insert('employees',employee(ids.user,ids.business,i)));});
 const runIds:any[]=[];for(let start=0;start<runs;start+=50)await t.run(async ctx=>{
  const snapshot=await Promise.all(employeesIds.slice(0,5).map(id=>ctx.db.get(id)));
  for(let i=start;i<Math.min(runs,start+50);i++)runIds.push(await ctx.db.insert('payrollRuns',{businessId:ids.business,userId:ids.user,month:'November',year:2026,status:'completed',employeesSnapshot:snapshot,totalGross:500,totalNet:500,totalPaye:0,totalNis:0,totalHealthSurcharge:0,totalDeductions:0,createdAt:Date.now()+i,updatedAt:Date.now()}));
 });
 for(let start=0;start<notifications;start+=100)await t.run(async ctx=>{for(let i=start;i<Math.min(notifications,start+100);i++){
  const id=await ctx.db.insert('notifications',{userId:ids.user,businessId:ids.business,employeeId:employeesIds[0],category:'payroll',type:'payroll',title:`Payroll ${i}`,message:'Payroll completed',dedupeKey:`perf:${i}`,createdAt:Date.now()+i});
  for(const channel of ['in_app','email','push'])await ctx.db.insert('notificationDeliveries',{notificationId:id,userId:ids.user,channel,provider:'test',status:'sent',attemptCount:1,idempotencyKey:`${id}:${channel}`,createdAt:Date.now(),updatedAt:Date.now()});
 }});
 return {t,ids,employeesIds,runIds,owner:t.withIdentity({subject:'perf-owner',email:'surebookme@gmail.com',emailVerified:true}),other:t.withIdentity({subject:'perf-other',email:'other@example.com',emailVerified:true})};
}
async function backfill(t:any){for(const table of PERFORMANCE_TABLES){let state;do{state=await t.mutation(api.performanceMigration.backfill,{table});}while(!state.done);}}
/** Counts documents actually returned by database methods and UTF-8 JSON bytes.
 * This is an application read meter, not Convex billed-byte instrumentation. */
async function measure(client:any,fn:any,args:any,write=false){return (write?client.mutation:client.query)(async(ctx:any)=>{
 let docs=0,bytes=0;const add=(r:any)=>{for(const doc of Array.isArray(r)?r:r?[r]:[]){docs++;bytes+=Buffer.byteLength(JSON.stringify(doc));}};
 const wrap=(obj:any):any=>new Proxy(obj,{get(target,key){const value=target[key];if(typeof value!=='function')return value;return(...a:any[])=>{
  const result=value.apply(target,a);if(['collect','take','first','unique','get','paginate'].includes(String(key)))return Promise.resolve(result).then(r=>{add(key==='paginate'?r.page:r);return r;});
  return result&&typeof result==='object'&&!(result instanceof Promise)?wrap(result):result;
 };}});
 const result=await fn._handler({...ctx,db:wrap(ctx.db)},args);return {documentsRead:docs,jsonBytesRead:bytes,jsonResponseBytes:Buffer.byteLength(JSON.stringify(result ?? null)),result:result ?? null};
});}

describe('transactional summaries, migrations and access',()=>{
 it('backfills in bounded resumable batches, agrees with legacy counts, and never resets monthly usage',async()=>{
  const f=await fixture(121,3);await f.owner.mutation(api.usage.trackUsage,{requesterUid:'perf-owner',kind:'ocr',opId:'same'});
  const before=await f.owner.query(api.usage.getMonthlyUsage,{});
  const first=await f.t.mutation(api.performanceMigration.backfill,{table:'employees'});expect(first).toMatchObject({processed:50,done:false});
  await backfill(f.t);const after=await f.owner.query(api.usage.getMonthlyUsage,{});expect(after).toEqual(before);
  await backfill(f.t);expect(await f.owner.query(api.usage.getMonthlyUsage,{})).toEqual(after);
  await f.owner.mutation(api.usage.trackUsage,{requesterUid:'perf-owner',kind:'ocr',opId:'same'});expect((await f.owner.query(api.usage.getMonthlyUsage,{})).ocrScansUsed).toBe(1);
  await expect(f.other.query(api.usage.getMonthlyUsage,{businessId:f.ids.business})).rejects.toThrow();
 });
 it('tracks imports, updates and deletes atomically; small UI pages never cap the full payroll ID set',async()=>{
  const f=await fixture(60,2);await backfill(f.t);
  const created=await f.owner.mutation(api.employees.create,((({_id,_creationTime,createdAt,...row}:any)=>row)(employee(f.ids.user,f.ids.business,61))));
  expect((await f.owner.query(api.usage.getMonthlyUsage,{})).employeeCount).toBe(61);
  await f.owner.mutation(api.employees.update,{employeeId:created,basicPay:150,grossPay:150,netPay:150});
  expect((await f.owner.query(api.payrollRuns.businessStats,{businessId:f.ids.business})).employees).toBe(61);
  const page=await f.owner.query(api.employees.listRoster,{businessId:f.ids.business,paginationOpts:{numItems:10,cursor:null}});expect(page.page).toHaveLength(10);expect(page.isDone).toBe(false);expect(page.page[0].basicPay).toBeUndefined();
  expect(await f.owner.query(api.employees.getPayrollIds,{businessId:f.ids.business})).toHaveLength(61);
  const detail=await f.owner.query(api.employees.getDetail,{employeeId:created});expect(detail.basicPay).toBe(150);
  await f.owner.mutation(api.employees.deleteEmployee,{employeeId:created});expect((await f.owner.query(api.usage.getMonthlyUsage,{})).employeeCount).toBe(60);
  await expect(f.other.query(api.employees.listRoster,{businessId:f.ids.business,paginationOpts:{numItems:10,cursor:null}})).rejects.toThrow();
 });
 it('returns summary-only payroll pages and authorizes historical details',async()=>{
  const f=await fixture(5,45);await backfill(f.t);
  let cursor=null;const seen=new Set();let page;do{page=await f.owner.query(api.payrollRuns.listHistory,{businessId:f.ids.business,paginationOpts:{numItems:20,cursor}});for(const run of page.page){expect(run.employeesSnapshot).toBeUndefined();expect(run.employeeCount).toBe(5);seen.add(run._id);}cursor=page.continueCursor;}while(!page.isDone);
  expect(seen.size).toBe(45);expect((await f.owner.query(api.payrollRuns.getDetail,{businessId:f.ids.business,runId:f.runIds[0]})).employeesSnapshot).toHaveLength(5);
  await expect(f.other.query(api.payrollRuns.getDetail,{businessId:f.ids.business,runId:f.runIds[0]})).rejects.toThrow();
 });
 it('keeps unread preview separate from delivery updates, paginates history and marks older notifications',async()=>{
  const f=await fixture(1,0,350);
  const preview=await f.owner.query(api.notifications.unreadPreview,{});expect(preview).toEqual({unreadCount:100,hasMore:true});
  const page=await f.owner.query(api.notifications.listPage,{paginationOpts:{numItems:20,cursor:null}});expect(page.page).toHaveLength(20);expect(page.page[0].deliveries).toHaveLength(3);
  expect((await f.other.query(api.notifications.listPage,{paginationOpts:{numItems:20,cursor:null}})).page).toEqual([]);
  await f.owner.mutation(api.notifications.markAllRead,{});await f.t.finishAllScheduledFunctions(vi.runAllTimers);expect(await f.owner.query(api.notifications.unreadPreview,{})).toEqual({unreadCount:0,hasMore:false});
 });
 it('does not bypass free employee limits after counters become authoritative',async()=>{
  const f=await fixture(10,0);await f.t.run(ctx=>ctx.db.patch(f.ids.user,{email:'free@example.com',plan:'free',planStatus:'none'}));await backfill(f.t);
  const {createdAt,...row}=employee(f.ids.user,f.ids.business,11);
  await expect(f.owner.mutation(api.employees.create,row)).rejects.toThrow('PLAN_LIMIT_REACHED');
  expect((await f.owner.query(api.usage.getMonthlyUsage,{})).employeeCount).toBe(10);
 });
 it('cancels a reminder job when disabled, including callbacks already queued',async()=>{
  const f=await fixture(1,0);const {id}=await f.t.mutation(api.reminders.createReminderForCayla,{userId:f.ids.user,type:'custom',title:'Reminder',frequency:'once',scheduledTime:'12:01',timezone:'UTC',fireOnceAt:Date.now()+60000});
  const first=await f.t.run(ctx=>ctx.db.get(id as Id<'reminders'>));expect(first.scheduledFunctionId).toBeDefined();
  await f.t.mutation(api.reminders.updateReminderForCayla,{userId:f.ids.user,reminderId:id,patch:{enabled:false}});
  expect((await f.t.run(ctx=>ctx.db.system.get(first.scheduledFunctionId))).state.kind).toBe('canceled');
  await f.t.mutation(api.reminders.dispatchScheduled,{reminderId:id,scheduledFor:first.nextRunAt});expect(await f.t.run(ctx=>ctx.db.query('reminderOccurrences').collect())).toHaveLength(0);
 });
 it('supports the standard admin pagination contract and tenant-safe lightweight business selection',async()=>{
  const f=await fixture(10,1);
  const second=await f.t.run(async ctx=>{await ctx.db.patch(f.ids.business,{logo:'data:image/png;base64,'+'A'.repeat(5000)});return ctx.db.insert('businesses',{userId:f.ids.user,name:'Restricted client',currency:'TTD',currencySymbol:'$',updatedAt:Date.now()});});
  await f.t.run(ctx=>ctx.db.insert('accountantMemberships',{workspaceOwnerId:f.ids.user,memberUserId:f.ids.other,email:'other@example.com',role:'Viewer',clientIds:[String(f.ids.business)],allClients:false,canSendPayslips:false,status:'active',createdAt:Date.now(),updatedAt:Date.now()}));
  await backfill(f.t);
  const page=await f.owner.query(api.admin.listUsers,{requesterUid:'perf-owner',paginationOpts:{numItems:1,cursor:null}});expect(page.page).toEqual(page.users);expect(page.isDone).toBe(false);
  const found=await f.owner.query(api.admin.listUsers,{requesterUid:'perf-owner',search:'surebook',paginationOpts:{numItems:10,cursor:null}});expect(found.page).toHaveLength(1);expect(found.page[0].employeeCount).toBe(10);
  const selector=await f.other.query(api.businesses.listAccessibleSummaries,{userId:f.ids.other});expect(selector.map((r:any)=>r._id)).toEqual([f.ids.business]);expect(selector[0].logo).toBeUndefined();
  expect((await f.other.query(api.businesses.getAccessibleDetail,{businessId:f.ids.business})).logo).toContain('data:image');
  await expect(f.other.query(api.businesses.getAccessibleDetail,{businessId:second})).rejects.toThrow('CLIENT_ACCESS_DENIED');
 });
 it('all production mutation constructors enforce summaries except explicit raw migration/schedule helpers',()=>{
  for(const file of readdirSync('convex').filter(f=>f.endsWith('.ts')&&!['functions.ts','performanceMigration.ts','social.ts'].includes(f))){const source=readFileSync(`convex/${file}`,'utf8');expect(source, file).not.toMatch(/import\s*\{[^}]*\b(?:mutation|internalMutation)\b[^}]*\}\s*from\s*["']\.\/_generated\/server/);}
 });
});

describe('repeatable selected-account read measurements',()=>{
 for(const [label,employees,runs,notifications] of [['one client',10,10,30],['large employee list',500,10,0],['extensive history',10,1000,0],['large notification history',1,1,1000]] as const)it(label,async()=>{
  const f=await fixture(employees,runs,notifications);
  const before=await measure(f.owner,getMonthlyUsage,{}),historyBefore=await measure(f.owner,getByBusiness,{businessId:f.ids.business});
  const noticesBefore=notifications?await measure(f.owner,listForCurrentUser,{limit:100}):null;
  await backfill(f.t);
  const after=await measure(f.owner,getMonthlyUsage,{}),historyAfter=await measure(f.owner,recentSummaries,{businessId:f.ids.business});
  const noticesAfter=notifications?await measure(f.owner,unreadPreview,{}):null;
  expect(after.result).toEqual(before.result);expect(historyAfter.result.length).toBeLessThanOrEqual(8);expect(JSON.stringify(historyAfter.result)).not.toContain('employeesSnapshot');
  if(employees>=100)expect(after.documentsRead).toBeLessThan(before.documentsRead/5);
  if(runs>=100)expect(historyAfter.documentsRead).toBeLessThan(historyBefore.documentsRead/20);
  if(noticesAfter)expect(noticesAfter.documentsRead).toBeLessThan(noticesBefore!.documentsRead/2);
  const strip=({result,...metrics}:any)=>metrics;
  measurements.push({label,employees,runs,notifications,usage:{before:strip(before),after:strip(after)},payroll:{before:strip(historyBefore),after:strip(historyAfter)},notificationsRead:noticesBefore?{before:strip(noticesBefore),after:strip(noticesAfter)}:undefined});
 },30000);
});

describe('multi-account fixtures',()=>{
 for(const accountants of [10,100])it(`${accountants} accountants with three clients each`,async()=>{
  const f=await fixture(10,10);
  for(let i=1;i<accountants;i++)await f.t.run(async ctx=>{
   const user=await ctx.db.insert('users',{firebaseUid:`scale-${i}`,email:`scale${i}@example.com`,accountType:'accountant',plan:'accountant_monthly',planStatus:'active',createdAt:Date.now()});
   for(let c=0;c<3;c++){
    const business=await ctx.db.insert('businesses',{userId:user,name:`Client ${i}-${c}`,currency:'TTD',currencySymbol:'$',updatedAt:Date.now()});
    const rows=[];for(let e=0;e<2;e++){const id=await ctx.db.insert('employees',employee(user,business,e));rows.push(await ctx.db.get(id));}
    for(let r=0;r<3;r++)await ctx.db.insert('payrollRuns',{businessId:business,userId:user,month:'November',year:2026,status:'completed',employeesSnapshot:rows,totalGross:200,totalNet:200,totalPaye:0,totalNis:0,totalHealthSurcharge:0,totalDeductions:0,createdAt:Date.now(),updatedAt:Date.now()});
   }
  });
  const before=await measure(f.owner,getOverview,{requesterUid:'perf-owner'});
  await backfill(f.t);
  const after=await measure(f.owner,getOverview,{requesterUid:'perf-owner'});
  expect(after.result.totals.totalUsers).toBe(before.result.totals.totalUsers);
  expect(after.result.totals.payrollsProcessed).toBe(before.result.totals.payrollsProcessed);
  expect(after.result.totals.totalEmployees).toBe(before.result.totals.totalEmployees);
  expect(after.documentsRead).toBeLessThan(before.documentsRead/5);
  const strip=({result,...metrics}:any)=>metrics;measurements.push({label:`${accountants} accountants`,admin:{before:strip(before),after:strip(after)}});
 },60000);
 it('does no post-table work when no social settings exist',async()=>{const t=convexTest(schema,modules);await t.mutation(api.social.tick,{});expect(await t.run(ctx=>ctx.db.system.query('_scheduled_functions').collect())).toHaveLength(0);});
});

describe('bulk recipient processing',()=>{
 it('selects queued recipients with bounded reads and maintains exact progress without rescanning the batch',async()=>{
  const f=await fixture(250,1);
  const jobId=await f.t.run(async ctx=>{
    const storageId=await ctx.storage.store(new Blob(['%PDF-fixture'],{type:'application/pdf'}));
    const job=await ctx.db.insert('bulkEmailJobs',{workspaceOwnerId:f.ids.user,requestedByUserId:f.ids.user,businessId:f.ids.business,payrollRunId:f.runIds[0],status:'queued',subject:'Payslips',message:'Attached',employeeCount:250,sentCount:0,failedCount:0,idempotencyKey:'fixture-job',createdAt:Date.now(),updatedAt:Date.now()});
    for(let i=0;i<250;i++)await ctx.db.insert('bulkEmailRecipients',{jobId:job,workspaceOwnerId:f.ids.user,businessId:f.ids.business,payrollRunId:f.runIds[0],employeeId:f.employeesIds[i],employeeName:`Employee ${i}`,recipient:`e${i}@example.com`,storageId,filename:'payslip.pdf',status:'queued',attemptCount:0,idempotencyKey:`fixture:${i}`,createdAt:Date.now()});
    return job;
  });
  const before=await measure(f.owner,{_handler:async(ctx:any,a:any)=>{const job=await ctx.db.get(a.jobId);const rows=await ctx.db.query('bulkEmailRecipients').withIndex('by_job',(q:any)=>q.eq('jobId',a.jobId)).collect();return {job,recipient:rows.find((r:any)=>r.status==='queued')};}},{jobId});
  await backfill(f.t);
  const after=await measure(f.owner,takeQueued,{jobId},true);expect(after.result.recipient).toBeTruthy();expect(after.documentsRead).toBeLessThan(before.documentsRead/5);
  const recipientId=after.result.recipient._id;
  await f.t.mutation(api.bulkPayslipEmail.updateRecipient,{recipientId,status:'sent',resendMessageId:'provider-once'});
  await f.t.mutation(api.bulkPayslipEmail.updateRecipient,{recipientId,status:'sent',resendMessageId:'provider-once'});
  const finish=await measure(f.owner,finishBatch,{jobId},true);
  expect(finish.documentsRead).toBeLessThan(10);
  expect(await f.t.run(ctx=>ctx.db.get(jobId))).toMatchObject({sentCount:1,failedCount:0,status:'sending'});
  expect((await f.owner.query(api.usage.getMonthlyUsage,{})).payslipEmailsUsed).toBe(1);
  const strip=({result,...metrics}:any)=>metrics;measurements.push({label:'250 bulk recipients',queue:{before:strip(before),after:strip(after)},finish:strip(finish)});
 },30000);
});
