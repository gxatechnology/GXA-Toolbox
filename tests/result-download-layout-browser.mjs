import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
import config from '../public_html/assets/ad-config.js';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, acceptDownloads: true });
await cachePublicDependencies(context);
await context.route('**/assets/ad-config.js', async route => {
  const source = await readFile('public_html/assets/ad-config.js', 'utf8');
  await route.fulfill({ contentType: 'application/javascript', body: source.replace('top: true, right: true, left: true, afterTool: true, content: true', 'top: false, right: false, left: false, afterTool: true, content: false') });
});
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
let resultRequests = 0;
let providerMode = 'filled';
await context.route(/bauval\.org|abscloud\.org/, async route => {
  const url = route.request().url();
  const unit = config.banners.find(item => item.src === url);
  if (unit) {
    resultRequests++;
    if (providerMode === 'empty') return route.fulfill({ contentType: 'application/javascript', body: '/* intentional result-banner no fill */' });
    return route.fulfill({ contentType: 'application/javascript', body: `const f=document.createElement('iframe');f.width='${unit.width}';f.height='${unit.height}';f.srcdoc='<a href="https://example.com/">LOCAL RESULT BANNER FIXTURE</a>';document.currentScript.parentElement.append(f);` });
  }
  return route.fulfill({ contentType: 'application/javascript', body: '/* provider bootstrap intentionally inert in local QA */' });
});

const page = await context.newPage();
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const output = resolve('test-results/result-download-layout');
await mkdir(output, { recursive: true });

async function open(route) {
  await page.goto(`${origin}/${route}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
}

async function verifyResult(route, downloadSelector, width) {
  await page.waitForFunction(() => {
    const slot = document.querySelector('[data-ad-trigger="result-ready"].gxa-ad-network');
    return slot && (slot.dataset.adState === 'mounted' || document.querySelector('.gxa-ad-sentinel[data-ad-sentinel-zone="after-tool"]'));
  }, null, { timeout: 15000 }).catch(async () => {
    const state = await page.evaluate(() => ({ marker: document.querySelector('[data-ad-trigger="result-ready"]')?.outerHTML.slice(0, 500), diagnostics: window.GxaAdNetwork?.diagnostics() }));
    throw new Error(`${route} ${width}: result slot missing: ${JSON.stringify(state)}`);
  });
  await page.evaluate(() => document.querySelector('.gxa-ad-sentinel[data-ad-sentinel-zone="after-tool"]')?.scrollIntoView({ block: 'center' }));
  await page.evaluate(() => window.GxaAdNetwork?.sync());
  await page.waitForSelector('[data-ad-trigger="result-ready"][data-ad-state="mounted"]');
  const result = await page.evaluate(selector => {
      const ad = document.querySelector('[data-ad-trigger="result-ready"]');
      const download = document.querySelector(selector);
      const a = ad.getBoundingClientRect(), d = download.getBoundingClientRect();
      const creative = ad.querySelector('iframe')?.getBoundingClientRect();
      return {
        ad: { top: a.top + scrollY, bottom: a.bottom + scrollY, height: a.height },
        creative: creative ? { width: creative.width, height: creative.height, centerOffset: Math.abs((creative.left + creative.right - a.left - a.right) / 2) } : null,
        download: { top: d.top + scrollY, bottom: d.bottom + scrollY, height: d.height },
        ordered: Boolean(ad.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING),
        gap: Math.round(d.top - a.bottom),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        visibleDownloads: [...document.querySelectorAll(selector)].filter(node => node.getClientRects().length).length
      };
  }, downloadSelector);
  const expectedFormat = width < 768 ? '320x50' : width < 1280 ? '468x60' : '728x90';
  const diagnostics = await page.evaluate(() => window.GxaAdNetwork.diagnostics());
  const slot = diagnostics.slots.find(item => item.zone === 'after-tool');
  assert.equal(result.ordered, true, `${route} ${width}: DOM order`);
  assert.ok(result.ad.height > 0 && result.download.height > 0, `${route} ${width}: result/ad/download must be visible`);
  assert.ok(result.gap >= 20, `${route} ${width}: ad/download safe spacing (${result.gap}px)`);
  assert.equal(result.overflow, false, `${route} ${width}: horizontal overflow`);
  assert.equal(result.visibleDownloads, 1, `${route} ${width}: one visible download action`);
  assert.equal(slot.format, expectedFormat, `${route} ${width}: responsive result banner`);
  const expectedHeight = Number(expectedFormat.split('x')[1]);
  assert.ok(result.creative && result.creative.centerOffset <= 4, `${route} ${width}: actual creative must be centered (${JSON.stringify(result)})`);
  assert.equal(result.creative.width, Number(expectedFormat.split('x')[0]), `${route} ${width}: creative must not be stretched or cropped`);
  assert.equal(result.creative.height, expectedHeight, `${route} ${width}: creative must retain its approved size`);
  assert.ok(result.ad.height <= expectedHeight + 50, `${route} ${width}: banner container must stay proportional (${JSON.stringify(result)})`);
  assert.equal(slot.requestAttempted, true);
  assert.equal(slot.creativeRendered, true);
  for (const event of ['download-result-ready', 'ad-request-attempted', 'provider-request-dispatched', 'creative-rendered']) assert.ok(diagnostics.events.some(item => item.zone === 'after-tool' && item.event === event), `${route} ${width}: missing ${event}`);
  if ([390, 1920].includes(width) || (width === 1440 && ['organize-pdf', 'compress-image'].includes(route))) {
    await page.screenshot({ path: resolve(output, `${route}-${width}.png`), fullPage: true, animations: 'disabled' });
  }
  return { route, width, ...result, format: slot.format };
}

const rows = [];
try {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 3; index++) pdf.addPage().drawText(`Result download layout ${index + 1}`);
  const pdfBytes = Buffer.from(await pdf.save({ useObjectStreams: false }));
  for (const width of [390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await open('image-converter');
    const beforeImage = resultRequests;
    await page.locator('.image-converter__input').setInputFiles(resolve('tests/fixtures/small.png'));
    await page.locator('.image-converter__convert').click();
    await page.locator('.image-converter__result').waitFor({ state: 'visible' });
    rows.push(await verifyResult('image-converter', '.image-converter__download', width));
    assert.equal(resultRequests, beforeImage + 1, `${width}: exactly one Image Converter result banner request`);
    if (width === 390) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.image-converter__download').click()]);
      assert.equal(await download.failure(), null); await download.saveAs(resolve(output, 'converted-output.png'));
    }

    await open('compress-pdf');
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    assert.equal(await page.locator('[data-ad-trigger="result-ready"]').getAttribute('data-ad-state'), 'waiting', `${width}: hidden pre-result geometry must not retire the download banner`);
    const beforePdf = resultRequests;
    await page.locator('#file-picker').setInputFiles({ name: 'result-layout.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
    await page.locator('#btn-process-action').click();
    await page.waitForFunction(() => document.getElementById('btn-download-result')?.disabled === false && !document.getElementById('tool-complete-mount')?.classList.contains('hidden'));
    rows.push(await verifyResult('compress-pdf', '#btn-download-result', width));
    assert.equal(resultRequests, beforePdf + 1, `${width}: exactly one Compress PDF result banner request`);
    if (width === 390) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-download-result').click()]);
      assert.equal(await download.failure(), null); await download.saveAs(resolve(output, 'compressed-output.pdf'));
      assert.equal((await PDFDocument.load(await readFile(resolve(output, 'compressed-output.pdf')))).getPageCount(), 3);
    }
  }

  // The shared result template serves these distinct engines. Exercise actual
  // processing, not just a static marker in the generated tool HTML.
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ['organize-pdf', 'merge-pdf', 'compress-image', 'pdf-to-jpg']) {
    await open(route);
    const before = resultRequests;
    const files = route === 'merge-pdf'
      ? [{ name: 'merge-a.pdf', mimeType: 'application/pdf', buffer: pdfBytes }, { name: 'merge-b.pdf', mimeType: 'application/pdf', buffer: pdfBytes }]
      : route === 'compress-image'
        ? resolve('tests/fixtures/small.png')
        : { name: `${route}.pdf`, mimeType: 'application/pdf', buffer: pdfBytes };
    await page.locator('#file-picker').setInputFiles(files);
    await page.locator('#btn-process-action').click();
    await page.waitForFunction(() => document.getElementById('btn-download-result')?.disabled === false && !document.getElementById('tool-complete-mount')?.classList.contains('hidden'));
    rows.push(await verifyResult(route, '#btn-download-result', 1440));
    assert.equal(resultRequests, before + 1, `${route}: exactly one result-banner request`);
  }
  await open('crop-image');
  const beforeCrop = resultRequests;
  await page.locator('#crop-file-picker').setInputFiles(resolve('tests/fixtures/small.png'));
  await page.locator('#crop-apply-button').click();
  await page.locator('#crop-result-panel').waitFor({ state: 'visible' });
  rows.push(await verifyResult('crop-image', '#crop-download-button', 1440));
  assert.equal(resultRequests, beforeCrop + 1, 'Crop Image: exactly one result-banner request');

  providerMode = 'empty';
  await page.setViewportSize({ width: 390, height: 844 }); await open('image-converter');
  await page.locator('.image-converter__input').setInputFiles(resolve('tests/fixtures/small.png'));
  await page.locator('.image-converter__convert').click();
  await page.locator('.image-converter__result').waitFor({ state: 'visible' });
  await page.evaluate(() => document.querySelector('.gxa-ad-sentinel[data-ad-sentinel-zone="after-tool"]')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => document.querySelector('[data-ad-trigger="result-ready"]')?.dataset.adState === 'empty', null, { timeout: 45000 });
  assert.equal(await page.locator('[data-ad-trigger="result-ready"]').evaluate(node => node.getBoundingClientRect().height), 0);
  assert.equal(await page.locator('.image-converter__download').isVisible(), true, 'No-fill must not hide the download action.');
  assert.equal((await page.evaluate(() => window.GxaAdNetwork.diagnostics())).slots.find(item => item.zone === 'after-tool')?.collapseReason, 'empty');

  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ rows, fixtureAdsOnly: true, realDownloads: 2, resultRequests }, null, 2));
} finally {
  // The dependency cache may still be completing a PDF.js worker fetch when
  // the final download assertion finishes. Let route callbacks settle before
  // disposing their request context so teardown cannot become a false failure.
  await context.unrouteAll({ behavior: 'wait' });
  await context.close();
  await browser.close();
  await new Promise(done => server.close(done));
}
console.log(`Result/download browser layout passed: ${rows.length} responsive checks, one collapsed no-fill and 2 real downloads; provider creatives were local fixtures only.`);
