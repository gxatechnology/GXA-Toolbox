import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import * as PDFLib from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';

const server = createQaServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|\/api\/|\/\.netlify\//, route => route.abort());
await cachePublicDependencies(context);
const page = await context.newPage(); page.setDefaultTimeout(180000);
const reference = 'GXA Toolbox browser OCR Private documents stay on your device';
const rows = [], errors = [];
const deadline = setTimeout(() => { errors.push('OCR suite exceeded its five-minute bound.'); void browser.close(); }, 300000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text().slice(0, 300)); });
page.on('requestfailed', request => console.log('Request failed:', request.url().split('?')[0], request.failure()?.errorText));
page.on('request', request => { if (/tesseract|traineddata|ocr-tools/.test(request.url())) console.log('OCR request:', request.url()); });
page.on('response', response => { if (/tesseract|traineddata|ocr-tools/.test(response.url())) console.log('OCR response:', response.status(), response.url()); });
const stagePoll = setInterval(() => { void page.evaluate(() => ({ stage: document.getElementById('processing-stage-label')?.textContent, worker: !!premiumEditorState.activeOcrWorker, engine: !!window.Tesseract })).then(x => console.log('OCR state', x)).catch(() => {}); }, 15000);
function wer(text) {
  const words = s => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  const a = words(reference), b = words(text);
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length] / a.length;
}
try {
  await page.goto(`${origin}/image-ocr/`);
  await page.waitForFunction(() => typeof runImageOCR === 'function' && !!window.GxaWorkspace);
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 180;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#d0d0d0'; ctx.fillRect(0, 0, 1000, 180); ctx.fillStyle = '#909090'; ctx.font = '36px Arial';
    ctx.fillText('GXA Toolbox browser OCR', 30, 65); ctx.fillText('Private documents stay on your device', 30, 125);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#file-picker').setInputFiles({ name: 'ocr-test.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  for (const mode of ['original', 'contrast', 'adaptive']) {
    console.log(`Starting actual OCR: ${mode}`);
    await page.selectOption('#opt-ocr-preprocess', mode);
    const result = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), x => x.charCodeAt(0));
      const start = performance.now();
      const result = await runImageOCR(new File([bytes], 'ocr-test.png', { type: 'image/png' }), 'eng');
      return { text: result.text, confidence: result.confidence, ms: performance.now() - start };
    }, data);
    rows.push({ id: 'image-ocr', mode, ...result, wordErrorRate: wer(result.text), scope: 'one synthetic low-contrast English fixture; no multilingual accuracy claim' });
    console.log(`${mode}: WER=${rows.at(-1).wordErrorRate}; confidence=${result.confidence}; ms=${result.ms.toFixed(0)}`);
    assert.ok(wer(result.text) <= 0.25, 'Unexpected recognition loss on controlled English fixture.');
  }
  const doc = await PDFLib.PDFDocument.create();
  const image = await doc.embedPng(Buffer.from(data, 'base64'));
  for (let i = 0; i < 2; i++) doc.addPage([500, 90]).drawImage(image, { x: 0, y: 0, width: 500, height: 90 });
  const pdf = Buffer.from(await doc.save());
  await page.goto(`${origin}/ocr-pdf/`);
  await page.waitForFunction(() => typeof runPDFOCR === 'function' && !!window.GxaWorkspace);
  await page.locator('#file-picker').setInputFiles({ name: 'scanned.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.selectOption('#opt-ocr-output', 'pdf');
  await page.locator('#btn-process-action').click();
  await page.waitForFunction(() => !document.getElementById('btn-download-result')?.disabled);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-download-result:visible').click()]);
  assert.match(download.suggestedFilename(), /_searchable\.pdf$/);
  const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const bytes = Buffer.concat(chunks), parsed = await PDFLib.PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 2);
  assert.deepEqual(parsed.getPage(0).getSize(), { width: 500, height: 90 });
  const text = await page.evaluate(async base64 => {
    const lib = await window.GxaWorkspace.ensurePdfJs();
    const pdf = await lib.getDocument({ data: Uint8Array.from(atob(base64), x => x.charCodeAt(0)) }).promise;
    const result = [];
    try { for (let i = 1; i <= pdf.numPages; i++) result.push((await (await pdf.getPage(i)).getTextContent()).items.map(x => x.str).join(' ')); }
    finally { await pdf.destroy(); }
    return result;
  }, bytes.toString('base64'));
  for (const pageText of text) assert.ok(wer(pageText) <= 0.25, 'Searchable PDF must contain real recognized text.');
  rows.push({ id: 'ocr-pdf', passed: true, pages: 2, dimensions: parsed.getPage(0).getSize(), perPageWER: text.map(wer), evidence: 'Real UI upload/process/download; PDFLib reopen plus independent PDF.js text extraction.' });
  await mkdir('test-results/advanced-engine', { recursive: true });
  await writeFile('test-results/advanced-engine/searchable-ocr.pdf', bytes);
} catch (error) { errors.push(error.stack); }
finally {
  clearTimeout(deadline);
  clearInterval(stagePoll);
  await mkdir('test-results/advanced-engine', { recursive: true });
  await writeFile('test-results/advanced-engine/ocr-results.json', JSON.stringify({ date: new Date().toISOString(), rows, errors, multilingual: 'NOT TESTED', physicalDevices: 'NOT TESTED' }, null, 2));
  await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
}
assert.deepEqual(errors, []);
