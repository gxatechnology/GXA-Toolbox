import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import JSZip from 'jszip';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
const server = createQaServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|\/api\/|\/\.netlify\//, route => route.abort());
await cachePublicDependencies(context);
const page = await context.newPage(); page.setDefaultTimeout(30000);
const rows = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const png = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#ff0000' } }).png().toBuffer();
const doc = await PDFDocument.create();
doc.addPage([200, 300]).drawImage(await doc.embedPng(png), { x: 20, y: 30, width: 32, height: 24 });
const pdf = Buffer.from(await doc.save());
async function open(id) { await page.goto(`${origin}/${id}/`); await page.waitForFunction(() => !!window.GxaWorkspace && !document.querySelector('[data-static-route-shell]')); }
const input = (bytes, name, type) => ({ base64: bytes.toString('base64'), name, type });
async function invoke(name, files, args = [], fileArgument = false) {
  return page.evaluate(async ({ name, files, args, fileArgument }) => {
    const inputs = files.map(f => new File([Uint8Array.from(atob(f.base64), c => c.charCodeAt(0))], f.name, { type: f.type }));
    appState.activeFiles = inputs; premiumEditorState.batchCancelled = false;
    const result = await window[name](...(fileArgument ? [inputs[0], ...args] : args));
    if (!(result instanceof Blob)) return { value: result };
    const bytes = new Uint8Array(await result.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { base64: btoa(binary), mime: result.type };
  }, { name, files, args, fileArgument });
}
async function check(id, fn) {
  const start = performance.now();
  try { await open(id); await fn(); rows.push({ id, passed: true, ms: performance.now() - start, scope: 'actual Chromium engine with synthetic input; not complete interaction/cancellation QA' }); }
  catch (error) { rows.push({ id, passed: false, error: error.message }); }
  console.log(id, rows.at(-1).passed ? 'PASS' : rows.at(-1).error);
}
try {
  let protectedBytes;
  await check('protect-pdf', async () => {
    const r = await invoke('runPDFProtect', [input(pdf, 'input.pdf', 'application/pdf')], ['local-test-password']);
    protectedBytes = Buffer.from(r.base64, 'base64');
    assert.match(protectedBytes.toString('latin1'), /\/Encrypt/);
    await assert.rejects(PDFDocument.load(protectedBytes), /encrypted/i);
  });
  await check('unlock-pdf', async () => {
    assert.ok(protectedBytes);
    const files = [input(protectedBytes, 'encrypted.pdf', 'application/pdf')];
    await assert.rejects(invoke('runPDFUnlock', files, ['wrong-password']));
    const r = await invoke('runPDFUnlock', files, ['local-test-password']);
    assert.equal((await PDFDocument.load(Buffer.from(r.base64, 'base64'))).getPageCount(), 1);
  });
  await check('gif-maker', async () => {
    const r = await invoke('runGIFMaker', [input(png, 'a.png', 'image/png'), input(png, 'b.png', 'image/png')], [200]);
    const bytes = Buffer.from(r.base64, 'base64'), meta = await sharp(bytes, { animated: true }).metadata();
    assert.equal(meta.pages, 2); assert.deepEqual(meta.delay, [200, 200]); await sharp(bytes, { animated: true }).raw().toBuffer();
  });
  await check('color-extractor', async () => {
    const r = await invoke('runColorExtraction', [input(png, 'red.png', 'image/png')], [3], true);
    assert.ok(r.value.some(color => color.toLowerCase() === '#ff0000'));
    const transparent = await sharp({ create: { width: 16, height: 16, channels: 4, background: '#00000000' } }).png().toBuffer();
    await assert.rejects(invoke('runColorExtraction', [input(transparent, 'empty.png', 'image/png')], [3], true), /no visible pixels/);
    await assert.rejects(invoke('runColorExtraction', [input(Buffer.from('broken'), 'bad.png', 'image/png')], [3], true), /corrupt|decode|unsupported|invalid/i);
  });
  await check('exif-viewer', async () => {
    const r = await invoke('runExifViewer', [input(png, 'red.png', 'image/png')], [], true);
    assert.equal(r.value['Image Dimensions'], '32 × 24 px'); assert.equal(r.value['File Name'], 'red.png');
  });
  await check('png-to-pdf', async () => {
    const r = await invoke('runJPGToPDF', [input(png, 'red.png', 'image/png')], ['A4', 'portrait']);
    assert.equal((await PDFDocument.load(Buffer.from(r.base64, 'base64'))).getPageCount(), 1);
  });
  for (const id of ['pdf-to-image', 'pdf-to-png', 'extract-images-pdf']) await check(id, async () => {
    const r = await invoke(id === 'extract-images-pdf' ? 'runPDFExtractImages' : 'runPDFToJPG', [input(pdf, 'input.pdf', 'application/pdf')], id === 'extract-images-pdf' ? [] : ['png'], id === 'extract-images-pdf');
    const bytes = Buffer.from(r.base64, 'base64');
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    const images = Object.values(zip.files).filter(file => /\.png$/i.test(file.name)); assert.equal(images.length, 1);
    await sharp(await images[0].async('nodebuffer')).raw().toBuffer();
  });
  await check('case-converter', async () => {
    await page.locator('#opt-case-text').fill('Hello WORLD'); await page.selectOption('#opt-case-type', 'lower');
    await page.evaluate(() => generateCaseConvert()); assert.equal(await page.locator('#generated-case-display').inputValue(), 'hello world');
  });
  await check('word-counter', async () => {
    const r = await page.evaluate(() => runWordCounter(null, 'One two. Three!'));
    assert.deepEqual(r, { chars: 15, words: 3, sentences: 2, time: 1 });
  });
  await check('user-agent', async () => {
    const ua = await page.evaluate(() => navigator.userAgent);
    assert.ok((await page.locator('#generator-preview-mount').innerText()).includes(ua));
  });
  await check('color-converter', async () => {
    await page.locator('#opt-color-val').fill('#ff0000'); await page.evaluate(() => generateColorConvert());
    assert.match(await page.locator('#generator-preview-mount').innerText(), /255, 0, 0/);
  });
  await open('text-to-speech');
  rows.push({ id: 'text-to-speech', passed: null, status: 'NOT TESTED', scope: 'API presence is not audible speech verification; no physical audio check performed.', availableVoices: await page.evaluate(() => window.speechSynthesis?.getVoices().length ?? 0) });
} finally {
  await mkdir('test-results/advanced-engine', { recursive: true });
  await writeFile('test-results/advanced-engine/remaining-results.json', JSON.stringify({ rows, errors }, null, 2));
  await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
}
assert.deepEqual(errors, []); assert.ok(rows.every(row => row.passed !== false), JSON.stringify(rows.filter(row => row.passed === false)));
