import { query, mutation, internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { getActor, getAccessibleBusinesses, requireBusinessAccess, recordAccountantActivity } from './lib/accountantAccess';
import { reserveUsage, assertWithinLimit, historyAccessible } from './usage';
import { calculateStatutoryForBusiness } from './countryPayroll';
import { savePreparedCaylaPayroll } from './payrollRuns';
import { createDashboardReminder, listDashboardReminders, zonedTimeToUtc } from './reminders';
import { intentValidator, preferenceValidator, contextValidator } from './caylaAgentSchema';
import { createWorkspaceNotification } from './notifications';
import { DAY, DEFAULT_PREFERENCES, employeeExceptions, fingerprint, localDate, validDate, validateIntent, validatePeriod } from './lib/caylaAgentPolicy';
import {diagnostics} from './lib/caylaReasoning';
import { accountantGrossEarnings } from '../shared/accountantEarnings';

async function workspace(ctx: any, businessId: any, capability: any = 'read') {
  const business = await ctx.db.get(businessId);
  const access = await requireBusinessAccess(ctx, business, capability);
  const clients = (await getAccessibleBusinesses(ctx, access.actor._id)).filter((b: any) => b.userId === access.owner._id);
  return { ...access, business, clients };
}
async function ownedCommand(ctx: any, commandId: any) {
  const command = await ctx.db.get(commandId);
  if (!command) throw new Error('Command not found.');
  const access = await workspace(ctx, command.contextBusinessId);
  if (command.actorId !== access.actor._id || command.workspaceOwnerId !== access.owner._id) throw new Error('Forbidden');
  for (const id of command.clientIds) if (!access.clients.some((b: any) => b._id === id)) throw new Error('CLIENT_ACCESS_DENIED');
  return { ...access, command };
}
async function event(ctx: any, access: any, name: string, count?: number) {
  const stage:Record<string,string>={cayla_command_started:'CONTEXT_LOADING',cayla_payroll_prepared:'REVIEW_CREATED',cayla_payroll_approved:'ACTION_EXECUTED',cayla_review_cancelled:'ACTION_EXECUTED',cayla_command_failed:'ERROR'};
  if(stage[name])diagnostics(access.command?.requestKey||String(access.command?._id||''),stage[name],{actorId:access.actor._id,workspaceId:access.owner._id,event:name,count});
  await ctx.db.insert('caylaEvents', { actorId: access.actor._id, workspaceOwnerId: access.owner._id, commandId: access.command?._id, name, count, createdAt: Date.now() });
}
async function roster(ctx: any, businessId: any) {
  const all = await ctx.db.query('employees').withIndex('by_business', (q: any) => q.eq('businessId', businessId)).collect();
  const real = all.filter((e: any) => !e.isDemo);
  return (real.length ? real : all).filter((e: any) => !['inactive', 'deleted'].includes(String(e.status || '').toLowerCase()));
}
async function source(ctx: any, business: any) {
  const employees = await roster(ctx, business._id);
  const overrides = await ctx.db.query('businessStatutoryOverrides').withIndex('by_business', (q: any) => q.eq('businessId', business._id)).collect();
  const rules = business.countryCode ? await ctx.db.query('statutoryRuleSets').withIndex('by_country_year', (q: any) => q.eq('countryCode', business.countryCode)).collect() : [];
  const previous = await ctx.db.query('payrollRuns').withIndex('by_business', (q: any) => q.eq('businessId', business._id)).order('desc').first();
  return { employees, previous, fingerprint: await fingerprint({ business, employees, overrides, rules, previous }) };
}
const steps = ['Load clients', 'Check employee data', 'Calculate earnings', 'Calculate statutory deductions', 'Check payroll exceptions', 'Prepare review'];
const planSteps = (action: string) => action === 'reminder' ? ['Load clients', 'Check payroll dates', 'Prepare reminder review'] : steps;
const progressCounts = (clients: any[]) => [clients.length, clients.reduce((n, b) => n + b.processed, 0), clients.reduce((n, b) => n + (b.earningsCalculated || 0), 0), clients.reduce((n, b) => n + (b.statutoryCalculated || 0), 0), clients.reduce((n, b) => n + b.processed, 0), clients.reduce((n, b) => n + b.processed, 0)];
const safeSnapshot = (e: any) => Object.fromEntries(Object.entries(e).filter(([key]) => !['statutoryData', 'avatar', '_creationTime'].includes(key)));
export const brief = query({
  args: { businessId: v.id('businesses'), timezone: v.string() },
  handler: async (ctx, args) => {
    const access = await workspace(ctx, args.businessId);
    const today = localDate(Date.now(), args.timezone), through = new Date(Date.parse(today) + 6 * DAY).toISOString().slice(0, 10);
    const clients = [];
    for (const b of access.clients) {
      const employees = await roster(ctx, b._id);
      const issues = employees.map((e: any) => employeeExceptions(e, employees));
      clients.push({ id: b._id, name: b.name, payDate: b.plannedPayDate || '', employeeCount: employees.length,
        reviewCount: issues.filter((r: any[]) => r.some(i => i.severity !== 'INFO')).length,
        missingHours: issues.filter((r: any[]) => r.some(i => i.code === 'missing_hours')).length,
        due: !!b.plannedPayDate && b.plannedPayDate >= today && b.plannedPayDate <= through });
    }
    const due = clients.filter(c => c.due);
    return { clients, due, unscheduled: clients.filter(c => !c.payDate).length,
      suggestions: [due.length ? 'Prepare payroll for clients due this week' : 'Prepare payroll for this client',
        clients.some(c => c.missingHours) ? 'Who is missing hours?' : 'Review payroll exceptions',
        'Generate ready payslips', 'Show clients waiting for payroll', 'Set payroll reminders'] };
  },
});
export const interpreterContext = internalQuery({
  args: { commandId: v.id('caylaCommands'), timezone: v.string() },
  handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId);
    return { today: localDate(Date.now(), args.timezone), currentClientId: access.business._id, context: access.command.context || { view: 'Dashboard' },
      clients: access.clients.map((b: any) => ({ id: b._id, name: b.name.slice(0, 120), payDate: b.plannedPayDate || null })) };
  },
});
export const beginRequest = internalMutation({
  args: { businessId: v.id('businesses'), requestKey: v.string(), timezone: v.string(), context: v.optional(contextValidator), source: v.union(v.literal('text'), v.literal('voice')) },
  handler: async (ctx, args) => {
    const access = await workspace(ctx, args.businessId);
    localDate(Date.now(), args.timezone);
    if (args.context) {
      if (!['Dashboard','Clients','Employees','Bulk Payslips','Payroll','Payslips','Reports','Reminders','Tax & Compliance','Settings','Team','Activity','Profile','Subscription'].includes(args.context.view)) throw new Error('Invalid dashboard context.');
      if (args.context.payrollRunId) {
        const run = await ctx.db.get(args.context.payrollRunId);
        if (!run || run.businessId !== args.businessId || !historyAccessible(access.owner, run.createdAt)) throw new Error('Payroll context access denied.');
      }
      if (args.context.employeeId) {
        const employee = await ctx.db.get(args.context.employeeId);
        if (!employee || employee.businessId !== args.businessId) throw new Error('Employee context access denied.');
      }
    }
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestKey)) throw new Error('Invalid command request key.');
    const prior = await ctx.db.query('caylaCommands').withIndex('by_request', (q: any) => q.eq('actorId', access.actor._id).eq('requestKey', args.requestKey)).first();
    if (prior) {
      if (prior.contextBusinessId !== args.businessId || prior.workspaceOwnerId !== access.owner._id) throw new Error('Request key is already in use in another context.');
      if (prior.status === 'error' && !prior.intent || prior.status === 'understanding' && Date.now() - prior.updatedAt > 60000) {
        await ctx.db.patch(prior._id, { status: 'understanding', summary: 'Understanding your request…', updatedAt: Date.now(), expiresAt: Date.now() + DAY });
        return { commandId: prior._id, duplicate: false };
      }
      return { commandId: prior._id, duplicate: true };
    }
    await reserveUsage(ctx, access.owner._id, 'cayla', `agent:${access.actor._id}:${args.requestKey}`);
    const now = Date.now();
    const commandId = await ctx.db.insert('caylaCommands', { actorId: access.actor._id, workspaceOwnerId: access.owner._id,
      contextBusinessId: args.businessId, requestKey: args.requestKey, source: args.source,
      timezone: args.timezone, ...(args.context ? { context: args.context } : {}), command: 'Payroll instruction', clientIds: [], status: 'understanding', approvalStatus: 'not_requested',
      summary: 'Understanding your request…', steps: [], createdAt: now, updatedAt: now, expiresAt: now + DAY });
    await event(ctx, { ...access, command: { _id: commandId } }, 'cayla_command_started');
    if (args.source === 'voice') await event(ctx, { ...access, command: { _id: commandId } }, 'cayla_voice_command_started');
    return { commandId, duplicate: false };
  },
});
export const savePlan = internalMutation({
  args: { commandId: v.id('caylaCommands'), intent: intentValidator },
  handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId), { command } = access;
    if (command.status !== 'understanding') return command._id;
    const intent = validateIntent(args.intent, access.clients.map((b: any) => String(b._id)));
    let clients = intent.clientIds.length ? access.clients.filter((b: any) => intent.clientIds.includes(b._id)) : intent.scope === 'current' ? [access.business] : access.clients;
    if (intent.scope === 'due') clients = clients.filter((b: any) => b.plannedPayDate && b.plannedPayDate >= intent.dueFrom && b.plannedPayDate <= intent.dueTo);
    const clientIds = clients.map((b: any) => b._id);
    if (intent.target === 'employee' && !command.context?.employeeId || intent.target === 'run' && !command.context?.payrollRunId) throw new Error('Select the requested record in Sheetpay first.');
    if (intent.target && intent.target !== 'client') {
      if (!['exceptions','history','report','tax','emails'].includes(intent.action) || intent.target === 'employee' && intent.action === 'emails') throw new Error('Use the existing employee or payroll review screen for this operation.');
      if (intent.scope !== 'current' || intent.clientIds.some((id: any) => id !== command.contextBusinessId)) throw new Error('Context belongs to the selected client.');
      clients = [access.business];
    }
    const writeAction = ['prepare', 'payslips', 'emails', 'reminder', 'exports'].includes(intent.action);
    if (writeAction) for (const b of clients) await requireBusinessAccess(ctx, b, intent.action === 'exports' ? 'read' : intent.action === 'emails' ? 'sendPayslips' : 'runPayroll');
    for (const employeeId of [...(intent.excludedEmployeeIds || []), ...(intent.acknowledgedEmployeeIds || []), ...(intent.adjustments || []).map((a:any)=>a.employeeId)]) {
      const employee:any=await ctx.db.get(employeeId);
      if (!employee || !clientIds.includes(employee.businessId)) throw new Error('CLIENT_ACCESS_DENIED');
    }
    const counts = [];
    for (const b of clients) {
      const src = await source(ctx, b), employees = src.employees.filter((e:any)=>!intent.excludedEmployeeIds?.includes(e._id));
      const periodStart = intent.periodStart || b.plannedPeriodStart || '', periodEnd = intent.periodEnd || b.plannedPeriodEnd || '';
      const periodChanged = (intent.periodStart && intent.periodStart !== b.plannedPeriodStart) || (intent.periodEnd && intent.periodEnd !== b.plannedPeriodEnd);
      const payDate = intent.payDate || (!periodChanged ? b.plannedPayDate : '') || '';
      let status = 'planned';
      try { validatePeriod(periodStart, periodEnd, payDate); } catch { status = 'waiting'; }
      if (intent.action === 'reminder') status = intent.reminderDate && intent.reminderTime || payDate ? 'planned' : 'waiting';
      const record: any = { commandId: command._id, businessId: b._id, name: b.name, currency: b.currency,
        sourceFingerprint: src.fingerprint, periodStart, periodEnd, payDate, employeeIds: employees.map((e: any) => e._id),
        processed: 0, ready: 0, review: 0, blocking: 0, totalGross: 0, totalDeductions: 0, totalNet: 0, status, expiresAt: command.expiresAt };
      if (['emails','exports','payslips'].includes(intent.action)) {
        const runs = await ctx.db.query('payrollRuns').withIndex('by_business', (q: any) => q.eq('businessId', b._id)).order('desc').collect();
        const run = runs.find((r: any) => historyAccessible(access.owner, r.createdAt) && (intent.target !== 'run' || r._id === command.context?.payrollRunId) && (!intent.periodStart && !intent.periodEnd || r.employeesSnapshot.some((e: any) => e.payPeriodStart === intent.periodStart && e.payPeriodEnd === intent.periodEnd) ||
          intent.periodStart?.slice(0, 7) === intent.periodEnd?.slice(0, 7) && r.year === Number(intent.periodStart.slice(0, 4)) && r.month?.toLowerCase() === new Date(intent.periodStart + 'T12:00:00Z').toLocaleString('en', { month: 'long', timeZone: 'UTC' }).toLowerCase()));
        if (!run || !historyAccessible(access.owner, run.createdAt)) record.status = status;
        else { record.runId = run._id; record.status = intent.action==='emails'?'review':'approved'; record.ready = run.employeesSnapshot.filter((e: any) => e.email && e.grossPay > 0).length; }
      }
      if (writeAction) await ctx.db.insert('caylaPreparedClients', record);
      counts.push(employees.length);
    }
    const total = counts.reduce((a, b) => a + b, 0);
    const labels: Record<string, string> = { upcoming: 'View upcoming payroll', exceptions: 'Review payroll exceptions', prepare: 'Prepare payroll', payslips: 'Prepare ready payslips', emails: 'Prepare payslip email batches', reminder: 'Prepare payroll reminders', reminders: 'View payroll reminders', history: 'View payroll history', report: 'View payroll reports', tax: 'View yearly tax forms', exports:'Payslips ready', help: 'Payroll guidance' };
    const records = await ctx.db.query('caylaPreparedClients').withIndex('by_command', (q: any) => q.eq('commandId', command._id)).collect();
    const waiting = records.some((r: any) => r.status === 'waiting');
    const status = intent.action==='exports' ? 'complete' : intent.clarification ? 'waiting' : !writeAction ? 'complete' : !clientIds.length ? 'complete' : ['emails','exports','payslips'].includes(intent.action) && !waiting && records.every((r: any) => r.runId) ? (intent.action==='emails'?'review':'complete') : waiting ? 'waiting' : 'planned';
    const summary = intent.action==='exports' && records.every((r:any)=>!r.runId) ? 'No finalized payslips match this period. Prepare and approve payroll first.' : intent.clarification ? intent.clarification : !clientIds.length ? 'No clients match this request. Clients without a saved payday are not included in due-date commands.' : waiting ? 'Choose the missing payroll dates or review the client’s saved payroll before continuing.' : `${clientIds.length} clients · ${total} employees. ${writeAction ? 'Review the plan before continuing.' : 'Results come from your saved records.'}`;
    await ctx.db.patch(command._id, { intent, command: labels[intent.action], clientIds, status, summary,
      steps: writeAction ? planSteps(intent.action).map((label, i) => ({ label, status: i === 0 ? 'complete' : 'pending', ...(i === 0 ? { count: clientIds.length } : {}) })) : [], updatedAt: Date.now() });
    if (status === 'complete') await event(ctx, access, 'cayla_command_completed', total);
    await recordAccountantActivity(ctx, access.owner._id, access.actor._id, 'cayla.plan_created', access.business._id, { commandId: command._id, actionType: intent.action, clientCount: clientIds.length, employeeCount: total });
    return {commandId:command._id,status};
  },
});
export const requestFailure = internalMutation({
  args: { commandId: v.id('caylaCommands') }, handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId);
    if (access.command.status !== 'understanding') return;
    await ctx.db.patch(args.commandId, { status: 'error', summary: "Cayla couldn't complete that request. No payroll changes were finalized. Please try again.", updatedAt: Date.now() });
    await event(ctx, access, 'cayla_command_failed');
  },
});
export const setDates = mutation({
  args: { commandId: v.id('caylaCommands'), businessId: v.id('businesses'), periodStart: v.string(), periodEnd: v.string(), payDate: v.string() },
  handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId);
    if (!['planned', 'waiting'].includes(access.command.status) || !access.command.clientIds.includes(args.businessId)) throw new Error('This plan cannot be edited.');
    await requireBusinessAccess(ctx, await ctx.db.get(args.businessId), 'runPayroll');
    validatePeriod(args.periodStart, args.periodEnd, args.payDate);
    const clients = await ctx.db.query('caylaPreparedClients').withIndex('by_command', (q: any) => q.eq('commandId', args.commandId)).collect();
    const client = clients.find((b: any) => b.businessId === args.businessId);
    if (!client) throw new Error('Client not found in this plan.');
    await ctx.db.patch(client._id, { periodStart: args.periodStart, periodEnd: args.periodEnd, payDate: args.payDate, status: 'planned' });
    if (clients.every((b: any) => b._id === client._id || b.status !== 'waiting')) await ctx.db.patch(args.commandId, { status: 'planned', summary: 'Dates are ready. Review the plan and prepare payroll.', updatedAt: Date.now() });
  },
});
export const startPreparation = internalMutation({
  args: { commandId: v.id('caylaCommands'), token: v.string() }, handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId), c = access.command;
    if (c.expiresAt < Date.now()) throw new Error('This plan expired. Create a new command.');
    if (c.status === 'review' || c.status === 'complete') return { done: true };
    if (c.status === 'working' && c.leaseUntil > Date.now()) return { done: true };
    if (!['planned', 'error', 'working'].includes(c.status) || !['prepare', 'payslips', 'emails', 'reminder'].includes(c.intent?.action)) throw new Error('Review the plan and dates first.');
    for (const id of c.clientIds) await requireBusinessAccess(ctx, await ctx.db.get(id), 'runPayroll');
    const clients = await ctx.db.query('caylaPreparedClients').withIndex('by_command', (q: any) => q.eq('commandId', args.commandId)).collect();
    if (clients.some((r: any) => r.status === 'waiting' || r.status === 'stale')) throw new Error('This plan needs new payroll data or dates. Start a new command.');
    await ctx.db.patch(c._id, { status: 'working', leaseToken: args.token, leaseUntil: Date.now() + 90000, summary: 'Cayla is preparing your review…', updatedAt: Date.now() });
    return { done: false };
  },
});
export const prepareBatch = internalMutation({
  args: { commandId: v.id('caylaCommands'), token: v.string() }, handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId), c = access.command;
    if (c.status !== 'working' || c.leaseToken !== args.token) throw new Error('Preparation is no longer active.');
    const clients = await ctx.db.query('caylaPreparedClients').withIndex('by_command', (q: any) => q.eq('commandId', c._id)).collect();
    const client = clients.find((b: any) => !['review', 'approved', 'stale'].includes(b.status));
    if (!client) {
      const ready = clients.reduce((n: number, b: any) => n + b.ready, 0), review = clients.reduce((n: number, b: any) => n + b.review, 0), blocked = clients.reduce((n: number, b: any) => n + b.blocking, 0);
      await ctx.db.patch(c._id, { status: 'review', approvalStatus: 'pending', summary: c.intent.action === 'reminder' ? `${clients.length} reminders are ready for review.` : `Payroll prepared: ${ready} ready · ${review} need review · ${blocked} blocked.`, steps: planSteps(c.intent.action).map((label, i) => ({ label, status: 'complete', count: c.intent.action === 'reminder' ? clients.length : progressCounts(clients)[i] })), leaseUntil: 0, updatedAt: Date.now() });
      await event(ctx, access, 'cayla_payroll_prepared', ready + review + blocked);
      for (const prepared of clients) await recordAccountantActivity(ctx, access.owner._id, access.actor._id, c.intent.action === 'reminder' ? 'cayla.reminder_prepared' : 'cayla.payroll_prepared', prepared.businessId, { commandId: c._id, employeeCount: prepared.processed, readyCount: prepared.ready, reviewCount: prepared.review, blockedCount: prepared.blocking });
      if (review + blocked) await event(ctx, access, 'cayla_exception_found', review + blocked);
      return { done: true };
    }
    const b = await ctx.db.get(client.businessId);
    await requireBusinessAccess(ctx, b, 'runPayroll');
    const src = await source(ctx, b);
    if (src.fingerprint !== client.sourceFingerprint) {
      await ctx.db.patch(client._id, { status: 'stale' });
      await ctx.db.patch(c._id, { status: 'error', summary: 'Client, employee or statutory data changed. Create a new plan before approving payroll.', leaseUntil: 0, updatedAt: Date.now() });
      return { done: true };
    }
    if (c.intent.action === 'reminder') {
      await ctx.db.patch(client._id, { status: 'review' });
      return { done: false };
    }
    validatePeriod(client.periodStart, client.periodEnd, client.payDate);
    const chunk = client.employeeIds.slice(client.processed, client.processed + 40);
    let earningsCalculated = client.earningsCalculated || 0, statutoryCalculated = client.statutoryCalculated || 0;
    let ready = client.ready, review = client.review, blocking = client.blocking, gross = client.totalGross, deductions = client.totalDeductions, net = client.totalNet;
    for (const id of chunk) {
      const original = src.employees.find((row: any) => row._id === id);
      const e = original ? { ...original } : null;
      for (const adjustment of c.intent.adjustments || []) if (adjustment.employeeId === id && e) e[adjustment.field] = adjustment.value;
      if (!e || e.businessId !== b._id) throw new Error('Employee is outside this client.');
      const previous = historyAccessible(access.owner, src.previous?.createdAt || 0) ? src.previous?.employeesSnapshot.find((row: any) => row._id === id) : undefined;
      const exceptions = employeeExceptions(e, src.employees, previous).filter(issue=>issue.code!=='high_overtime' || !c.intent.acknowledgedEmployeeIds?.includes(id));
      if (c.intent.overtimeThreshold != null && e.overtimeHours > c.intent.overtimeThreshold && !c.intent.acknowledgedEmployeeIds?.includes(id) && !exceptions.some(i=>i.code==='high_overtime')) exceptions.push({code:'high_overtime',severity:'REVIEW',message:`Overtime exceeds your ${c.intent.overtimeThreshold} hour review threshold.`});
      let snapshot: any;
      let stage = 'earnings';
      if (!exceptions.some(i => i.severity === 'BLOCKING')) {
        try {
          const base = e.payType === 'hourly' ? e.regularHours * e.hourlyRate : e.basicPay;
          const grossPay = Number(accountantGrossEarnings({ ...e, basicPay: base }).toFixed(2));
          if (!Number.isFinite(grossPay) || grossPay <= 0) throw new Error('Invalid calculated earnings');
          earningsCalculated++;
          stage = 'statutory';
          const result = await calculateStatutoryForBusiness(ctx, b, { grossIncome: grossPay, frequency: e.payFrequency,
            payDate: client.payDate, payPeriodStart: client.periodStart, payPeriodEnd: client.periodEnd, otherDeductions: e.otherDeductions });
          if (!result.supported) exceptions.push({ code: 'statutory_unavailable', severity: 'BLOCKING', message: 'Automatic statutory calculations are unavailable for this country or tax year. Review the existing statutory settings.' });
          else {
            if (![result.grossPay, result.netPay, result.totalDeductions].every(Number.isFinite)) throw new Error('Invalid statutory result');
            statutoryCalculated++;
            const value = (key: string) => result.statutoryDeductions.filter((d: any) => d.key === key).reduce((n: number, d: any) => n + d.amount, 0);
            snapshot = { ...safeSnapshot(e), basicPay: base, grossPay: result.grossPay, netPay: result.netPay,
              paye: value('paye') + value('income_tax'), nis: value('nis') + value('nic') + value('social_security'), healthSurcharge: value('health_surcharge'),
              periodLabel: `${client.periodStart} to ${client.periodEnd}`, payDate: client.payDate, payPeriodStart: client.periodStart, payPeriodEnd: client.periodEnd,
              statutoryData: { items: result.statutoryDeductions.map((d: any) => ({ label: d.label, amount: d.amount })), breakdown: result.calculationBreakdown, ruleVersion: result.ruleVersion, source: result.source } };
            if (snapshot.netPay < 0) exceptions.push({ code: 'negative_net', severity: 'BLOCKING', message: 'Deductions exceed calculated earnings.' });
          }
        } catch { exceptions.push({ code: stage === 'earnings' ? 'payroll_calculation_failure' : 'statutory_calculation_failure', severity: 'BLOCKING', message: stage === 'earnings' ? 'Earnings calculation failed. Review this employee before continuing.' : 'Statutory calculation failed. Review this employee before continuing.' }); }
      }
      const status = exceptions.some(i => i.severity === 'BLOCKING') ? 'blocking' : exceptions.some(i => i.severity === 'REVIEW') ? 'review' : 'ready';
      if (status === 'ready') { ready++; gross += snapshot.grossPay; deductions += snapshot.grossPay - snapshot.netPay; net += snapshot.netPay; }
      else if (status === 'review') review++; else blocking++;
      await ctx.db.insert('caylaPreparedEmployees', { commandId: c._id, businessId: b._id, employeeId: e._id, ...(snapshot ? { snapshot } : {}), exceptions, status, expiresAt: c.expiresAt });
    }
    diagnostics(c.requestKey,'PAYROLL_CALCULATION',{actorId:access.actor._id,workspaceId:access.owner._id,earningsCalculated,statutoryCalculated});
    const processed = client.processed + chunk.length;
    await ctx.db.patch(client._id, { processed, earningsCalculated, statutoryCalculated, ready, review, blocking, totalGross: Number(gross.toFixed(2)), totalDeductions: Number(deductions.toFixed(2)), totalNet: Number(net.toFixed(2)), status: processed === client.employeeIds.length ? 'review' : 'working' });
    const total = clients.reduce((n: number, b: any) => n + (b._id === client._id ? processed : b.processed), 0);
    await ctx.db.patch(c._id, { leaseUntil: Date.now() + 90000, updatedAt: Date.now(), summary: `Checked ${total} employees. Preparing the remaining review…`, steps: steps.map((label, i) => ({ label, status: i === 0 ? 'complete' : 'working', count: progressCounts(clients.map((b: any) => b._id === client._id ? { ...b, processed, earningsCalculated, statutoryCalculated } : b))[i] })) });
    return { done: false };
  },
});
export const preparationFailure = internalMutation({
  args: { commandId: v.id('caylaCommands'), token: v.string() }, handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId);
    if (access.command.leaseToken !== args.token || access.command.status !== 'working') return;
    await ctx.db.patch(args.commandId, { status: 'error', summary: 'Preparation was interrupted. Completed checks are saved. Resume preparation or start a new command.', leaseUntil: 0, updatedAt: Date.now() });
    await event(ctx, access, 'cayla_command_failed');
  },
});
export const approveClient = mutation({
  args: { commandId: v.id('caylaCommands'), businessId: v.id('businesses') }, handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId), c = access.command;
    const clients = await ctx.db.query('caylaPreparedClients').withIndex('by_command', (q: any) => q.eq('commandId', c._id)).collect();
    const client = clients.find((b: any) => b.businessId === args.businessId);
    if (!client) throw new Error('Client not found in this plan.');
    const b = await ctx.db.get(client.businessId);
    await requireBusinessAccess(ctx, b, 'runPayroll');
    if (client.status === 'approved') return { runId: client.runId, reminderId: client.reminderId, duplicate: true };
    if (c.status !== 'review' || client.status !== 'review' || c.expiresAt < Date.now()) throw new Error('Prepare a current review before approval.');
    if ((await source(ctx, b)).fingerprint !== client.sourceFingerprint) throw new Error('Payroll data changed. Create a new plan before approving.');
    let runId, reminderId;
    if (c.intent.action === 'reminder') {
      const days = c.intent.daysBefore ?? 3;
      // Scheduled in-app/push notification, using the existing reminder validator and worker.
      const reminderDate = c.intent.reminderDate || new Date(Date.parse(client.payDate + 'T00:00:00Z') - days * DAY).toISOString().slice(0, 10);
      const [year, month, day] = reminderDate.split('-').map(Number);
      const scheduledTime = c.intent.reminderTime || '09:00';
      const [hour,minute]=scheduledTime.split(':').map(Number);
      const fireAt = zonedTimeToUtc(year, month, day, hour, minute, c.timezone);
      const result = await createDashboardReminder(ctx, { businessId: b._id, type: 'payroll', title: `${b.name} payroll`,
        frequency: 'once', scheduledAt: fireAt, scheduledTime, timezone: c.timezone,
        channels: ['in_app', 'push'], idempotencyKey: `cayla:${c._id}:${b._id}`, description: c.intent.reminderDate ? `Payroll reminder ${reminderDate} ${scheduledTime}` : `${days} days before payday ${client.payDate}` });
      reminderId = result.id;
    } else {
      const prepared = await ctx.db.query('caylaPreparedEmployees').withIndex('by_command_business', (q: any) => q.eq('commandId', c._id).eq('businessId', b._id)).collect();
      const rows = prepared.filter((e: any) => e.status === 'ready').map((e: any) => e.snapshot);
      if (!rows.length) throw new Error('There are no ready employees to approve. Review the exceptions first.');
      runId = await savePreparedCaylaPayroll(ctx, b._id, rows, { start: client.periodStart, end: client.periodEnd, payDate: client.payDate });
    }
    await ctx.db.patch(client._id, { status: 'approved', ...(runId ? { runId } : {}), ...(reminderId ? { reminderId } : {}), approvedAt: Date.now() });
    const done = clients.every((b: any) => b._id === client._id || b.status === 'approved');
    await ctx.db.patch(c._id, { status: done ? 'complete' : 'review', approvalStatus: done ? 'approved' : 'partial', updatedAt: Date.now(), summary: reminderId ? 'Approved reminder saved. Enable browser notifications to receive push alerts.' : 'Approved ready payroll saved. Payslip previews are available; download, print or review recipients before emailing.' });
    await event(ctx, access, 'cayla_payroll_approved', client.ready);
    const prefs = await ctx.db.query('caylaPreferences').withIndex('by_actor_workspace', (q: any) => q.eq('actorId', access.actor._id).eq('workspaceOwnerId', access.owner._id)).first();
    if (prefs?.settings.notifications !== false) await createWorkspaceNotification(ctx, { businessId: b._id, category: 'payroll', type: 'cayla_approval', title: reminderId ? 'Cayla reminder saved' : 'Cayla payroll approved', message: reminderId ? 'Your approved payroll reminder is saved.' : `${client.ready} ready employees approved; ${client.review + client.blocking} excluded for review.`, actionUrl: `/accountant?tab=Payroll&clientId=${b._id}`, dedupeKey: `cayla-approved:${c._id}:${b._id}`, channels: ['in_app'] });

    await recordAccountantActivity(ctx, access.owner._id, access.actor._id, reminderId ? 'cayla.reminder_saved' : 'cayla.payroll_approved', b._id, { commandId: c._id, runId, reminderId, employeeCount: client.ready, excludedCount: client.review + client.blocking });
    if (done) await event(ctx, access, 'cayla_command_completed', client.ready);
    return { runId, reminderId };
  },
});
export const getCommand = query({
  args: { commandId: v.id('caylaCommands') }, handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId), c = access.command;
    const clients = await ctx.db.query('caylaPreparedClients').withIndex('by_command', (q: any) => q.eq('commandId', c._id)).collect();
    const result = [];
    for (const client of clients) {
      const issues = await ctx.db.query('caylaPreparedEmployees').withIndex('by_command_business', (q: any) => q.eq('commandId', c._id).eq('businessId', client.businessId)).collect();
      const run = client.runId ? await ctx.db.get(client.runId) : null;
      const rosterRows=await roster(ctx,client.businessId);
      const changes=(c.intent?.adjustments||[]).filter((a:any)=>rosterRows.some((e:any)=>e._id===a.employeeId)).map((a:any)=>({name:rosterRows.find((e:any)=>e._id===a.employeeId)?.name,field:a.field,before:rosterRows.find((e:any)=>e._id===a.employeeId)?.[a.field]||0,after:a.value}));
      const excluded=rosterRows.filter((e:any)=>c.intent?.excludedEmployeeIds?.includes(e._id)).map((e:any)=>e.name);
      const readyRows=issues.filter((e:any)=>e.status==='ready');
      result.push({ ...client, preparedRows: issues.map((e: any) => ({ ...(e.snapshot || { name: rosterRows.find((row: any) => row._id === e.employeeId)?.name, employeeId: rosterRows.find((row: any) => row._id === e.employeeId)?.employeeId }), _id: e.employeeId, reviewStatus: e.status })), changes,excluded,totalPaye:readyRows.reduce((n:number,e:any)=>n+(e.snapshot?.paye||0),0),totalNis:readyRows.reduce((n:number,e:any)=>n+(e.snapshot?.nis||0),0), issues: issues.filter((e: any) => e.exceptions.length).map((e: any) => ({ employeeId: e.employeeId, status: e.status, name: e.snapshot?.name || '', exceptions: e.exceptions })),
        run: run && historyAccessible(access.owner, run.createdAt) ? run : null, business: await ctx.db.get(client.businessId) });
    }
    const readonly = [];
    const visibleReminders = c.intent?.action === 'reminders' ? await listDashboardReminders(ctx) : [];
    if (['upcoming', 'exceptions', 'history', 'report', 'tax', 'reminders'].includes(c.intent?.action)) for (const id of c.clientIds) {
      const b: any = await ctx.db.get(id), employees = await roster(ctx, id);
      const runs = await ctx.db.query('payrollRuns').withIndex('by_business', (q: any) => q.eq('businessId', id)).order('desc').take(12);
      const reminders = c.intent.action === 'reminders' ? visibleReminders.filter((r: any) => r.businessId === id).map((r: any) => ({ id: r._id, title: r.title, nextRunAt: r.nextRunAt, status: r.status, timezone: r.timezone })) : [];
      readonly.push({ reminders, id, name: b.name, payDate: b.plannedPayDate || '', employeeCount: employees.length,
        exceptions: c.intent.action === 'exceptions' ? employees.filter((e: any) => c.intent.target !== 'employee' || e._id === c.context?.employeeId).flatMap((e: any) => employeeExceptions(e, employees).filter(issue => !c.intent.exceptionFilter || issue.code === c.intent.exceptionFilter).map(issue => ({ employeeId: e._id, name: e.name, ...issue }))) : [],
        runs: ['history', 'report'].includes(c.intent.action) ? runs.filter((r: any) => historyAccessible(access.owner, r.createdAt) && (c.intent.target !== 'run' || r._id === c.context?.payrollRunId)).map((r: any) => ({ id: r._id, period: r.periodLabel, count: r.employeesSnapshot.length, gross: r.totalGross, net: r.totalNet, currency: b.currency, status: r.status })) : [] });
    }
    return { ...c, clients: result, readonly };
  },
});
// Client PDF rendering stays in the established exporter. This records only IDs/counts,
// after the browser reports a successful render; it cannot approve or change payroll.
export const recordPayslipExport = mutation({
  args: { commandId: v.id('caylaCommands'), businessId: v.id('businesses'), payrollRunId: v.id('payrollRuns'), employeeIds: v.array(v.id('employees')) },
  handler: async (ctx, args) => {
    const access = await ownedCommand(ctx, args.commandId);
    await requireBusinessAccess(ctx, await ctx.db.get(args.businessId), 'read');
    const plans = await ctx.db.query('caylaPreparedClients').withIndex('by_command', (q: any) => q.eq('commandId', args.commandId)).collect();
    const run = await ctx.db.get(args.payrollRunId);
    if (!run || run.businessId !== args.businessId || !historyAccessible(access.owner, run.createdAt) || !plans.some((p: any) => p.businessId === args.businessId && p.runId === run._id)) throw new Error('Payslip export is outside this Cayla review.');
    if (!args.employeeIds.length || new Set(args.employeeIds).size !== args.employeeIds.length || args.employeeIds.some(id => !run.employeesSnapshot.some((e: any) => e._id === id))) throw new Error('Invalid export employees.');
    await event(ctx, access, 'cayla_payslips_generated', args.employeeIds.length);
    await recordAccountantActivity(ctx, access.owner._id, access.actor._id, 'cayla.payslips_generated', args.businessId, { commandId: args.commandId, runId: args.payrollRunId, employeeCount: args.employeeIds.length });
  },
});
export const history = query({
  args: { businessId: v.id('businesses') }, handler: async (ctx, args) => {
    const access = await workspace(ctx, args.businessId);
    const commands = await ctx.db.query('caylaCommands').withIndex('by_actor_workspace', (q: any) => q.eq('actorId', access.actor._id).eq('workspaceOwnerId', access.owner._id)).order('desc').take(30);
    return commands.filter((c: any) => c.clientIds.every((id: any) => access.clients.some((b: any) => b._id === id))).map((c: any) => ({ id: c._id, command: c.command, timestamp: c.createdAt, clientIds: c.clientIds, actionType: c.intent?.action, status: c.status, approvalStatus: c.approvalStatus, summary: c.summary }));
  },
});
export const preferences = query({ args: { businessId: v.id('businesses') }, handler: async (ctx, args) => {
  const access = await workspace(ctx, args.businessId);
  const row = await ctx.db.query('caylaPreferences').withIndex('by_actor_workspace', (q: any) => q.eq('actorId', access.actor._id).eq('workspaceOwnerId', access.owner._id)).first();
  return row?.settings || DEFAULT_PREFERENCES;
} });
export const savePreferences = mutation({ args: { businessId: v.id('businesses'), settings: preferenceValidator }, handler: async (ctx, args) => {
  const access = await workspace(ctx, args.businessId);
  // Email approval is mandatory, even when a caller bypasses the preferences UI.
  const settings = { ...args.settings, requirePayslipApproval: true, requireEmailApproval: true };
  const row = await ctx.db.query('caylaPreferences').withIndex('by_actor_workspace', (q: any) => q.eq('actorId', access.actor._id).eq('workspaceOwnerId', access.owner._id)).first();
  if (row) await ctx.db.patch(row._id, { settings, updatedAt: Date.now() });
  else await ctx.db.insert('caylaPreferences', { actorId: access.actor._id, workspaceOwnerId: access.owner._id, settings, updatedAt: Date.now() });
  return settings;
} });
export const saveSchedule = mutation({ args: { businessId: v.id('businesses'), periodStart: v.string(), periodEnd: v.string(), payDate: v.string() }, handler: async (ctx, args) => {
  const access = await workspace(ctx, args.businessId, 'runPayroll');
  validatePeriod(args.periodStart, args.periodEnd, args.payDate);
  await ctx.db.patch(args.businessId, { plannedPeriodStart: args.periodStart, plannedPeriodEnd: args.periodEnd, plannedPayDate: args.payDate, updatedAt: Date.now() });
  await recordAccountantActivity(ctx, access.owner._id, access.actor._id, 'cayla.schedule_updated', args.businessId);
} });

/** Legacy Accountant chat keeps read-only advice, while operations use the command pipeline. */
export const isAccountant = internalQuery({ args: {}, handler: async ctx => { const { actor } = await getActor(ctx); return actor.accountType === 'accountant' || String(actor.plan || '').startsWith('accountant'); } });

// Structured, bounded session memory: no raw conversation or uploaded documents.
export const agentTool = internalQuery({
  args: { commandId: v.id('caylaCommands'), tool: v.string(), clientId: v.optional(v.string()), search: v.optional(v.string()), scope:v.optional(v.union(v.literal('current'),v.literal('all'))),periodStart:v.optional(v.string()),periodEnd:v.optional(v.string()) },
  handler: async (ctx, args): Promise<any> => {
    const access = await ownedCommand(ctx, args.commandId);
    const session = await ctx.db.query('caylaSessions').withIndex('by_actor_workspace', (q:any)=>q.eq('actorId',access.actor._id).eq('workspaceOwnerId',access.owner._id)).first();
    let active:any = null;
    if(session && Date.now()-session.updatedAt < DAY) {
      try { const old=await ownedCommand(ctx,session.activeCommandId); if(old.command.expiresAt>Date.now())active=old.command; } catch { /* Revoked access invalidates memory. */ }
    }
    if(args.tool==='get_workspace_context') return {
      actorId:access.actor._id,workspaceId:access.owner._id,currentClientId:access.business._id,country:access.business.countryCode,currency:access.business.currency,
      today:localDate(Date.now(),access.command.timezone),timezone:access.command.timezone,page:access.command.context?.view||'Dashboard',
      clients:access.clients.slice(0,100).map((b:any)=>({id:b._id,name:b.name,country:b.countryCode,currency:b.currency,payDate:b.plannedPayDate||null})),
      active:active ? {commandId:active._id,status:active.status,intent:active.intent,clientIds:active.clientIds} : null,
    };
    if(args.tool==='get_pending_payroll') {
      if(!active)return {active:false};
      const clients=await ctx.db.query('caylaPreparedClients').withIndex('by_command',(q:any)=>q.eq('commandId',active._id)).collect();
      const result=[];
      for(const client of clients){const rows=await ctx.db.query('caylaPreparedEmployees').withIndex('by_command_business',(q:any)=>q.eq('commandId',active._id).eq('businessId',client.businessId)).collect();result.push({clientId:client.businessId,name:client.name,periodStart:client.periodStart,periodEnd:client.periodEnd,currency:client.currency,gross:client.totalGross,net:client.totalNet,deductions:client.totalDeductions,ready:client.ready,review:client.review,blocked:client.blocking,issues:rows.filter((e:any)=>e.status!=='ready').slice(0,50).map((e:any)=>({employeeId:e.employeeId,name:e.snapshot?.name,overtimeHours:e.snapshot?.overtimeHours,exceptions:e.exceptions}))});}
      return {status:active.status,approvalStatus:active.approvalStatus,clients:result};
    }
    const query=(args.search||'').trim().toLowerCase();
    if(['list_clients','search_clients'].includes(args.tool))return access.clients.filter((b:any)=>!query||b.name.toLowerCase().includes(query)).slice(0,50).map((b:any)=>({id:b._id,name:b.name}));
    if(args.periodStart||args.periodEnd){if(!validDate(args.periodStart)||!validDate(args.periodEnd)||args.periodStart>args.periodEnd||Date.parse(args.periodEnd)-Date.parse(args.periodStart)>366*DAY)throw new Error('Invalid payroll date');}
    const ids=args.clientId ? [args.clientId] : args.scope==='all'?access.clients.map((b:any)=>b._id):active?.clientIds?.length ? active.clientIds : [access.business._id];
    if(ids.some((id:any)=>!access.clients.some((b:any)=>b._id===id)))throw new Error('CLIENT_ACCESS_DENIED');
    const output=[];
    for(const id of ids.slice(0,20)) {
      const business=access.clients.find((b:any)=>b._id===id);
      await requireBusinessAccess(ctx,business,'read');
      const employees=await roster(ctx,id);
      if(['list_employees','search_employees'].includes(args.tool)) { output.push({clientId:id,employees:employees.filter((e:any)=>!query||e.name.toLowerCase().includes(query)).slice(0,50).map((e:any)=>({id:e._id,name:e.name,payFrequency:e.payFrequency}))});continue; }
      if(args.tool==='list_payroll_attention_items'){output.push({clientId:id,name:business.name,issues:employees.flatMap((e:any)=>employeeExceptions(e,employees).map(issue=>({employeeId:e._id,name:e.name,...issue}))).slice(0,50)});continue;}
      if(!['get_payroll_summary','get_statutory_summary','compare_payroll_periods'].includes(args.tool))throw new Error('Unsupported read tool');
      const saved=(await ctx.db.query('payrollRuns').withIndex('by_business',(q:any)=>q.eq('businessId',id)).order('desc').take(101)).filter((r:any)=>historyAccessible(access.owner,r.createdAt));
      const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
      const matching=saved.filter((r:any)=>!args.periodStart||`${r.year}-${String(months.indexOf(r.month.toLowerCase())+1).padStart(2,'0')}`>=args.periodStart.slice(0,7)&&`${r.year}-${String(months.indexOf(r.month.toLowerCase())+1).padStart(2,'0')}`<=args.periodEnd!.slice(0,7));
      const runs=matching.slice(0,args.periodStart?100:args.tool==='compare_payroll_periods'?2:1);
      output.push({clientId:id,name:business.name,currency:business.currency,periodStart:args.periodStart,periodEnd:args.periodEnd,truncated:saved.length>100||ids.length>20,
        totals:{payrollRuns:runs.length,payslips:runs.reduce((n:number,r:any)=>n+r.employeesSnapshot.length,0),gross:runs.reduce((n:number,r:any)=>n+r.totalGross,0),net:runs.reduce((n:number,r:any)=>n+r.totalNet,0),paye:runs.reduce((n:number,r:any)=>n+r.totalPaye,0),nis:runs.reduce((n:number,r:any)=>n+r.totalNis,0)},
        runs:runs.slice(0,12).map((r:any)=>({id:r._id,period:r.periodLabel,employees:r.employeesSnapshot.length,gross:r.totalGross,net:r.totalNet,deductions:r.totalDeductions,paye:r.totalPaye,nis:r.totalNis,breakdowns:query?r.employeesSnapshot.filter((e:any)=>e.name.toLowerCase().includes(query)).slice(0,2).map((e:any)=>({name:e.name,gross:e.grossPay,net:e.netPay,statutory:e.statutoryData})):[]}))});
    }
    return output;
  },
});
export const resolveProposal = internalQuery({
  args: {commandId:v.id('caylaCommands'), proposal:v.any(), action:v.string(), followup:v.boolean()},
  handler:async(ctx,args):Promise<any>=>{
    const access=await ownedCommand(ctx,args.commandId);
    const session=await ctx.db.query('caylaSessions').withIndex('by_actor_workspace',(q:any)=>q.eq('actorId',access.actor._id).eq('workspaceOwnerId',access.owner._id)).first();
    let prior:any=null;
    if(args.followup&&session&&Date.now()-session.updatedAt<DAY){const old=await ownedCommand(ctx,session.activeCommandId);if(old.command.expiresAt>Date.now())prior=old.command;}
    if(args.followup&&!prior)return {clarification:'There is no active payroll proposal. Which client and payroll period do you mean?'};
    if(args.action==='review')return {commandId:prior._id};
    const p=args.proposal;
    const intent:any={...(prior?.intent||{}),action:args.action,scope:p.scope||prior?.intent?.scope||'current',clientIds:p.clientIds?.length?p.clientIds:prior?.clientIds||[]};
    for(const key of ['dueFrom','dueTo','periodStart','periodEnd','payDate','daysBefore','overtimeThreshold','reminderDate','reminderTime'])if(p[key]!=null)intent[key]=p[key];
    for(const key of ['target','exceptionFilter'])if(p[key]!=null)intent[key]=p[key];
    delete intent.clarification;
    validateIntent(intent,access.clients.map((b:any)=>String(b._id)));
    const clients=intent.clientIds.length?access.clients.filter((b:any)=>intent.clientIds.includes(b._id)):intent.scope==='current'?[access.business]:access.clients;
    const rows=[];for(const b of clients)rows.push(...await roster(ctx,b._id));
    const resolve=(name:string)=>{const exact=rows.filter((e:any)=>e.name.toLowerCase()===name.trim().toLowerCase());const matches=exact.length?exact:rows.filter((e:any)=>e.name.toLowerCase().split(/\s+/).includes(name.trim().toLowerCase()));return matches.length===1?matches[0]:null;};
    for(const [field,names] of [['excludedEmployeeIds',p.excludedEmployeeNames],['acknowledgedEmployeeIds',p.acknowledgedEmployeeNames]] as any){
      if(names?.length){const resolved=names.map(resolve);if(resolved.some((e:any)=>!e))return {clarification:'I could not uniquely identify that employee. Please give their full name and client.'};intent[field]=[...new Set([...(intent[field]||[]),...resolved.map((e:any)=>e._id)])];}
    }
    for(const a of p.adjustments||[]){const e=resolve(a.employeeName);if(!e)return {clarification:'I found an ambiguous or missing employee. Please give their full name and client.'};intent.adjustments=[...(intent.adjustments||[]).filter((old:any)=>old.employeeId!==e._id||old.field!==a.field),{employeeId:e._id,field:a.field,value:a.value}];}
    validateIntent(intent,access.clients.map((b:any)=>String(b._id)));
    return {intent};
  }
});
export const rememberSession = internalMutation({
  args:{commandId:v.id('caylaCommands'),reply:v.optional(v.string())},handler:async(ctx,args)=>{
    const access=await ownedCommand(ctx,args.commandId);
    if(args.reply)await ctx.db.patch(args.commandId,{reply:args.reply.slice(0,2000),replyExpiresAt:access.command.expiresAt});
    const key={actorId:access.actor._id,workspaceOwnerId:access.owner._id};
    const row=await ctx.db.query('caylaSessions').withIndex('by_actor_workspace',(q:any)=>q.eq('actorId',key.actorId).eq('workspaceOwnerId',key.workspaceOwnerId)).first();
    if(row && ['prepare','payslips','emails','reminder'].includes(access.command.intent?.action||'') && row.activeCommandId!==args.commandId){const previous:any=await ctx.db.get(row.activeCommandId);if(previous && ['planned','waiting','review','error'].includes(previous.status))await ctx.db.patch(previous._id,{status:'superseded',summary:'A newer payroll proposal replaced this review. Open the current Cayla work.',updatedAt:Date.now()});}
    if(row && !['prepare','payslips','emails','reminder'].includes(access.command.intent?.action||'')) return;
    if(row)await ctx.db.patch(row._id,{activeCommandId:args.commandId,updatedAt:Date.now()});else await ctx.db.insert('caylaSessions',{...key,activeCommandId:args.commandId,updatedAt:Date.now()});
  }
});
export const voiceContext = internalQuery({args:{businessId:v.id('businesses')},handler:async(ctx,args)=>{
  const access=await workspace(ctx,args.businessId);
  const employees=await roster(ctx,access.business._id);
  return {country:access.business.countryCode,currency:access.business.currency,names:[...access.clients.slice(0,20).map((b:any)=>b.name),...employees.slice(0,30).map((e:any)=>e.name)]};
}});
export const startVoice = internalMutation({args:{commandId:v.id('caylaCommands')},handler:async(ctx,args):Promise<any>=>{
  const access=await ownedCommand(ctx,args.commandId),c=access.command;
  if(c.expiresAt<Date.now()||['understanding','working'].includes(c.status))throw new Error('Voice result is not ready');
  const prefs=await ctx.db.query('caylaPreferences').withIndex('by_actor_workspace',(q:any)=>q.eq('actorId',access.actor._id).eq('workspaceOwnerId',access.owner._id)).first();
  if(prefs?.settings.voicePlayback===false)return {disabled:true};
  const text=(c.reply||c.summary).slice(0,800),key=await fingerprint({text,status:c.status});
  if(c.voiceKey===key&&c.voiceStorageId)return {storageId:c.voiceStorageId,key};
  if(c.voiceLeaseUntil>Date.now())return {busy:true};
  await reserveUsage(ctx,access.owner._id,'cayla',`cayla-voice:${c._id}:${key}`);
  if(c.voiceStorageId)await ctx.storage.delete(c.voiceStorageId);
  await ctx.db.patch(c._id,{voiceKey:key,voiceLeaseUntil:Date.now()+35000,voiceStorageId:undefined,voiceExpiresAt:c.expiresAt});
  return {text,key};
}});
export const finishVoice = internalMutation({args:{commandId:v.id('caylaCommands'),key:v.string(),storageId:v.optional(v.id('_storage'))},handler:async(ctx,args)=>{
  const {command}=await ownedCommand(ctx,args.commandId);
  if(command.voiceKey!==args.key){if(args.storageId)await ctx.storage.delete(args.storageId);return;}
  if(args.storageId&&command.voiceStorageId)await ctx.storage.delete(command.voiceStorageId);
  await ctx.db.patch(command._id,{voiceLeaseUntil:0,...(args.storageId?{voiceStorageId:args.storageId}:{})});
}});
export const cancel = mutation({args:{commandId:v.id('caylaCommands')},handler:async(ctx,args)=>{
  const access=await ownedCommand(ctx,args.commandId);
  if(!['planned','waiting','review','error'].includes(access.command.status))throw new Error('This review cannot be cancelled.');
  await ctx.db.patch(args.commandId,{status:'cancelled',approvalStatus:'cancelled',summary:'Review cancelled. No additional payroll changes were finalized.',updatedAt:Date.now()});
  await event(ctx,access,'cayla_review_cancelled');
}});

