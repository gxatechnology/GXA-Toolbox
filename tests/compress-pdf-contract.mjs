import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import createQpdf from '@neslinesli93/qpdf-wasm';
import { PDFDocument } from 'pdf-lib';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

const rootUrl = new URL('../', import.meta.url);
const fixtureUrl = name => new URL(`tests/fixtures/${name}`, rootUrl);
const app = await readFile(new URL('public_html/assets/app.js', rootUrl), 'utf8');
const worker = await readFile(new URL('public_html/assets/qpdf-worker.js', rootUrl), 'utf8');
const css = await readFile(new URL('public_html/assets/style.css', rootUrl), 'utf8');
const content = await readFile(new URL('public_html/assets/tool-content.js', rootUrl), 'utf8');
const workspace = await readFile(new URL('public_html/assets/tool-workspace.js', rootUrl), 'utf8');
const tools = await loadToolRegistry();

assert.equal(tools.length, 95, 'The central registry must preserve the existing tools plus Edit PDF, Image Converter, and GPS Map Camera.');
const compressTools = tools.filter(tool => tool.id === 'compress-pdf');
assert.equal(compressTools.length, 1, 'Compress PDF must have one canonical registry entry.');
assert.equal(compressTools[0].name, 'Compress PDF');
assert.match(app, /'compress-pdf': 'Download Compressed PDF'/);
assert.match(app, /toolId === 'compress-pdf' \? 'Compress another PDF' : 'Start Over'/);
assert.match(app, /Compression level/);
assert.match(app, /setOptPdfCompression\('low'/);
assert.match(app, /setOptPdfCompression\('balanced'/);
assert.match(app, /setOptPdfCompression\('high'/);
assert.match(app, /Maximum file size: 25 MB for local PDF compression/);
assert.match(app, /file\.size === 0/);
assert.match(app, /file\.type && file\.type !== 'application\/pdf'/);
assert.match(app, /header !== '%PDF-'/);
assert.match(app, /runQpdfOperation\(`compress:\$\{mode\}`/);
assert.match(app, /Original<\/span>/);
assert.match(app, /Compressed<\/span>/);
assert.match(app, /Saved<\/span>/);
assert.match(app, /percentage\.toFixed\(1\)/);
assert.match(worker, /--object-streams=generate/);
assert.match(worker, /--recompress-flate/);
assert.match(worker, /--jpeg-quality=82/);
assert.match(worker, /--jpeg-quality=52/);
assert.match(css, /\.compression-preset-grid/);
assert.match(css, /\.pdf-compression-summary/);
assert.match(content, /Three honest modes/);
assert.match(content, /digital signatures/);

const workspaceContext = {};
workspaceContext.window = workspaceContext;
vm.createContext(workspaceContext);
vm.runInContext(workspace, workspaceContext);
const emptyValidation = workspaceContext.GxaWorkspace.validateFiles([{ name: 'empty.pdf', size: 0, lastModified: 1, type: 'application/pdf' }], { accept: '.pdf', multiple: false, maxSize: 25 * 1024 * 1024 });
assert.equal(emptyValidation.accepted.length, 0);
assert.match(emptyValidation.errors[0], /file is empty/);
const extensionValidation = workspaceContext.GxaWorkspace.validateFiles([{ name: 'wrong.txt', size: 50, lastModified: 2, type: 'application/pdf' }], { accept: '.pdf', multiple: false, maxSize: 25 * 1024 * 1024 });
assert.equal(extensionValidation.accepted.length, 0);
assert.match(extensionValidation.errors[0], /unsupported file type/);

const wasmPath = fileURLToPath(new URL('node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm', rootUrl));
const qpdf = await createQpdf({
  noInitialRun: true,
  locateFile: file => file.endsWith('.wasm') ? wasmPath : file,
  print() {},
  printErr() {}
});

let operationCounter = 0;
function modeArgs(mode, inputPath, outputPath) {
  const common = ['--object-streams=generate', '--stream-data=compress', '--recompress-flate'];
  if (mode === 'low') return [...common, '--compression-level=6', inputPath, outputPath];
  if (mode === 'balanced') return [...common, '--compression-level=9', '--optimize-images', '--jpeg-quality=82', '--oi-min-width=64', '--oi-min-height=64', '--oi-min-area=4096', inputPath, outputPath];
  if (mode === 'high') return [...common, '--compression-level=9', '--optimize-images', '--jpeg-quality=52', '--oi-min-width=32', '--oi-min-height=32', '--oi-min-area=1024', inputPath, outputPath];
  throw new Error(`Unknown mode: ${mode}`);
}

function runQpdf(bytes, mode) {
  operationCounter += 1;
  const inputPath = `/compress-contract-input-${operationCounter}.pdf`;
  const outputPath = `/compress-contract-output-${operationCounter}.pdf`;
  qpdf.FS.writeFile(inputPath, bytes);
  try {
    const exitCode = qpdf.callMain(modeArgs(mode, inputPath, outputPath));
    if (exitCode !== 0) return { exitCode, bytes: null };
    return { exitCode, bytes: Buffer.from(qpdf.FS.readFile(outputPath)) };
  } finally {
    try { qpdf.FS.unlink(inputPath); } catch {}
    try { qpdf.FS.unlink(outputPath); } catch {}
  }
}

async function assertValidOutput(sourceBytes, mode, label) {
  const sourceDocument = await PDFDocument.load(sourceBytes);
  const result = runQpdf(sourceBytes, mode);
  assert.equal(result.exitCode, 0, `${label} should compress successfully in ${mode} mode.`);
  assert.equal(result.bytes.subarray(0, 5).toString(), '%PDF-', `${label} output must keep a valid PDF header.`);
  const outputDocument = await PDFDocument.load(result.bytes);
  assert.equal(outputDocument.getPageCount(), sourceDocument.getPageCount(), `${label} page count must be preserved.`);
  return result.bytes;
}

const textPdf = await readFile(fixtureUrl('text.pdf'));
const multiPagePdf = await readFile(fixtureUrl('multi-page.pdf'));
const textLow = await assertValidOutput(textPdf, 'low', 'text PDF');
const multiPageBalanced = await assertValidOutput(multiPagePdf, 'balanced', 'multi-page PDF');
assert.ok(textLow.length < textPdf.length, 'Low mode must reduce the text fixture.');
assert.ok(multiPageBalanced.length < multiPagePdf.length, 'Balanced mode must reduce the multi-page fixture.');
const manyPagePdf = await readFile(fixtureUrl('large.pdf'));
const manyPageBalanced = await assertValidOutput(manyPagePdf, 'balanced', '80-page PDF');
assert.ok(manyPageBalanced.length < manyPagePdf.length, 'Balanced mode must reduce the 80-page fixture.');

const landscapePng = await readFile(fixtureUrl('landscape.png'));
const imageDocument = await PDFDocument.create();
const embeddedPng = await imageDocument.embedPng(landscapePng);
const page = imageDocument.addPage([embeddedPng.width, embeddedPng.height]);
page.drawImage(embeddedPng, { x: 0, y: 0, width: embeddedPng.width, height: embeddedPng.height });
const imageHeavyPdf = Buffer.from(await imageDocument.save({ useObjectStreams: false }));
const balanced = await assertValidOutput(imageHeavyPdf, 'balanced', 'image-heavy PDF');
const high = await assertValidOutput(imageHeavyPdf, 'high', 'image-heavy PDF');
assert.ok(balanced.length < imageHeavyPdf.length, 'Balanced mode must reduce the image-heavy fixture.');
assert.ok(high.length < balanced.length, 'High mode must be smaller than Balanced for the image-heavy fixture.');

const alreadyOptimized = await readFile(fixtureUrl('one-page.pdf'));
const optimizedResult = runQpdf(alreadyOptimized, 'low');
assert.equal(optimizedResult.exitCode, 0);
assert.ok(optimizedResult.bytes.length >= alreadyOptimized.length, 'The fixture must exercise the honest no-savings path.');

const emptyResult = runQpdf(Buffer.alloc(0), 'balanced');
assert.notEqual(emptyResult.exitCode, 0, 'An empty PDF must not produce an output.');
process.exitCode = 0;

for (const fixture of ['corrupt.pdf', 'encrypted-password.pdf']) {
  const result = runQpdf(await readFile(fixtureUrl(fixture)), 'balanced');
  assert.notEqual(result.exitCode, 0, `${fixture} must be rejected by qpdf compression.`);
  process.exitCode = 0;
}

const savedPercent = ((imageHeavyPdf.length - balanced.length) / imageHeavyPdf.length) * 100;
assert.ok(savedPercent > 0 && savedPercent < 100, 'Measured savings percentage must be derived from real byte counts.');

console.log(`Compress PDF contract passed: ${tools.length} tools; text ${textPdf.length}->${textLow.length}; multi-page ${multiPagePdf.length}->${multiPageBalanced.length}; 80-page ${manyPagePdf.length}->${manyPageBalanced.length}; image-heavy ${imageHeavyPdf.length}->Balanced ${balanced.length}->High ${high.length} bytes (${savedPercent.toFixed(1)}% Balanced savings).`);
