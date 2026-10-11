import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import JSZip from 'jszip';

const source = await readFile(new URL('../../public_html/assets/app.js', import.meta.url), 'utf8');
const context = { PDFLib, JSZip, Blob, Uint8Array, ArrayBuffer, appState: { activeFiles: [], activeToolOptions: {} } };
context.window = context;
const sources = [];
const functions = ['parsePdfPageSelection', 'parsePdfOrderedPages', 'loadPdfForPageCopy', 'planPdfSplit', 'resolveOptionalPdfPageSelection', 'runPDFMerge', 'runPDFOrganize', 'runPDFSplit', 'runPDFRotate', 'runPDFCrop', 'runPDFRemovePages', 'runPDFExtractPages', 'runPDFMetadataEdit', 'runPDFPageNumbers', 'runPDFHeaderFooter', 'runPDFRepair', 'runPDFSign', 'watermarkPdfColor', 'watermarkPdfFontName', 'watermarkPdfPlacement', 'createPdfWatermarkDrawable', 'drawTiledPdfWatermark', 'runPDFWatermark', 'createTextPdf'];
for (const name of functions) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm')); assert.ok(start >= 0, name);
  const tail = source.slice(start); const next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  sources.push(next < 0 ? tail : tail.slice(0, next + 1));
}
// Same realm as pdf-lib: its argument guards use instanceof Array.
Object.assign(context, new Function(...Object.keys(context), `${sources.join('\n')}\nreturn { ${functions.join(',')} };`)(...Object.values(context)));
const original = await PDFLib.PDFDocument.create();
for (let i = 1; i <= 5; i++) original.addPage([300 + i, 400]).drawText(`PAGE ${i}`, { x: 20, y: 200 });
const file = Object.assign(new Blob([await original.save()], { type: 'application/pdf' }), { name: 'source.pdf' });
context.appState.activeFiles = [file];
async function reopen(blob, widths) {
  assert.equal(blob.type, 'application/pdf'); const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.deepEqual(doc.getPages().map(page => page.getWidth()), widths);
  return doc;
}
function operators(doc, page = 0) {
  const contents = doc.getPage(page).node.Contents();
  return (contents instanceof PDFLib.PDFArray ? contents.asArray() : [contents]).map(ref => Buffer.from(PDFLib.decodePDFRawStream(doc.context.lookup(ref)).decode()).toString('latin1')).join('\n');
}
const widths = [301, 302, 303, 304, 305];
const results = [];
async function check(name, callback) {
  try { await callback(); results.push(true); console.log(`PASS ${name}`); }
  catch (error) { results.push(false); console.error(`FAIL ${name}: ${error.message.slice(0, 500)}`); }
}
await check('Merge preserves two documents and page order', async () => { context.appState.activeFiles = [file, file]; await reopen(await context.runPDFMerge(), [...widths, ...widths]); context.appState.activeFiles = [file]; });
await check('Organize reorders, duplicates, rotates and adds a blank', async () => { const doc = await reopen(await context.runPDFOrganize('5,1,1', 90, '', 1, 1), [305, 305, 301, 301]); assert.equal(doc.getPage(0).getRotation().angle, 90); });
await check('Organize rejects invalid/out-of-range pages without silently dropping them', async () => { for (const range of ['999', '1,999', '3-1', '1-0', 'x', '1,']) await assert.rejects(context.runPDFOrganize(range, 0, '')); });
await check('Split archive reopens with correct page grouping', async () => {
  const zip = await JSZip.loadAsync(await (await context.runPDFSplit('every-n', '', 2)).arrayBuffer(), { checkCRC32: true });
  const entries = Object.values(zip.files); assert.equal(entries.length, 3);
  for (let i = 0; i < entries.length; i++) await reopen(new Blob([await entries[i].async('uint8array')], { type: 'application/pdf' }), widths.slice(i * 2, i * 2 + 2));
  await assert.rejects(context.runPDFSplit('range', '9')); await assert.rejects(context.runPDFSplit('every-n', '', 0));
});
await check('Rotate only selected pages', async () => { const doc = await reopen(await context.runPDFRotate(file, 90, '2,4'), widths); assert.deepEqual(doc.getPages().map(page => page.getRotation().angle), [0, 90, 0, 90, 0]); });
await check('Crop writes crop box and preserves other pages', async () => { const doc = await reopen(await context.runPDFCrop(file, 10, 20, 30, 40, '1'), widths); assert.deepEqual(doc.getPage(0).getCropBox(), { x: 30, y: 20, width: 231, height: 370 }); assert.equal(doc.getPage(1).getCropBox().width, 302); });
await check('Crop rejects negative, nonfinite and excessive margins', async () => { for (const margin of [-1, NaN, Infinity, 1000]) await assert.rejects(context.runPDFCrop(file, margin, 0, 0, 0)); });
await check('Remove and extract preserve selected content and reject removing all', async () => {
  await reopen(await context.runPDFRemovePages(file, '2,4'), [301, 303, 305]);
  await reopen(await context.runPDFExtractPages(file, '5,2'), [305, 302]);
  await assert.rejects(context.runPDFRemovePages(file, '1-5'));
});
await check('Metadata Unicode round-trip', async () => { const doc = await reopen(await context.runPDFMetadataEdit(file, 'हिन्दी title', 'François', 'Subject', 'one,two'), widths); assert.equal(doc.getTitle(), 'हिन्दी title'); assert.equal(doc.getAuthor(), 'François'); });
await check('Page number and header/footer operators persist', async () => {
  const numbered = await reopen(await context.runPDFPageNumbers(file, 'bottom-right'), widths); assert.ok(operators(numbered).includes(Buffer.from('Page 1').toString('hex').toUpperCase()));
  const header = await reopen(await context.runPDFHeaderFooter(file, 'Header [page]', 'Footer [total]', 'left'), widths); assert.ok(operators(header, 4).includes(Buffer.from('Header 5').toString('hex').toUpperCase()));
});
await check('Watermark persists only on selected page', async () => {
  const settings = { type: 'text', text: 'CONFIDENTIAL', font: 'helvetica', bold: false, fontSize: 20, letterSpacing: 0, opacity: 0.5, rotation: 0, color: '#334155', position: 'center' };
  const doc = await reopen(await context.runPDFWatermark(file, settings, '2'), widths);
  const mark = Buffer.from(settings.text).toString('hex').toUpperCase(); assert.ok(operators(doc, 1).includes(mark)); assert.ok(!operators(doc, 0).includes(mark));
});
await check('Signature appearance persists (not a digital certificate)', async () => { const doc = await reopen(await context.runPDFSign(file, 'Test signer', 'black'), widths); assert.ok(operators(doc, 4).includes(Buffer.from('Test signer').toString('hex').toUpperCase())); });
await check('Repair rewrites parseable PDF and rejects irrecoverable bytes', async () => { await reopen(await context.runPDFRepair(file), widths); await assert.rejects(context.runPDFRepair(new Blob(['not a PDF']))); });
await check('Corrupt input rejected by PDF operations', async () => {
  const bad = new Blob(['%PDF-invalid']);
  for (const [name, args] of [['runPDFRotate', [90]], ['runPDFCrop', [1, 1, 1, 1]], ['runPDFExtractPages', ['1']], ['runPDFMetadataEdit', ['title', 'author']]]) await assert.rejects(context[name](bad, ...args));
});
await check('Shared text PDF wraps unbroken tokens without losing characters', async () => {
  const output = await context.createTextPdf('X'.repeat(800));
  const doc = await PDFLib.PDFDocument.load(await output.arrayBuffer());
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const runs = [...operators(doc).matchAll(/<([0-9A-F]+)>\s*Tj/g)].map(match => Buffer.from(match[1], 'hex').toString('latin1'));
  assert.equal(runs.join(''), 'X'.repeat(800));
  for (const run of runs) assert.ok(font.widthOfTextAtSize(run, 11) <= 595.28 - 96);
});
console.log(`${results.filter(Boolean).length}/${results.length} real PDF engine/output checks passed. UI/download/browser checks are separate.`);
if (results.includes(false)) process.exitCode = 1;
