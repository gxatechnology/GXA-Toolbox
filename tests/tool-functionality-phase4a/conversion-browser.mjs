import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import * as PDFLib from 'pdf-lib';
import JSZip from 'jszip';
import { createQaServer } from '../browser-qa-server.mjs';
import { cachePublicDependencies } from './cache-public-dependencies.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
await cachePublicDependencies(context);
const page = await context.newPage(); page.setDefaultTimeout(60000);
const out = resolve('test-results/tool-functionality-phase4a/conversions'); await mkdir(out, { recursive: true });
const results = [];
async function fixture(name, type) { return { name, type, base64: (await readFile(resolve('tests/fixtures', name))).toString('base64') }; }
const pdf = await PDFLib.PDFDocument.create();
for (let i = 1; i <= 3; i++) pdf.addPage([300, 400]).drawText(`SENTINEL PAGE ${i}`, { x: 20, y: 200 });
const pdfInput = { name: 'sentinel.pdf', type: 'application/pdf', base64: Buffer.from(await pdf.save()).toString('base64') };
async function invoke(name, input, args = [], activeOnly = false) {
  const output = await page.evaluate(async ({ name, input, args, activeOnly }) => {
    const files = (Array.isArray(input) ? input : [input]).map(item => new File([Uint8Array.from(atob(item.base64), char => char.charCodeAt(0))], item.name, { type: item.type }));
    appState.activeFiles = files; appState.activeToolOptions = {}; premiumEditorState.batchCancelled = false;
    let timer;
    try {
      const result = await Promise.race([window[name](...(activeOnly ? args : [files[0], ...args])), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Engine did not settle within 30 seconds')), 30000); })]);
      const blob = name === 'runPPTToPDF' ? result.blob : result;
      if (!(blob instanceof Blob)) throw new Error('Engine did not return a real file Blob');
      return { mime: blob.type, base64: await new Promise((done, reject) => { const reader = new FileReader(); reader.onload = () => done(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); }) };
    } catch (error) { return { error: error.message }; }
    finally { clearTimeout(timer); }
  }, { name, input, args, activeOnly });
  if (output.error) throw new Error(output.error);
  return { bytes: Buffer.from(output.base64, 'base64'), mime: output.mime };
}
async function check(id, callback) {
  try { await callback(); results.push({ id, passed: true }); console.log(`PASS conversion engine ${id}`); }
  catch (error) { results.push({ id, passed: false, error: error.message }); console.error(`FAIL ${id}: ${error.message}`); }
}
async function pdfResult(id, output, minimumPages = 1) {
  assert.equal(output.mime, 'application/pdf'); assert.equal(output.bytes.subarray(0, 5).toString(), '%PDF-');
  const doc = await PDFLib.PDFDocument.load(output.bytes); assert.ok(doc.getPageCount() >= minimumPages);
  await writeFile(resolve(out, `${id}.pdf`), output.bytes); return doc;
}
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/merge-pdf/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof runPDFToText === 'function' && !!window.PDFLib && !!window.JSZip && !!window.GxaWorkspace);
  for (const [id, name, mime] of [['pdf-to-text', 'runPDFToText', 'text/plain'], ['pdf-to-html', 'runPDFToHtml', 'text/html'], ['pdf-to-markdown', 'runPDFToMarkdown', 'text/markdown']]) await check(id, async () => {
    const output = await invoke(name, pdfInput); assert.ok(output.mime.startsWith(mime)); const text = output.bytes.toString('utf8');
    for (let i = 1; i <= 3; i++) assert.ok(text.includes(`SENTINEL PAGE ${i}`)); await writeFile(resolve(out, `${id}.txt`), output.bytes);
  });
  await check('pdf-to-word', async () => { const output = await invoke('runPDFToWord', pdfInput, ['rtf'], true); assert.equal(output.mime, 'application/rtf'); assert.match(output.bytes.toString(), /^\{\\rtf1/); assert.match(output.bytes.toString(), /SENTINEL PAGE 3/); });
  for (const [id, name, args, expected, active] of [['pdf-to-epub', 'runPDFToEPUB', ['Test', 'Test'], 'EPUB/chapter-003.xhtml', true], ['pdf-to-excel', 'runPDFToExcel', [], 'xl/worksheets/sheet3.xml', false], ['pdf-to-ppt', 'runPDFToPPT', [], 'ppt/slides/slide3.xml', false]]) await check(id, async () => {
    const output = await invoke(name, pdfInput, args, active); const zip = await JSZip.loadAsync(output.bytes, { checkCRC32: true }); assert.ok(zip.file(expected));
    if (id === 'pdf-to-epub') assert.match(await zip.file(expected).async('string'), /SENTINEL PAGE 3/);
    if (id === 'pdf-to-ppt') assert.ok(Object.keys(zip.files).some(name => name.startsWith('ppt/media/')));
    await writeFile(resolve(out, `${id}.${id.split('-').at(-1) === 'excel' ? 'xlsx' : id.endsWith('ppt') ? 'pptx' : 'epub'}`), output.bytes);
  });
  for (const [id, name, file, type, args, active] of [
    ['word-to-pdf', 'runWordToPDF', 'sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['Helvetica'], true],
    ['txt-to-pdf', 'runWordToPDF', 'sample.txt', 'text/plain', ['Helvetica'], true],
    ['excel-to-pdf', 'runExcelToPDF', 'sample.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['Helvetica'], false],
    ['epub-to-pdf', 'runEPUBToPDF', 'sample.epub', 'application/epub+zip', [], true],
    ['ppt-to-pdf', 'runPPTToPDF', 'sample.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', [], false]
  ]) await check(id, async () => pdfResult(id, await invoke(name, await fixture(file, type), args, active)));
  await check('markdown-to-pdf', async () => {
    const text = '# Heading\n' + Array.from({ length: 120 }, (_, i) => `Paragraph ${i} ` + 'word '.repeat(30)).join('\n') + '\nFINAL_SENTINEL';
    const doc = await pdfResult('markdown-to-pdf', await invoke('runMarkdownToPDF', { name: 'long.md', type: 'text/markdown', base64: Buffer.from(text).toString('base64') }), 3);
    const page = doc.getPages().at(-1), content = page.node.Contents();
    const operators = (content instanceof PDFLib.PDFArray ? content.asArray() : [content]).map(ref => Buffer.from(PDFLib.decodePDFRawStream(doc.context.lookup(ref)).decode()).toString('latin1')).join('');
    assert.ok(operators.includes(Buffer.from('FINAL_SENTINEL').toString('hex').toUpperCase()));
  });
  await check('svg-to-png', async () => { const output = await invoke('runSvgToPng', await fixture('sample.svg', 'image/svg+xml'), [320]); assert.equal(output.mime, 'image/png'); const image = sharp(output.bytes); assert.equal((await image.metadata()).width, 320); await image.raw().toBuffer(); });
  await check('svg-to-png-invalid', async () => { await assert.rejects(invoke('runSvgToPng', { name: 'bad.svg', type: 'image/svg+xml', base64: Buffer.from('broken svg').toString('base64') }, [320]), /corrupt|invalid|unsupported|read|decoded/i); });
  await check('png-to-svg', async () => { const output = await invoke('runPngToSvg', await fixture('transparent.png', 'image/png')); assert.equal(output.mime, 'image/svg+xml'); assert.match(output.bytes.toString(), /<path\b/); assert.doesNotMatch(output.bytes.toString(), /<image\b/); await sharp(output.bytes).png().toBuffer(); });
  await check('webp-to-jpg', async () => { const output = await invoke('runWebpToJpg', await fixture('sample.webp', 'image/webp'), ['jpg']); assert.equal(output.mime, 'image/jpeg'); assert.equal((await sharp(output.bytes).metadata()).format, 'jpeg'); await sharp(output.bytes).raw().toBuffer(); });
  await check('gif-to-png', async () => { const output = await invoke('runGifToPng', await fixture('sample.gif', 'image/gif')); const zip = await JSZip.loadAsync(output.bytes, { checkCRC32: true }); const frames = Object.values(zip.files).filter(file => file.name.endsWith('.png')); assert.ok(frames.length); for (const frame of frames) await sharp(await frame.async('nodebuffer')).raw().toBuffer(); assert.ok(zip.file('frames.json')); });
} finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
assert.ok(results.every(row => row.passed), JSON.stringify(results.filter(row => !row.passed)));
console.log(`${results.length} browser engine/output cases passed; these do not certify every route's upload/download UI.`);
