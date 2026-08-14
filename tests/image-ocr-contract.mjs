import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  PRODUCTION_ORIGIN,
  canonicalToolUrl,
  loadToolRegistry,
  toolDescription,
  toolTitle
} from '../scripts/tool-registry.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const app = await read('public_html/assets/app.js');
const tools = await loadToolRegistry();

assert.equal(tools.length, 92, 'Image OCR must extend the registry to 92 tools without replacing an existing route.');
assert.equal(new Set(tools.map(tool => tool.id)).size, 92, 'Every registered tool ID must remain unique.');

const imageOcr = tools.find(tool => tool.id === 'image-ocr');
assert.deepEqual(imageOcr, {
  id: 'image-ocr',
  name: 'Image OCR',
  category: 'image',
  desc: 'Extract text from JPG, JPEG, PNG, and WEBP images with browser-based OCR.',
  icon: 'scan-text'
});
assert.equal(toolTitle(imageOcr), 'Image OCR - Extract Text from Images | GXA Toolbox');
assert.equal(toolDescription(imageOcr), 'Extract text from JPG, JPEG, PNG, and WEBP images using browser-based OCR with GXA Toolbox.');
assert.equal(canonicalToolUrl(imageOcr.id), `${PRODUCTION_ORIGIN}/image-ocr/`);

const ocrPdf = tools.find(tool => tool.id === 'ocr-pdf');
assert.deepEqual(ocrPdf, {
  id: 'ocr-pdf',
  name: 'OCR PDF',
  category: 'pdf',
  desc: 'Extract text from scanned PDF documents via Optical Character Recognition.',
  icon: 'search'
}, 'OCR PDF registration must remain unchanged and separate.');

const jpgToPdf = tools.find(tool => tool.id === 'jpg-to-pdf');
assert.deepEqual(jpgToPdf, {
  id: 'jpg-to-pdf',
  name: 'JPG to PDF',
  category: 'pdf',
  desc: 'Convert and merge JPG/PNG/WEBP images into a PDF.',
  icon: 'file-text'
}, 'JPG to PDF registration must remain unchanged.');

const ocrPdfBranch = app.slice(app.indexOf("} else if (toolId === 'ocr-pdf')"), app.indexOf("} else if (toolId === 'image-ocr')"));
assert.match(ocrPdfBranch, /accepts = '\.pdf';/);
assert.match(ocrPdfBranch, /multiple = false;/);
assert.doesNotMatch(ocrPdfBranch, /image\//i, 'OCR PDF must not accept image input.');
assert.match(app, /async function runPDFOCR\(file, lang\)/);
assert.match(app, /maximumPages: 20/);
assert.ok(app.includes("return new Blob([text.join('\\n\\n')], { type: 'text/plain;charset=utf-8' });"), 'OCR PDF must keep its extracted TXT output.');

const imageOcrBranch = app.slice(app.indexOf("} else if (toolId === 'image-ocr')"), app.indexOf("} else if (toolId === 'image-to-pdf')"));
assert.match(imageOcrBranch, /accepts = '\.jpg,\.jpeg,\.png,\.webp,image\/jpeg,image\/png,image\/webp';/);
assert.match(imageOcrBranch, /multiple = false;/);
assert.match(imageOcrBranch, /JPG · JPEG · PNG · WEBP/);
assert.match(imageOcrBranch, /Maximum file size: 20 MB · Maximum decoded image: 24 megapixels/);
assert.match(app, /async function runImageOCR\(file, lang\)/);
assert.match(app, /decoded\.width \* decoded\.height > 24_000_000/);
assert.ok(app.indexOf('const decoded = await loadDecodedImageSource(file)') < app.indexOf("await window.GxaWorkspace.loadScriptOnce('/assets/vendor/tesseract/tesseract.min.js'"), 'Image decoding and safety checks must run before OCR engine loading.');
assert.match(app, /No readable text was detected in this image\./);
assert.match(app, /copyImageOcrText/);
assert.ok(app.includes("originalFile.name.replace(/\\.[^.]+$/, '') + '_ocr.txt'"), 'Image OCR must create a truthful TXT filename.');

const validatorSource = app.slice(app.indexOf('const IMAGE_OCR_TYPES'), app.indexOf('async function runImageOCR'));
const context = {};
vm.createContext(context);
vm.runInContext(`${validatorSource}\nglobalThis.validate = assertImageOcrInput;`, context);
const validFiles = [
  { name: 'sample.jpg', type: 'image/jpeg' },
  { name: 'sample.jpeg', type: 'image/jpeg' },
  { name: 'sample.png', type: 'image/png' },
  { name: 'sample.webp', type: 'image/webp' },
  { name: 'android-camera.jpg', type: '' }
];
for (const file of validFiles) assert.doesNotThrow(() => context.validate({ ...file, size: 100 }));
assert.throws(() => context.validate({ name: 'sample.gif', type: 'image/gif', size: 100 }), /supports JPG, JPEG, PNG, and WEBP/);
assert.throws(() => context.validate({ name: 'fake.png', type: 'text/plain', size: 100 }), /supports JPG, JPEG, PNG, and WEBP/);
assert.throws(() => context.validate({ name: 'empty.png', type: 'image/png', size: 0 }), /empty/);
assert.throws(() => context.validate({ name: 'huge.png', type: 'image/png', size: 21 * 1024 * 1024 }), /20 MB/);

const imageHtml = await read('dist/image-ocr/index.html');
assert.match(imageHtml, /<h1[^>]*>Image OCR<\/h1>/i);
assert.match(imageHtml, /<title>Image OCR - Extract Text from Images \| GXA Toolbox<\/title>/i);
assert.match(imageHtml, /rel="canonical" href="https:\/\/gxatoolbox\.in\/image-ocr\/"/i);
assert.match(imageHtml, /name="robots" content="index, follow"/i);
assert.match(imageHtml, /property="og:title" content="Image OCR - Extract Text from Images \| GXA Toolbox"/i);
assert.match(imageHtml, /name="twitter:title" content="Image OCR - Extract Text from Images \| GXA Toolbox"/i);
assert.match(imageHtml, /BreadcrumbList/);

const sitemap = await read('dist/sitemap.xml');
assert.equal((sitemap.match(/https:\/\/gxatoolbox\.in\/image-ocr\//g) || []).length, 1, 'Image OCR canonical must appear exactly once in the sitemap.');

const visibleBackgroundUi = [
  await read('background-remover-app/src/components/ProcessingScreen.tsx'),
  await read('background-remover-app/src/components/UploadScreen.tsx'),
  await read('background-remover-app/src/components/tools/AutoPanel.tsx')
].join('\n');
assert.match(visibleBackgroundUi, /GXA Vision Model/);
assert.doesNotMatch(visibleBackgroundUi, /ONNX|WebGPU|WASM|U2NetP/i, 'Normal Background Remover UI must not expose engine implementation names.');
for (const stage of ['Reading image', 'Loading GXA Vision Model', 'Detecting subject', 'Creating background mask', 'Opening editor']) {
  assert.ok(visibleBackgroundUi.includes(stage), `Background Remover processing stage is missing: ${stage}`);
}
const backgroundApp = await read('background-remover-app/src/App.tsx');
assert.match(backgroundApp, /GXA Vision Model/);
assert.match(backgroundApp, /Background removal engine could not start\. Please retry or use a supported browser\./);
assert.doesNotMatch(backgroundApp, /state\.provider\?\.toUpperCase\(\)/, 'The editor command bar must not expose the internal execution provider.');
const internalRuntime = await read('background-remover-app/src/segmentation/onnxRuntime.ts');
assert.match(internalRuntime, /webgpu/);
assert.match(internalRuntime, /wasm/);
assert.match(internalRuntime, /ONNX Runtime ready/);

console.log('Image OCR contract passed: separate route/tool, PDF OCR and JPG-to-PDF regressions, four-format validation, SEO/sitemap, and GXA Vision Model UI wording.');
