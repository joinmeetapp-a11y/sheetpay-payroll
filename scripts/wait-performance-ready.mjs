import { convex, requireProduction, productionReference } from './verify-performance-target.mjs';

const deadline = Date.now() + 15 * 60 * 1000;
while (true) {
  const status = convex(['run', '--deployment', productionReference, 'performanceMigration:readiness', '{}']);
  requireProduction(status.productionUrl);
  if (status.ready) { console.log('All transactional summaries and directories are ready.'); break; }
  if (Date.now() >= deadline) throw new Error('Backfill is incomplete. Keep the existing frontend deployed, inspect migration status, then resume incomplete tables.');
  console.log('Backfill in progress:', status.states.map(row => `${row.key}=${row.done ? 'ready' : row.processed}`).join(', '));
  await new Promise(resolve => setTimeout(resolve, 5000));
}
