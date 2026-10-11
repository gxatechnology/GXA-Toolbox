import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
await cachePublicDependencies(context);
const page = await context.newPage(); page.setDefaultTimeout(45000);
const browserErrors = [];
page.on('pageerror', error => { browserErrors.push(error.message); console.error('Browser error:', error.message); });
const out = resolve('test-results/ux-phase3'); await mkdir(out, { recursive: true });
const svg = '<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="400" fill="white"/><text x="60" y="180" font-size="64" fill="black">GXA FILE TEST</text></svg>';
const png = { name: 'ux-test.png', mimeType: 'image/png', buffer: await sharp(Buffer.from(svg)).png().toBuffer() };
const pdf = await PDFDocument.create(); pdf.addPage([300, 400]).drawText('GXA PDF test', { x: 30, y: 300 });
const pdfFile = { name: 'ux-test.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) };
const rows = [];
async function open(id) {
  assert.equal((await page.goto(`${origin}/${id}/`, { waitUntil: 'domcontentloaded' })).status(), 200);
  await page.waitForFunction(() => typeof window.navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
  if (id === 'image-converter') await page.waitForSelector('.image-converter__grid');
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => { GxaToolUx.sync(); done(); })));
}
async function download(selector, id) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator(selector).first().click()]);
  assert.equal(await file.failure(), null); await file.saveAs(resolve(out, `${id}-${file.suggestedFilename()}`));
}
try {
  const representatives = ['crop-image', 'resize-image', 'compress-image', 'image-converter', 'jpg-to-pdf', 'image-to-pdf', 'merge-pdf', 'pdf-to-jpg', 'image-ocr'];
  for (const id of representatives) {
    await open(id);
    assert.equal(await page.locator('[data-disclosure]').getAttribute('data-disclosure'), 'upload', id);
    for (const width of [320, 360, 375, 390, 412, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${id} ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (['crop-image', 'resize-image', 'image-converter'].includes(id)) {
      await page.locator('#crop-file-picker, #file-picker, .image-converter__input').first().setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('Not an image') });
      if (id === 'image-converter') await page.locator('.image-converter__status.is-error').waitFor({ state: 'visible' });
      await page.evaluate(() => GxaToolUx.sync());
      assert.equal(await page.locator('[data-disclosure]').getAttribute('data-disclosure'), 'upload', `${id} must not reveal settings for rejected input`);
    }
    const choose = page.locator('#tool-upload-mount button, #crop-upload-state button, .image-converter__choose').first();
    await choose.focus(); assert.ok(await choose.evaluate(el => el === document.activeElement));
    const [picker] = await Promise.all([page.waitForEvent('filechooser'), choose.press('Enter')]);
    const input = id.includes('merge') || id === 'pdf-to-jpg' ? pdfFile : png;
    await picker.setFiles(input);
    await page.waitForFunction(() => document.querySelector('[data-disclosure]')?.dataset.disclosure === 'ready');
    const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().width && e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(e => ({ tag: e.tagName, id: e.id, className: e.className, right: e.getBoundingClientRect().right })));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${id} selected ${JSON.stringify(overflow)}`);
    for (const width of [320, 360, 375, 390, 412, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${id} selected at ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (id === 'crop-image') {
      await page.locator('#crop-apply-button').click();
      await page.locator('#crop-result-panel').waitFor({ state: 'visible' });
      await download('#crop-mobile-download-button:visible, #crop-download-button:visible', id);
      await page.evaluate(() => resetCropImageTool());
    } else if (id === 'image-converter') {
      await page.locator('.image-converter__convert').click();
      await page.locator('.image-converter__result').waitFor({ state: 'visible' });
      await download('.image-converter__download', id);
      await page.locator('.image-converter__reset').click();
    } else {
      if (id === 'resize-image') await page.evaluate(() => {
        const scale = document.getElementById('opt-resize-percent');
        scale.value = '50'; scale.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('#btn-process-action').click();
      await page.waitForFunction(() => !document.getElementById('btn-download-result')?.disabled, { }, { timeout: 180000 });
      await download('#btn-mobile-download-result:visible, #btn-download-result:visible', id);
      await page.evaluate(() => resetActiveTool());
    }
    await page.waitForFunction(() => document.querySelector('[data-disclosure]')?.dataset.disclosure === 'upload');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(out, `${id}-upload.png`), fullPage: false });
    rows.push({ id, flow: 'upload/process/download/reset passed' }); console.log(`${id}: real flow passed`);
  }
  const inventory = [];
  for (const tool of await loadToolRegistry()) {
    if (tool.id === 'background-remover') { inventory.push({ id: tool.id, ux: 'dedicated React editor unchanged' }); continue; }
    await page.evaluate(id => navigate('tool-' + id), tool.id);
    // SPA navigation changes history, not the document's load lifecycle.
    await page.waitForFunction(expected => location.href === expected, `${origin}/${tool.id}/`);
    await page.waitForFunction(id => typeof appState !== 'undefined' && appState.currentPage === 'tool-' + id && !document.querySelector('[data-static-route-shell]') && document.querySelector('.tool-container'), tool.id);
    if (tool.id === 'image-converter') await page.waitForSelector('.image-converter__grid');
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => { GxaToolUx.sync(); done(); })));
    const ux = await page.locator('[data-disclosure]').count() ? 'upload-first' : 'existing generator or dedicated editor';
    inventory.push({ id: tool.id, ux });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.tool-ad-placement')].some(e => e.getBoundingClientRect().height > 0)), false, `${tool.id} empty ads`);
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  await noJs.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
  const staticPage = await noJs.newPage(); await staticPage.goto(`${origin}/crop-image/`);
  assert.ok((await staticPage.locator('h1').innerText()).includes('Crop'));
  assert.ok((await staticPage.locator('body').innerText()).includes('How to Use')); await noJs.close();
  assert.deepEqual(browserErrors, [], 'Unexpected browser runtime errors');
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ rows, inventory }, null, 2));
  console.log(`Phase 3 passed: ${rows.length} real flows; ${inventory.filter(r => r.ux === 'upload-first').length} upload-first routes; 95-route inventory, empty ads, keyboard picker and no-JS content.`);
} finally { await context.close(); await browser.close(); await new Promise(done => server.close(done)); }
