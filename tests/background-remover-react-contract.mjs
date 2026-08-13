import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const required = [
  'background-remover-app/package.json',
  'background-remover-app/vite.config.ts',
  'background-remover-app/src/App.tsx',
  'background-remover-app/src/store/editorStore.ts',
  'background-remover-app/src/editor/compositor.ts',
  'background-remover-app/src/editor/exportRenderer.ts',
  'background-remover-app/src/editor/maskBrush.ts',
  'background-remover-app/src/editor/cropEngine.ts',
  'background-remover-app/src/segmentation/onnxRuntime.ts',
  'background-remover-app/src/segmentation/modelManager.ts',
  'background-remover-app/src/segmentation/preprocess.ts',
  'background-remover-app/src/segmentation/postprocess.ts',
  'background-remover-app/src/segmentation/segmentImage.ts',
  'background-remover-app/src/workers/mask.worker.ts',
  'background-remover-app/public/models/u2netp-web.onnx',
  'background-remover-app/public/vendor/ort/ort-wasm-simd-threaded.jsep.wasm',
  'public_html/background-remover/index.html'
];
required.forEach((path) => assert(existsSync(join(root, path)), `Missing React Background Remover file: ${path}`));

const app = read('background-remover-app/src/App.tsx');
const types = read('background-remover-app/src/types/editor.ts');
const runtime = read('background-remover-app/src/segmentation/onnxRuntime.ts');
const modelManager = read('background-remover-app/src/segmentation/modelManager.ts');
const exportRenderer = read('background-remover-app/src/editor/exportRenderer.ts');
const css = read('background-remover-app/src/styles/global.css');
const vite = read('background-remover-app/vite.config.ts');
const netlify = read('netlify.toml');
const legacyApp = read('public_html/assets/app.js');
const rootIndex = read('index.html');

['auto', 'erase', 'restore', 'refine', 'background', 'crop', 'adjust', 'effects', 'design', 'layers'].forEach((tool) => assert(types.includes(`'${tool}'`), `EditorTool is missing ${tool}`));
assert(app.includes('segmentImage(image'), 'Upload must automatically start segmentation.');
assert(!app.includes('/api/background-remover.php'), 'React Background Remover must not call the legacy PHP endpoint.');
assert(runtime.includes("['webgpu', 'wasm']"), 'Execution provider order must prefer WebGPU and fall back to WASM.');
assert(modelManager.includes('for (const provider of providerOrder'), 'Model manager must attempt the provider fallback sequence.');
assert(exportRenderer.includes('fullResolution: true'), 'Export must render from original-resolution state.');
assert(vite.includes("base: '/background-remover/'"), 'Vite base must match the production subpath.');
assert(vite.includes("outDir: '../public_html/background-remover'"), 'Vite output must integrate with Hostinger public_html.');
assert(css.includes('@media (max-width: 820px)'), 'Mobile editor breakpoint is missing.');
assert(css.includes('.bottom-toolbar { position: fixed'), 'Mobile bottom toolbar styling is missing.');
assert(css.includes('overflow-x: hidden'), 'Global horizontal overflow protection is missing.');
assert(/publish\s*=\s*"dist"/.test(netlify), 'Netlify must publish the generated static site containing the Background Remover build.');
assert(!/from\s*=\s*"\/\*"/.test(netlify), 'Netlify must not restore a broad SPA fallback over generated routes and real 404s.');
assert(netlify.includes('Content-Type = "application/wasm"'), 'Netlify WASM MIME header is missing.');
assert(netlify.includes('Content-Type = "application/octet-stream"'), 'Netlify ONNX MIME header is missing.');
assert(legacyApp.includes("window.location.assign('/background-remover/')"), 'Legacy navigation must hard-navigate to the React route.');
assert(!rootIndex.includes('background-segmentation-engine.js'), 'Root HTML must not globally load the legacy Background Remover engine.');
assert(!rootIndex.includes('advanced-cutout-studio.js'), 'Root HTML must not globally load the legacy Cutout Studio.');

console.log('React Background Remover architecture and deployment contract passed.');
