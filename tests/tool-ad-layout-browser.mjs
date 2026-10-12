import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv.includes('--baseline');
const out = resolve('test-results/tool-ad-layout', baseline ? 'before' : 'after');
await mkdir(out, { recursive: true });
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext();
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|bauval\.org|abscloud\.org/, route => route.abort());
const page = await context.newPage(); page.setDefaultTimeout(60000);
const rows = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  for (const id of ['edit-pdf', 'compress-pdf', 'merge-pdf', 'split-pdf', 'crop-image', 'compress-image', 'image-converter', 'gst-calculator', 'json-tool']) {
    await page.goto(`http://127.0.0.1:${server.address().port}/${id}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
    if (id === 'edit-pdf') await page.locator('.pdf-edit-upload').waitFor();
    if (id === 'image-converter') await page.locator('.image-converter__drop').waitFor();
    for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      const row = await page.evaluate(() => {
        const upload = document.querySelector('.pdf-edit-upload, #tool-upload-mount .upload-zone, #crop-upload-state, .image-converter__drop');
        const rect = upload?.getBoundingClientRect();
        return { height: rect?.height ?? null, top: rect?.top ?? null, overflow: document.documentElement.scrollWidth > innerWidth + 1,
          visibleAds: [...document.querySelectorAll('.gxa-ad-network, .tool-ad-placement')].filter(el => el.getBoundingClientRect().height > 1).length };
      });
      rows.push({ id, width, ...row });
      assert.equal(row.overflow, false, `${id} ${width}: overflow`);
      assert.equal(row.visibleAds, 0, `${id}: blocked ads must collapse`);
      if (!baseline && id === 'edit-pdf') {
        assert.ok(await page.locator('.tool-content-guide .tool-preworkspace-intro').count(), 'Technical content belongs below editor');
      }
      if ([390, 1440].includes(width)) await page.screenshot({ path: resolve(out, `${id}-${width}.png`), animations: 'disabled' });
    }
  }
  if (!baseline) {
    const open = async id => {
      await page.goto(`http://127.0.0.1:${server.address().port}/${id}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await open('gst-calculator');
    await page.locator('#opt-gst-amount').fill('100');
    await page.locator('#opt-gst-rate').selectOption('18');
    await page.getByRole('button', { name: 'Calculate', exact: true }).click();
    assert.match(await page.locator('#generator-preview-mount').innerText(), /118/);
    await open('json-tool');
    await page.locator('#opt-json-raw').fill('{"layout":true}');
    assert.match(await page.locator('#generator-preview-mount').innerText(), /"layout"\s*:\s*true/);
    await open('compress-pdf');
    const doc = await PDFDocument.create();
    for (let i = 0; i < 8; i++) doc.addPage().drawText(`Layout regression page ${i + 1}`);
    await page.locator('#file-picker').setInputFiles({ name: 'layout-test.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save({ useObjectStreams: false })) });
    await page.locator('#btn-process-action').click();
    await page.waitForFunction(() => document.getElementById('btn-download-result')?.disabled === false, null, { timeout: 180000 });
    await page.waitForFunction(() => document.querySelector('[data-ad-zone="ad-slot-after-tool"]')?.classList.contains('gxa-ad-network'));
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-mobile-download-result:visible, #btn-download-result:visible').first().click()]);
    assert.equal(await download.failure(), null);
    await download.saveAs(resolve(out, 'compressed.pdf'));
    const { readFile } = await import('node:fs/promises');
    assert.equal((await PDFDocument.load(await readFile(resolve(out, 'compressed.pdf')))).getPageCount(), 8);
    assert.ok(await page.evaluate(() => {
      const result = document.querySelector('#tool-complete-mount');
      const slot = document.querySelector('[data-ad-zone="ad-slot-after-tool"]');
      return !result.querySelector('.gxa-ad-network') && Boolean(result.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING);
    }));
    await page.getByRole('button', { name: 'Compress another PDF' }).click();
    await page.waitForFunction(() => document.querySelector('[data-disclosure]')?.dataset.disclosure === 'upload');
    console.log('GST calculation, JSON formatting, PDF compression/download/reopen/reset passed.');
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'measurements.json'), JSON.stringify(rows, null, 2));
  console.log(`${rows.length} responsive checks passed; screenshots and measurements: ${out}`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
