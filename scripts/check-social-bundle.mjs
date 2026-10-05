import { build } from 'esbuild';
import { wasmPlugin } from '../node_modules/convex/dist/esm/bundler/wasm.js';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { join, basename, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

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
const config = JSON.parse(await readFile('convex.json', 'utf8'));
const outdir = await mkdtemp(join(process.cwd(), '.social-bundle-'));
try {
  for (const platform of ['browser', 'node']) {
    await build({entryPoints:entries[platform], outdir:join(outdir, platform), bundle:true, splitting:true, platform, format:'esm', external:platform === 'node' ? config.node.externalPackages : [], plugins:[wasmPlugin], logLevel:'warning'});
    console.log(`Convex ${platform} runtime bundle passed: ${entries[platform].length} entrypoints.`);
  }
  // The deployment analyzer lacks this newer JavaScript intrinsic.
  const original = Uint8Array.fromBase64;
  try {
    Uint8Array.fromBase64 = undefined;
    await import(pathToFileURL(join(outdir, 'node', 'socialRender.js')).href);
    const renderer = await import(pathToFileURL(join(outdir, 'node', 'lib', 'socialCard.js')).href);
    const { resvgBase64 } = await import(pathToFileURL(join(outdir, 'browser', 'socialAssets', 'resvgBytes.js')).href);
    await renderer.initializeRenderer(new Uint8Array(Buffer.from(resvgBase64, 'base64')));
    const portrait = new Uint8Array(await readFile('tests/fixtures/social-portrait.jpg'));
    const card = await renderer.renderSocialCard('The workday ends, but payroll still needs me.\n\nI check the hours before I put the tools away, then go through the rates and overtime.\n\nThe crew depends on me getting those details right. Collecting hours earlier makes the evening easier.', portrait, 'image/jpeg');
    if (card.png.length < 1000) throw new Error('Bundled renderer did not produce a PNG');
  } finally { Uint8Array.fromBase64 = original; }
  console.log('Full Convex runtime bundling and compatible renderer module loading passed. No deployment or network request.');
} finally { await rm(outdir, { recursive:true, force:true }); }
