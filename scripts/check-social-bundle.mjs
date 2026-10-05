import { build } from 'esbuild';
import { wasmPlugin } from '../node_modules/convex/dist/esm/bundler/wasm.js';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, relative } from 'node:path';

// Match Convex's entrypoint discovery, including helpers, and check both runtimes.
const entries = { browser: [], node: [] };
async function discover(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== '_generated') await discover(path);
      continue;
    }
    const name = basename(path), rel = relative('convex', path);
    if (!/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(name) || name.startsWith('.') || name.startsWith('#') || (name.match(/\./g) || []).length > 1 || rel.includes(' ')) continue;
    const source = await readFile(path, 'utf8');
    if (!/^\s{0,100}(import|export)/m.test(source)) continue;
    const node = /^\s*["']use node["'];?\s*$/m.test(source);
    if (node && ['http.ts', 'crons.ts', 'schema.ts'].includes(rel)) throw new Error(`Invalid Node runtime declaration: ${rel}`);
    entries[node ? 'node' : 'browser'].push(path);
  }
}
await discover('convex');
const outdir = await mkdtemp(join(tmpdir(), 'sheetpay-social-bundle-'));
try {
  for (const platform of ['browser', 'node']) {
    await build({entryPoints:entries[platform], outdir:join(outdir, platform), bundle:true, splitting:true, platform, format:'esm', plugins:[wasmPlugin], logLevel:'warning'});
    console.log(`Convex ${platform} runtime bundle passed: ${entries[platform].length} entrypoints.`);
  }
  console.log('Full Convex runtime bundling passed, including helper files and WASM. No deployment or network request.');
} finally { await rm(outdir, { recursive:true, force:true }); }
