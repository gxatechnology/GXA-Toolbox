import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as PDFLib from 'pdf-lib';
import JSZip from 'jszip';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
const page = await context.newPage(); page.setDefaultTimeout(30000);
const out = resolve('test-results/pdf-page-tools-advanced'); await mkdir(out, { recursive: true });
const checks = [], failures = [];
page.on('pageerror', error => failures.push(error.message));
async function fixture(count) {
  const doc = await PDFLib.PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const p = doc.addPage([301 + i, 450]); p.drawText(`Source page ${i + 1}`, { x: 20, y: 390, size: 16 });
    if (i === 1) p.setRotation(PDFLib.degrees(90));
  }
  return { name: 'source.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) };
}
async function open(route, input) {
  await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`, { waitUntil: 'domcontentloaded' });
  // Actual user-facing Choose Files control opens the native picker hook.
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Select file', exact: true }).tap()]);
  await chooser.setFiles(input);
  await page.waitForSelector('.pdf-canvas-wrap[data-current-pdf-page]');
}
async function processDownload(name) {
  const adjust = page.getByRole('button', { name: 'Adjust settings', exact: true });
  if (await adjust.isVisible()) await adjust.click();
  await page.locator('#btn-process-action').click();
  await page.waitForFunction(() => !document.getElementById('btn-download-result').disabled);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-mobile-download-result:visible, #btn-download-result:visible').first().click()]);
  assert.equal(await download.failure(), null);
  const path = resolve(out, name); await download.saveAs(path);
  return { bytes: await readFile(path), name: download.suggestedFilename() };
}
async function verifyZip(download, widths) {
  assert.match(download.name, /\.zip$/i);
  const zip = await JSZip.loadAsync(download.bytes, { checkCRC32: true });
  assert.equal(Object.keys(zip.files).length, widths.length);
  for (let i = 0; i < widths.length; i++) {
    const doc = await PDFLib.PDFDocument.load(await zip.file(`split_part_${i + 1}.pdf`).async('uint8array'));
    assert.deepEqual(doc.getPages().map(p => p.getWidth()), widths[i]);
  }
}
async function widthSweep(route) {
  await page.getByRole('button', { name: 'Adjust settings', exact: true }).click();
  for (const width of [320, 360, 375, 390, 412, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1100) await page.waitForFunction(() => getComputedStyle(document.querySelector('.header-nav .nav-menu')).visibility === 'hidden');
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.ok(await page.locator('#btn-process-action').isVisible());
    assert.ok(await page.locator('.tool-options-panel .preset-btn').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44)), 'Mode/rotation buttons retain 44px touch height');
    assert.equal(await page.locator('.gxa-ad-network').count(), 1, 'Existing eligible editorial slot remains present');
    const emptyAds = await page.locator('.gxa-ad-network').evaluateAll(elements => elements.every(el => el.dataset.adState !== 'mounted' && el.getBoundingClientRect().height === 0));
    assert.ok(emptyAds, 'Unfilled ads must stay collapsed');
    checks.push(`${route}: populated ${width}px layout, visible processing, no body overflow or empty ad gap`);
  }
}
try {
  const input = await fixture(5);
  await open('split-pdf', input);
  await page.locator('#file-picker').setInputFiles({ name: 'oversized.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(25 * 1024 * 1024 + 1) });
  assert.equal(await page.evaluate(() => appState.activeFiles[0].name), 'source.pdf', 'Oversized input is rejected before replacing/previewing the accepted PDF');
  assert.match(await page.locator('#toast-container').innerText(), /25.*MB/);
  assert.equal(await page.locator('.pdf-output-plan li').count(), 5);
  await verifyZip(await processDownload('every-page.zip'), [[301], [302], [303], [304], [305]]);
  await page.getByRole('button', { name: 'Every N pages', exact: true }).click();
  await page.locator('#opt-split-every-n').fill('2');
  assert.equal(await page.locator('.pdf-output-plan li').count(), 3);
  await verifyZip(await processDownload('every-two.zip'), [[301, 302], [303, 304], [305]]);
  await page.getByRole('button', { name: 'Custom ranges', exact: true }).click();
  await page.getByRole('button', { name: 'Adjust settings', exact: true }).click();
  await page.locator('#opt-split-range').fill('3,1,1;2-4');
  assert.equal(await page.locator('.pdf-output-plan li').count(), 2);
  assert.match(await page.locator('.pdf-output-plan li').first().innerText(), /pages 3, 1, 1/);
  await page.locator('.pdf-output-plan button').first().tap();
  await page.waitForFunction(() => document.querySelector('.pdf-canvas-wrap').dataset.currentPdfPage === '3');
  await verifyZip(await processDownload('custom-groups.zip'), [[303, 301, 301], [302, 303, 304]]);
  checks.push('Three split modes: real downloads/ZIP CRC/reopened PDFs match plan; tap plan inspects first source page');
  await widthSweep('Split PDF');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.header-nav .nav-menu')).visibility === 'hidden');
  await page.locator('.pdf-output-plan').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('#toast-container .toast'));
  await page.screenshot({ path: resolve(out, 'split-plan-mobile.png') });
  await page.locator('#opt-split-range').fill('1;');
  await page.locator('#btn-process-action').tap();
  await page.waitForFunction(() => document.body.dataset.gxaLastProcessingError?.includes('empty'));
  assert.ok(await page.locator('#btn-download-result').isDisabled());
  assert.match(await page.locator('.pdf-output-plan [role="status"]').innerText(), /empty/);
  await page.locator('#opt-split-range').fill('1-2,4-5');
  await verifyZip(await processDownload('corrected-ranges.zip'), [[301, 302], [304, 305]]);
  await page.getByRole('button', { name: 'Start Over', exact: true }).first().tap();
  assert.equal(await page.evaluate(() => appState.activeFiles.length), 0);
  await page.waitForFunction(() => !document.querySelector('.pdf-output-plan'));
  assert.equal(await page.locator('#opt-split-range').inputValue(), '');
  assert.equal(await page.locator('[data-split-mode="every"]').getAttribute('aria-pressed'), 'true');
  checks.push('Split invalid group blocks download, accessible plan error, correction retries, reset removes files and plan');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await open('organize-pdf', await fixture(61));
  assert.equal(await page.locator('.pdf-thumbnail-button').count(), 60);
  const first = page.locator('.pdf-thumbnail-button[data-page="1"]');
  await first.focus(); await page.keyboard.press('Alt+ArrowRight');
  const order = await page.locator('#opt-range').inputValue();
  assert.equal(order.split(',').length, 61); assert.ok(order.startsWith('2, 1, 3')); assert.ok(order.endsWith('61'));
  let download = await processDownload('organized-61-pages.pdf');
  assert.match(download.name, /\.pdf$/i);
  let result = await PDFLib.PDFDocument.load(download.bytes);
  assert.equal(result.getPageCount(), 61); assert.deepEqual(result.getPages().slice(0, 3).map(p => p.getWidth()), [302, 301, 303]);
  assert.equal(result.getPage(60).getWidth(), 361);
  checks.push('Keyboard reorder with 60-thumbnail cap retains all 61 source pages in downloaded PDF');
  await page.locator('#opt-range').fill('3,2,2,1');
  await page.getByRole('button', { name: '90°', exact: true }).click();
  await page.locator('#opt-organize-rotate-pages').fill('2');
  await page.locator('#opt-organize-blank-count').fill('1');
  await page.locator('#opt-organize-blank-after').fill('2');
  await page.locator('#opt-watermark').fill('REVIEW');
  download = await processDownload('organized-selected-pages.pdf'); result = await PDFLib.PDFDocument.load(download.bytes);
  assert.deepEqual(result.getPages().map(p => p.getWidth()), [303, 302, 302, 302, 301]);
  assert.deepEqual(result.getPages().map(p => p.getRotation().angle), [0, 180, 0, 180, 0]);
  checks.push('Real selected-page relative rotation, duplication, omission, blank insertion and watermark export');
  await widthSweep('Organize PDF');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.header-nav .nav-menu')).visibility === 'hidden');
  await page.locator('#opt-organize-rotate-pages').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('#toast-container .toast'));
  await page.screenshot({ path: resolve(out, 'organize-settings-mobile.png') });
  await page.locator('#opt-organize-blank-count').fill('1.5');
  await page.locator('#btn-process-action').tap();
  await page.waitForFunction(() => document.body.dataset.gxaLastProcessingError?.includes('whole blank'));
  assert.ok(await page.locator('#btn-download-result').isDisabled());
  await page.locator('#opt-organize-blank-count').fill('0');
  await page.locator('#opt-organize-blank-after').fill('0');
  download = await processDownload('organize-retry.pdf'); assert.equal((await PDFLib.PDFDocument.load(download.bytes)).getPageCount(), 4);
  checks.push('Organize fractional blank input fails without downloadable output; corrected settings retry');
  await page.getByRole('button', { name: 'Start Over', exact: true }).first().tap();
  assert.equal(await page.evaluate(() => appState.activeFiles.length), 0);
  assert.equal(await page.locator('#opt-range').inputValue(), '');
  assert.equal(await page.locator('#opt-organize-blank-count').inputValue(), '0');
  await page.locator('#file-picker').setInputFiles(input);
  await page.waitForSelector('.pdf-canvas-wrap[data-current-pdf-page]');
  await page.locator('.pdf-thumbnail-button[data-page="2"]').tap();
  await page.locator('.pdf-thumbnail-button[data-page="3"]').tap();
  assert.equal(await page.locator('#opt-range').inputValue(), '2-3');
  await page.locator('#opt-range').fill('3,1,1');
  await page.locator('.pdf-thumbnail-button[data-page="1"]').focus(); await page.keyboard.press('Alt+ArrowRight');
  assert.equal(await page.locator('#opt-range').inputValue(), '1, 1, 3', 'Keyboard ordering keeps manually selected duplicates and omissions');
  checks.push('Organize reset, real touch multiselect, keyboard ordering preserves typed repetitions/omissions');
  await page.locator('#opt-range').fill('');
  const firstThumb = page.locator('.pdf-thumbnail-button').first();
  await firstThumb.scrollIntoViewIfNeeded();
  const firstBox = await firstThumb.boundingBox(), secondBox = await page.locator('.pdf-thumbnail-button').nth(1).boundingBox();
  await page.evaluate(() => {
    window.__pdfDragTrace = [];
    const strip = document.querySelector('.pdf-organize-thumbnails');
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) strip.addEventListener(type, event => {
      window.__pdfDragTrace.push({ type, page: event.target.closest('[data-page]')?.dataset.page, x: event.clientX, y: event.clientY, action: getComputedStyle(event.target).touchAction, order: [...strip.querySelectorAll('button')].map(b => b.dataset.page) });
    });
  });
  const cdp = await context.newCDPSession(page);
  const start = { x: firstBox.x + firstBox.width / 2, y: firstBox.y + firstBox.height / 2 };
  const end = { x: secondBox.x + secondBox.width - 8, y: secondBox.y + secondBox.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 8; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 8, y: end.y }] });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.locator('#opt-range').inputValue(), '1, 2, 3, 4, 5', `Native emulated horizontal touch drag updates the output order: ${JSON.stringify({ firstBox, secondBox, trace: await page.evaluate(() => window.__pdfDragTrace) })}`);
  const beforeCancel = await page.locator('.pdf-thumbnail-button').evaluateAll(buttons => buttons.map(button => button.dataset.page));
  const cancelStart = await page.locator('.pdf-thumbnail-button').first().boundingBox();
  const cancelEnd = await page.locator('.pdf-thumbnail-button').nth(1).boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cancelStart.x + 20, y: cancelStart.y + 20 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cancelEnd.x + cancelEnd.width - 8, y: cancelEnd.y + 20 }] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.deepEqual(await page.locator('.pdf-thumbnail-button').evaluateAll(buttons => buttons.map(button => button.dataset.page)), beforeCancel);
  assert.equal(await page.locator('#opt-range').inputValue(), '1, 2, 3, 4, 5', 'Cancelled gesture does not commit an output reorder');
  await cdp.detach();
  download = await processDownload('touch-organized.pdf');
  assert.deepEqual((await PDFLib.PDFDocument.load(download.bytes)).getPages().map(p => p.getWidth()), [301, 302, 303, 304, 305]);
  checks.push('Native Chromium touch drag (CDP, not synthetic pointer dispatch) changes order; cancellation rolls back and real export verifies it');
  assert.deepEqual(failures, []);
} catch (error) { failures.push(error.message); throw error; }
finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ checks, failures, browser: 'Installed Chromium, emulated touch; not physical devices', realAdRequests: false }, null, 2));
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
console.log(`Advanced PDF page tools browser passed: ${checks.length} grouped checks, real files/downloads/reopened outputs and eight populated widths.`);
