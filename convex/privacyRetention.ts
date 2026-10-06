import { internalMutation } from './_generated/server';

/** Temporary email PDFs are not payroll history. Remove expired copies and stop stale deliveries. */
export const purgeExpiredAttachments = internalMutation({ args: {}, handler: async ctx => {
 const rows = await ctx.db.query('bulkPayslipUploads').withIndex('by_expiry', q => q.lt('expiresAt', Date.now())).take(100);
 for (const upload of rows) {
  const recipients = upload.payrollRunId ? await ctx.db.query('bulkEmailRecipients').withIndex('by_run_employee', q => q.eq('payrollRunId', upload.payrollRunId!).eq('employeeId', upload.employeeId)).collect() : [];
  for (const recipient of recipients) {
   if (recipient.storageId === upload.storageId && ['queued', 'sending'].includes(recipient.status)) await ctx.db.patch(recipient._id, { status: 'failed', errorMessage: 'Temporary attachment expired. Contact support to review this delivery.' });
  }
  await ctx.storage.delete(upload.storageId);
  await ctx.db.delete(upload._id);
 }
 // Old guest funnel is retired. Retention dates still apply to previously stored drafts.
 const guests = await ctx.db.query('guestSessions').withIndex('by_expires_at', q => q.lt('expiresAt', Date.now())).take(100);
 for (const row of guests) await ctx.db.delete(row._id);
 const prepared = await ctx.db.query('caylaPreparedEmployees').withIndex('by_expiry', q => q.lt('expiresAt', Date.now())).take(100);
 for (const row of prepared) await ctx.db.delete(row._id);
 const plans = await ctx.db.query('caylaPreparedClients').withIndex('by_expiry', q => q.lt('expiresAt', Date.now())).take(100);
 for (const row of plans) await ctx.db.delete(row._id);
 const voices=await ctx.db.query('caylaCommands').withIndex('by_voice_expiry',q=>q.gt('voiceExpiresAt',0).lt('voiceExpiresAt',Date.now())).take(100);
 for(const command of voices){if(command.voiceStorageId)await ctx.storage.delete(command.voiceStorageId);await ctx.db.patch(command._id,{voiceStorageId:undefined,voiceKey:undefined,voiceLeaseUntil:undefined,voiceExpiresAt:undefined});}
 const replies=await ctx.db.query('caylaCommands').withIndex('by_reply_expiry',q=>q.gt('replyExpiresAt',0).lt('replyExpiresAt',Date.now())).take(100);
 for(const command of replies)await ctx.db.patch(command._id,{reply:undefined,replyExpiresAt:undefined});
 return { caylaPreparedRowsDeleted: prepared.length, caylaClientPlansDeleted: plans.length, attachmentsDeleted: rows.length, guestDraftsDeleted: guests.length };
} });

