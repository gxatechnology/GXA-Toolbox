import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const app = readFileSync(join(root, 'public_html/assets/app.js'), 'utf8');
const studio = readFileSync(join(root, 'public_html/assets/advanced-cutout-studio.js'), 'utf8');
const engine = readFileSync(join(root, 'public_html/assets/background-segmentation-engine.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`Background Remover QA contract failed: ${message}`);
    process.exit(1);
  }
}

const requiredAssets = [
  'public_html/assets/background-segmentation-engine.js',
  'public_html/assets/advanced-cutout-studio.js',
  'public_html/assets/models/background-remover/model-config.json',
  'public_html/assets/models/background-remover/u2netp-web.onnx',
  'public_html/assets/vendor/onnxruntime-web/ort.all.min.js',
  'public_html/assets/vendor/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs',
  'public_html/assets/vendor/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm'
];

for (const asset of requiredAssets) {
  const absolute = join(root, asset);
  assert(existsSync(absolute), `${asset} is missing`);
  assert(statSync(absolute).size > 0, `${asset} is empty`);
}

assert(app.includes("renderBackgroundRemoverRoute(container, tool, processingProfile, faqHTML, optionsHTML, accepts, processActionLabel);"), 'background-remover must use the dedicated route renderer');
assert(app.includes('background-remover-page'), 'dedicated Background Remover page markup is missing');
assert(app.includes('Automatic segmentation starts after selection.'), 'upload flow must auto-start segmentation');
assert(app.includes('backgroundAutoTimer'), 'auto-run timer is missing');
assert(app.includes("runFileProcessingPipeline()"), 'processing pipeline hook is missing');
assert(app.includes("new Set(['Background Remover', 'Advanced Cutout Studio'])"), 'logged-out save-job suppression for browser-local Background Remover is missing');

const backgroundBranch = app.slice(app.indexOf("toolId === 'background-remover'"), app.indexOf("toolId === 'color-extractor'"));
assert(backgroundBranch.includes('window.GxaBackgroundSegmentation.segment'), 'primary branch must call the real segmentation engine');
assert(backgroundBranch.includes('Legacy color-key removal is not used automatically'), 'primary branch must not silently fall back to color-key removal');
assert(!backgroundBranch.includes("fetch('/api/background-remover.php'"), 'primary branch must not call the PHP color-key endpoint');

assert(engine.includes("const MODEL_URL = ROOT + 'u2netp-web.onnx';"), 'engine must load the patched browser-compatible local model');
assert(engine.includes("'gpu' in navigator"), 'engine must detect WebGPU');
assert(engine.includes("providers.push('wasm')"), 'engine must include WASM fallback');
assert(engine.includes('wasmPaths = ORT_WASM_PATH'), 'engine must use local ORT WASM paths');
assert(engine.includes('input.1'), 'engine must retain U2NetP input contract');
assert(engine.includes('letterbox'), 'engine must preserve aspect ratio via letterboxing');
assert(engine.includes('statsForMask'), 'mask statistics checks are missing');

for (const action of ['rerun-auto', 'reset-auto-mask', 'invert-mask', 'keep-foreground', 'remove-background']) {
  assert(studio.includes(`data-action="${action}"`) || studio.includes(`action === '${action}'`), `${action} control is missing`);
}

for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
  assert(studio.includes(`data-crop-handle="${handle}"`) || studio.includes(`'${handle}'`), `${handle} crop handle is missing`);
}

assert(studio.includes('cropBoxPointerDown'), 'crop box pointer handling is missing');
assert(studio.includes('cropBoxPointerMove'), 'crop box resize/move handling is missing');
assert(studio.includes('point.x * scaleX'), 'brush X coordinate must map canvas coordinates to mask coordinates');
assert(studio.includes('point.y * scaleY'), 'brush Y coordinate must map canvas coordinates to mask coordinates');
assert(studio.includes('state.maskCanvas = cloneCanvas(state.originalMaskCanvas)'), 'Reset Auto Mask must restore the stored model mask');
assert(studio.includes('255 - image.data[i]'), 'Invert Mask must invert alpha values');

console.log('Background Remover QA contract passed.');
