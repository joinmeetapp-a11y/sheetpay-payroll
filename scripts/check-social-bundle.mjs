import { build } from 'esbuild';
import { wasmPlugin } from '../node_modules/convex/dist/esm/bundler/wasm.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const outdir = await mkdtemp(join(tmpdir(), 'sheetpay-social-bundle-'));
try {
  await build({entryPoints:['convex/social.ts','convex/socialInternal.ts','convex/socialWorker.ts','convex/socialRender.ts','convex/socialImages.ts'],outdir,bundle:true,platform:'node',format:'esm',plugins:[wasmPlugin],logLevel:'warning'});
  console.log('Social backend bundling passed, including the Convex WASM loader. No deployment or network request.');
} finally { await rm(outdir,{recursive:true,force:true}); }
