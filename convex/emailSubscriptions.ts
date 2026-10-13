import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

const normalize = (email: string) => email.trim().toLowerCase();

/** One stable, unguessable unsubscribe link per recipient, including employees without an account. */
export const ensure = internalMutation({
  args: { email: v.string(), token: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const email = normalize(args.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-f0-9]{64}$/.test(args.token) || !/^[a-f0-9]{64}$/.test(args.tokenHash)) throw new Error('Invalid email subscription.');
    let row = await ctx.db.query('emailSubscriptions').withIndex('by_email', q => q.eq('email', email)).first();
    if (!row) {
      const id = await ctx.db.insert('emailSubscriptions', { email, token: args.token, tokenHash: args.tokenHash, createdAt: Date.now() });
      row = await ctx.db.get(id);
    }
    return { token: row!.token, allowed: row!.unsubscribedAt === undefined };
  },
});

export const allowed = internalQuery({ args: { email: v.string() }, handler: async (ctx, args) => {
  const row = await ctx.db.query('emailSubscriptions').withIndex('by_email', q => q.eq('email', normalize(args.email))).first();
  return row?.unsubscribedAt === undefined;
} });

export const inspectToken = internalQuery({ args: { tokenHash: v.string() }, handler: async (ctx, args) => {
  const row = await ctx.db.query('emailSubscriptions').withIndex('by_token', q => q.eq('tokenHash', args.tokenHash)).first();
  return row ? { unsubscribed: row.unsubscribedAt !== undefined } : null;
} });

export const unsubscribe = internalMutation({ args: { tokenHash: v.string() }, handler: async (ctx, args) => {
  const row = await ctx.db.query('emailSubscriptions').withIndex('by_token', q => q.eq('tokenHash', args.tokenHash)).first();
  if (!row) return false;
  if (row.unsubscribedAt === undefined) await ctx.db.patch(row._id, { unsubscribedAt: Date.now() });
  // Every optional sender, including marketing, checks this recipient preference.
  return true;
} });
