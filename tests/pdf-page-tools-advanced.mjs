import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import JSZip from 'jszip';
import { createEditPdfFixtures } from './fixtures/edit-pdf-fixtures.mjs';

const source = await readFile(new URL('../public_html/assets/app.js', import.meta.url), 'utf8');
const names = ['parsePdfPageSelection', 'parsePdfOrderedPages', 'loadPdfForPageCopy', 'planPdfSplit', 'runPDFSplit', 'runPDFOrganize'];
const parts = names.map(name => {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm')); assert.ok(start >= 0, name);
  const tail = source.slice(start), next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  return next < 0 ? tail : tail.slice(0, next + 1);
});
const appState = { activeFiles: [] };
const { runPDFSplit, runPDFOrganize, planPdfSplit, parsePdfOrderedPages } = new Function('PDFLib', 'JSZip', 'appState', 'Blob', parts.join('\n') + '\nreturn {' + names.join(',') + '};')(PDFLib, JSZip, appState, Blob);
const doc = await PDFLib.PDFDocument.create();
for (let i = 0; i < 5; i++) {
  const page = doc.addPage([301 + i, 450]);
  page.drawText(`SOURCE ${i + 1}`, { x: 20, y: 390 });
  page.setRotation(PDFLib.degrees([0, 90, 180, 270, 0][i]));
  page.setCropBox(10, 20, 280 + i, 410);
}
const file = new Blob([await doc.save()], { type: 'application/pdf' });
appState.activeFiles = [file];
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS ${name}`); }
async function unzip(mode, range, n, expected) {
  const blob = await runPDFSplit(mode, range, n);
  assert.equal(blob.type, 'application/zip');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
  assert.deepEqual(Object.keys(zip.files), expected.map((_, i) => `split_part_${i + 1}.pdf`));
  for (let i = 0; i < expected.length; i++) {
    const bytes = await zip.file(`split_part_${i + 1}.pdf`).async('uint8array');
    const reopened = await PDFLib.PDFDocument.load(bytes);
    assert.deepEqual(reopened.getPages().map(p => p.getWidth()), expected[i].map(n => 300 + n));
    for (let j = 0; j < expected[i].length; j++) {
      const original = doc.getPage(expected[i][j] - 1), actual = reopened.getPage(j);
      assert.deepEqual(actual.getCropBox(), original.getCropBox());
      assert.equal(actual.getRotation().angle, original.getRotation().angle);
      assert.ok(operators(reopened, j).includes(Buffer.from(`SOURCE ${expected[i][j]}`).toString('hex').toUpperCase()));
    }
  }
}
function operators(pdf, index) {
  const contents = pdf.getPage(index).node.Contents();
  if (!contents) return '';
  return (contents instanceof PDFLib.PDFArray ? contents.asArray() : [contents]).map(ref => Buffer.from(PDFLib.decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString('latin1')).join('\n');
}
async function organize(...args) {
  const blob = await runPDFOrganize(...args); assert.equal(blob.type, 'application/pdf');
  return PDFLib.PDFDocument.load(await blob.arrayBuffer());
}
await check('Split every page, every N including remainder, legacy ranges and noncontiguous/repeated groups; CRC, names, content, rotation and CropBox', async () => {
  await unzip('every', '', 2, [[1], [2], [3], [4], [5]]);
  await unzip('every-n', '', 2, [[1, 2], [3, 4], [5]]);
  await unzip('every-n', '', 5, [[1, 2, 3, 4, 5]]);
  await unzip('range', '1-2, 4-5, 1-2', 2, [[1, 2], [4, 5], [1, 2]]);
  await unzip('range', '3,1,1; 2-4', 2, [[3, 1, 1], [2, 3, 4]]);
});
await check('Split rejects unknown modes, empty/malformed/outside groups, fractional N and output limits', async () => {
  for (const [mode, range, n] of [['unknown', '1', 2], ['range', '', 2], ['range', '1;', 2], ['range', '1,,2', 2], ['range', '1;;2', 2], ['range', '6', 2], ['range', '3-1', 2], ['range', {}, 2], ['range', '1'.repeat(4001), 2], ['every-n', '', 1.2], ['every-n', '', 0], ['every-n', '', 501]]) await assert.rejects(runPDFSplit(mode, range, n));
  assert.throws(() => planPdfSplit('every', '', 2, 501), /500/);
  assert.throws(() => planPdfSplit('every-n', '', 1, 501), /500/);
  assert.throws(() => planPdfSplit('range', '1-2000,1', 2, 2000), /2,000/);
  assert.throws(() => planPdfSplit('range', '1-2000,1;2', 2, 2000), /2,000/);
  assert.throws(() => planPdfSplit('range', Array(501).fill('1').join(','), 2, 5), /500/);
  assert.throws(() => parsePdfOrderedPages('', 2001), /2,000/);
});
await check('Organize selected-source relative rotations, repeated pages, omissions, blank placement and one watermark per copy', async () => {
  const result = await organize('3,2,2,1', 90, 'REVIEW', 2, 2, '2');
  assert.deepEqual(result.getPages().map(p => p.getWidth()), [303, 302, 302, 302, 302, 301]);
  assert.deepEqual(result.getPages().map(p => p.getRotation().angle), [180, 180, 0, 0, 180, 0]);
  for (const index of [0, 1, 4, 5]) {
    assert.equal(operators(result, index).split(Buffer.from('REVIEW').toString('hex').toUpperCase()).length - 1, 1, 'Watermark painted once per copied page');
  }
  for (const index of [2, 3]) assert.equal(operators(result, index), '', 'Blank page has no source or watermark');
  assert.deepEqual(result.getPage(4).getCropBox(), doc.getPage(1).getCropBox());
  const all = await organize('', 90, '');
  assert.deepEqual(all.getPages().map(p => p.getRotation().angle), [90, 180, 270, 0, 90]);
  assert.deepEqual((await organize('5,1', 0, '', 1, 0)).getPages().map(p => p.getWidth()), [305, 305, 301]);
  assert.deepEqual((await organize('5,1', 0, '', 1, 2)).getPages().map(p => p.getWidth()), [305, 301, 301]);
});
await check('Organize does not silently coerce invalid blanks, rotation, page order or unsupported watermark text', async () => {
  for (const args of [['', 45, ''], ['', 0, '', -1], ['', 0, '', 1.5], ['', 0, '', 51], ['', 0, '', 1, -1], ['', 0, '', 1, 6], ['', 0, '', 1, 1.2], ['1,', 0, ''], ['', 0, '', 0, 0, '6'], ['', 0, 'हिन्दी'], ['', 0, 'x'.repeat(201)]]) await assert.rejects(runPDFOrganize(...args));
});
await check('Both page-copy tools reject missing, >25MB, corrupt, encrypted and live AcroForm/XFA sources', async () => {
  const fixtures = await createEditPdfFixtures();
  for (const name of ['fillable-form.pdf', 'xfa-form.pdf', 'encrypted.pdf', 'corrupt.pdf', 'empty.pdf']) {
    appState.activeFiles = [new Blob([fixtures[name]])];
    for (const run of [() => runPDFSplit('every', '', 2), () => runPDFOrganize('', 0, '')]) await assert.rejects(run(), name.includes('form') ? /live form fields/ : /could not be opened/);
  }
  appState.activeFiles = []; await assert.rejects(runPDFSplit('every', '', 2), /Choose a PDF/);
  await assert.rejects(runPDFOrganize('', 0, ''), /Choose a PDF/);
  appState.activeFiles = [{ size: 25 * 1024 * 1024 + 1, arrayBuffer() { throw new Error('Must not read oversized bytes'); } }];
  await assert.rejects(runPDFSplit('every', '', 2), /25 MB/);
  await assert.rejects(runPDFOrganize('', 0, ''), /25 MB/);
  appState.activeFiles = [file];
});
console.log(`Advanced Split/Organize: ${checks.length} grouped real-output/validation checks passed.`);
