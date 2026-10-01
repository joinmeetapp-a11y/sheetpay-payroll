import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
export const begin = internalMutation({
 args: { userId: v.id('users'), plan: v.union(v.literal('accountant_monthly'), v.literal('accountant_yearly')) },
 handler: async (ctx, args) => {
   const existing = await ctx.db.query('accountantCheckouts').withIndex('by_user_plan', q=>q.eq('userId',args.userId).eq('plan',args.plan)).first();
   if (existing && existing.expiresAt > Date.now()) {
     if (existing.status === 'ready') return { id: existing._id, transactionId: existing.transactionId, busy: false };
     if (existing.status === 'creating') return { id: existing._id, busy: true };
   }
   const fields = { ...args, status: 'creating' as const, transactionId: undefined, expiresAt: Date.now()+120000, updatedAt: Date.now() };
   const id = existing ? existing._id : await ctx.db.insert('accountantCheckouts', fields);
   if (existing) await ctx.db.patch(id,fields);
   return { id, busy: false };
 }
});
export const finish = internalMutation({ args: { id: v.id('accountantCheckouts'), transactionId: v.optional(v.string()) }, handler: async(ctx,args)=>{
 await ctx.db.patch(args.id,{ status: args.transactionId ? 'ready':'failed', transactionId: args.transactionId, expiresAt: Date.now()+1800000,updatedAt:Date.now() });
}});
