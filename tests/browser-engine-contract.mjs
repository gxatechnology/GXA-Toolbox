import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import JSZip from 'jszip';
import createQpdf from '@neslinesli93/qpdf-wasm';
import mammoth from 'mammoth';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtures = join(root, 'tests', 'fixtures');
const app = await readFile(join(root, 'public_html', 'assets', 'app.js'), 'utf8');
const workspace = await readFile(join(root, 'public_html', 'assets', 'tool-workspace.js'), 'utf8');
const matrix = await readFile(join(root, 'docs', 'TOOL_ENGINE_AUDIT.md'), 'utf8');

const registry = app.slice(app.indexOf('const toolsList'), app.indexOf('// --- Main Application Controller'));
const ids = [...registry.matchAll(/\{\s*id:\s*'([^']+)'/g)].map(match => match[1]);
assert.equal(ids.length, 91, 'The browser-engine audit must preserve all 91 registered tools.');
const matrixIds = [...matrix.matchAll(/^\|[^\n]*\| `([^`]+)` \|/gm)].map(match => match[1]);
assert.equal(matrixIds.length, 91, 'The capability matrix must contain exactly 91 tool rows.');
assert.deepEqual(new Set(matrixIds), new Set(ids), 'The capability matrix IDs must exactly match the registry.');
assert(!/\b(?:UNTESTED|UNKNOWN|DEPENDENCY REQUIRED)\b/i.test(matrix), 'The final matrix cannot contain generic unresolved classifications.');
const matrixRows = matrix.split('\n').filter(line => /^\|[^\n]*\| `[^`]+` \|/.test(line));
const decisionPattern = /\*\*(FULLY WORKING — BROWSER|FULLY WORKING — WASM|FULLY WORKING — NETLIFY FUNCTION|WORKING WITH BROWSER LIMITATION|NOT CURRENTLY FEASIBLE)\*\*/g;
matrixRows.forEach(row => assert.equal([...row.matchAll(decisionPattern)].length, 1, `Matrix row must have exactly one final decision: ${row}`));

const renderTools = app.slice(app.indexOf('function renderToolsGrid'), app.indexOf('function filterTools'));
assert(!renderTools.includes('getProcessingProfile'), 'All Tools cards must not query processing profiles.');
assert(!renderTools.includes('tool-badge'), 'All Tools cards must not render processing badges.');
assert(renderTools.includes('tool-card-arrow'), 'The card open arrow must remain.');

const blockerSource = workspace.slice(workspace.indexOf('const blockers'), workspace.indexOf('const serverTools'));
const blockers = [...blockerSource.matchAll(/^\s*'([^']+)':\s*'[^']+'/gm)].map(match => match[1]);
assert.deepEqual(blockers, ['ppt-to-pdf'], 'Only the native presentation-to-PDF fidelity limitation should remain blocked.');
for (const requiredSource of ['runQpdfOperation', 'mammoth.extractRawText', 'createTextPdf', 'runEPUBToPDF', 'runPDFToEPUB', 'runGifToPng', 'runPDFExtractImages', 'Tesseract.createWorker', 'runPDFToExcel', 'PptxGenJS']) {
  assert(app.includes(requiredSource), `Missing selected browser-engine implementation: ${requiredSource}`);
}
assert(app.includes("new Worker('/assets/gif-encoder-worker.js', { type: 'module' })"), 'GIF quantization/encoding must run in its dedicated module worker.');
const gifEncoderWorker = await readFile(join(root, 'public_html', 'assets', 'gif-encoder-worker.js'), 'utf8');
for (const requiredSource of ['GIFEncoder', 'quantize', 'applyPalette']) assert(gifEncoderWorker.includes(requiredSource), `GIF worker is missing ${requiredSource}.`);
assert(app.includes('maximumTotalPixels: 30_000_000'), 'Heavy PDF render workflows must enforce a total-pixel budget.');
assert(workspace.includes('if (options.onPage) await options.onPage'), 'Heavy PDF render workflows must support page-at-a-time consumption.');
assert(workspace.includes("script.dataset.gxaLoadState = 'failed'"), 'Route-local script loading must recover from a failed first attempt.');
assert(app.indexOf("extension === 'gif'") < app.indexOf("blob.type.startsWith('image/')"), 'GIF validation must run before generic image decoding.');
assert(app.indexOf("['epub', 'xlsx', 'pptx', 'docx'].includes(extension)") < app.indexOf("extension === 'zip' || blob.type.includes('zip')"), 'Packaged-format validation must run before generic ZIP validation.');

const vendorFiles = [
  'vendor/qpdf/qpdf.js', 'vendor/qpdf/qpdf.wasm', 'vendor/gifenc/gifenc.esm.js',
  'vendor/mammoth/mammoth.browser.min.js', 'vendor/tesseract/tesseract.min.js',
  'vendor/tesseract/worker.min.js', 'vendor/pptxgenjs/pptxgen.min.js',
  'vendor/sheetjs/xlsx.full.min.js', 'gif-encoder-worker.js'
];
vendorFiles.forEach(path => assert(existsSync(join(root, 'public_html', 'assets', path)), `Missing route-local engine asset: ${path}`));

const manifest = JSON.parse(await readFile(join(fixtures, 'manifest.json'), 'utf8'));
for (const filename of manifest.required) assert(existsSync(join(fixtures, filename)), `Missing required synthetic fixture: ${filename}`);

const packageRequirements = {
  'sample.docx': ['[Content_Types].xml', 'word/document.xml'],
  'sample.xlsx': ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'],
  'sample.pptx': ['[Content_Types].xml', 'ppt/presentation.xml', 'ppt/slides/slide1.xml'],
  'sample.epub': ['mimetype', 'META-INF/container.xml', 'EPUB/package.opf'],
  'sample.zip': ['hello.txt', 'nested/data.json']
};
for (const [filename, required] of Object.entries(packageRequirements)) {
  const archive = await JSZip.loadAsync(await readFile(join(fixtures, filename)), { checkCRC32: true });
  required.forEach(path => assert(archive.file(path), `${filename} is missing ${path}.`));
  if (filename.endsWith('.epub')) assert.equal((await archive.file('mimetype').async('text')).trim(), 'application/epub+zip');
}

const docx = await mammoth.extractRawText({ buffer: await readFile(join(fixtures, 'sample.docx')) });
assert(docx.value.includes('GXA Toolbox DOCX fixture'), 'Mammoth must extract real text from the DOCX fixture.');

const decoderSource = await readFile(join(root, 'public_html', 'assets', 'gif-decoder.js'), 'utf8');
const gifContext = { window: {} };
vm.createContext(gifContext);
vm.runInContext(decoderSource, gifContext);
const gifBytes = await readFile(join(fixtures, 'sample.gif'));
const decodedGif = gifContext.window.GxaGifDecoder.decode(gifBytes);
assert.equal(decodedGif.width, 16);
assert.equal(decodedGif.height, 16);
assert.equal(decodedGif.frames.length, 2, 'The GIF fixture must decode to two real frames.');
assert.notDeepEqual(Array.from(decodedGif.frames[0].rgba.slice(0, 4)), Array.from(decodedGif.frames[1].rgba.slice(0, 4)), 'Decoded GIF frames must contain different pixels.');
assert.throws(() => gifContext.window.GxaGifDecoder.decode(gifBytes.subarray(0, gifBytes.length - 2)), /ended unexpectedly|trailer marker|incomplete LZW/, 'Truncated GIF data must be rejected.');
const oversizedGifHeader = Uint8Array.from(gifBytes);
oversizedGifHeader[6] = 0xff;
oversizedGifHeader[7] = 0xff;
assert.throws(() => gifContext.window.GxaGifDecoder.decode(oversizedGifHeader), /dimensions/, 'Unsafe GIF dimensions must be rejected before frame allocation.');

const qpdf = await createQpdf({
  locateFile: () => join(root, 'node_modules', '@neslinesli93', 'qpdf-wasm', 'dist', 'qpdf.wasm'),
  noInitialRun: true,
  print() {},
  printErr() {}
});
const encrypted = await readFile(join(fixtures, 'encrypted-password.pdf'));
assert(encrypted.toString('latin1').includes('/Encrypt'), 'The PDF security fixture must be genuinely encrypted.');
qpdf.FS.writeFile('/encrypted.pdf', encrypted);
assert.equal(qpdf.callMain([`--password=${manifest.encryptedPdfPassword}`, '--decrypt', '/encrypted.pdf', '/decrypted.pdf']), 0, 'qpdf must unlock the fixture with the supplied password.');
const decrypted = Buffer.from(qpdf.FS.readFile('/decrypted.pdf'));
assert.equal(decrypted.subarray(0, 5).toString('latin1'), '%PDF-');
assert(!decrypted.toString('latin1').includes('/Encrypt'), 'The unlocked PDF output must not retain encryption.');
const plainPdf = await readFile(join(fixtures, 'one-page.pdf'));
qpdf.FS.writeFile('/plain.pdf', plainPdf);
assert.equal(qpdf.callMain(['--encrypt', 'browser-test', 'browser-test', '256', '--', '/plain.pdf', '/protected.pdf']), 0, 'qpdf must encrypt a real PDF fixture.');
const protectedPdf = Buffer.from(qpdf.FS.readFile('/protected.pdf'));
assert.equal(protectedPdf.subarray(0, 5).toString('latin1'), '%PDF-');
assert(protectedPdf.toString('latin1').includes('/Encrypt'), 'The protected PDF output must contain an encryption dictionary.');

const scanned = (await readFile(join(fixtures, 'scanned.pdf'))).toString('latin1');
assert(scanned.includes('/Subtype /Image'), 'The scanned fixture must contain a real raster image XObject.');
assert(!scanned.includes('GXA OCR FIXTURE 2026'), 'The OCR phrase must exist only in raster pixels, not as PDF text.');

console.log('Browser engine contract passed: 91 tools audited, 91 listing badges removed, 12 dependency blocks eliminated, and real engine fixtures validated.');
