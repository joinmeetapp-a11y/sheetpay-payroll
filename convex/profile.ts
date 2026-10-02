import { action, internalMutation, mutation } from './_generated/server';
import { internal } from './_generated/api';
import { ConvexError, v } from 'convex/values';
import { requireOwnUser } from './lib/ownUser';

export const updateName = mutation({ args: { displayName: v.string() }, handler: async (ctx, args) => {
  const { user } = await requireOwnUser(ctx);
  const displayName = args.displayName.trim();
  if (!displayName || displayName.length > 100) throw new ConvexError('Enter a name between 1 and 100 characters.');
  await ctx.db.patch(user._id, { displayName });
} });

// Image bytes are transient action arguments, never base64 document fields.
// No caller-supplied user or storage ID can attach another account's file.
export const uploadPhoto = action({ args: { bytes: v.bytes() }, handler: async (ctx, args) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new ConvexError('Please sign in again.');
  const user = await ctx.runQuery(internal.users.getBillingDetailsInternal, { firebaseUid: identity.subject });
  if (!user) throw new ConvexError('Please sign in again.');
  const bytes = new Uint8Array(args.bytes);
  if (!bytes.length || bytes.length > 512 * 1024) throw new ConvexError('Choose a smaller profile photo.');
  const png = [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
  if (!png && !jpeg && !webp) throw new ConvexError('Choose a JPG, PNG or WebP image.');
  const storageId = await ctx.storage.store(new Blob([args.bytes], { type: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp' }));
  try {
    await ctx.runMutation((internal as any).profile.savePhoto, { firebaseUid: identity.subject, storageId });
    return { success: true };
  } catch {
    await ctx.storage.delete(storageId);
    throw new ConvexError("We couldn't save your photo. Please try again.");
  }
} });
export const savePhoto = internalMutation({ args: { firebaseUid: v.string(), storageId: v.id('_storage') }, handler: async (ctx, args) => {
  const user = await ctx.db.query('users').withIndex('by_firebase_uid', q => q.eq('firebaseUid', args.firebaseUid)).first();
  if (!user) throw new Error('Account unavailable');
  const previous = user.profilePhotoStorageId;
  await ctx.db.patch(user._id, { profilePhotoStorageId: args.storageId });
  if (previous && previous !== args.storageId) await ctx.storage.delete(previous);
} });
