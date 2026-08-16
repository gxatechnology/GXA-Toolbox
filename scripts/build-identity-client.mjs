import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [resolve(projectRoot, 'src', 'identity-client.js')],
  outfile: resolve(projectRoot, 'public_html', 'assets', 'identity-client.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  sourcemap: false
});

console.log('Built the local Netlify Identity browser client.');
