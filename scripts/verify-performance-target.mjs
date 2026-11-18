import { spawnSync } from 'node:child_process';

export const productionReference = 'sure-book-me:sheetpay-accountant:prod';
export const productionUrl = 'https://clear-avocet-926.convex.cloud';
export function convex(args) {
  const result = spawnSync('npx', ['convex', ...args], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  if (result.error || result.status !== 0) throw new Error('Convex verification failed. Check the selected account and project.');
  return JSON.parse(result.stdout.trim());
}
export function requireProduction(value) {
  if (value !== productionUrl) throw new Error('STOP: the selected production deployment differs from the live Accountant frontend.');
}
if (process.argv[1]?.endsWith('/verify-performance-target.mjs')) {
  requireProduction(convex(['run', '--deployment', productionReference, '--inline-query', 'process.env.CONVEX_CLOUD_URL']));
  console.log(`Verified ${productionReference}: ${productionUrl}`);
}
