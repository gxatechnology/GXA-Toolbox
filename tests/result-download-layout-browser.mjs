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
let nativeRequests = 0;
await context.route(/bauval\.org|abscloud\.org/, async route => {
  const url = route.request().url();
  if (url === config.native.src) {
    nativeRequests++;
    return route.fulfill({ contentType: 'application/javascript', body: `const c=document.getElementById('${config.native.containerId}');if(c){const a=document.createElement('a');a.href='https://example.com/';a.textContent='LOCAL LAYOUT FIXTURE';a.style.cssText='display:block;box-sizing:border-box;width:100%;height:90px;padding:20px';c.append(a);}` });
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

async function verifyResult(route, downloadSelector) {
  await page.waitForFunction(() => document.querySelector('[data-ad-trigger="result-ready"]')?.classList.contains('gxa-ad-network') && document.querySelector('.gxa-ad-sentinel[data-ad-sentinel-zone="after-tool"]'));
  await page.evaluate(() => document.querySelector('.gxa-ad-sentinel[data-ad-sentinel-zone="after-tool"]')?.scrollIntoView({ block: 'center' }));
  await page.evaluate(() => window.GxaAdNetwork?.sync());
  await page.waitForSelector('[data-ad-trigger="result-ready"][data-ad-state="mounted"]');
  const rows = [];
  for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const result = await page.evaluate(selector => {
      const ad = document.querySelector('[data-ad-trigger="result-ready"]');
      const download = document.querySelector(selector);
      const a = ad.getBoundingClientRect(), d = download.getBoundingClientRect();
      return {
        ad: { top: a.top + scrollY, bottom: a.bottom + scrollY, height: a.height },
        download: { top: d.top + scrollY, bottom: d.bottom + scrollY, height: d.height },
        ordered: Boolean(ad.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING),
        gap: Math.round(d.top - a.bottom),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        visibleDownloads: [...document.querySelectorAll(selector)].filter(node => node.getClientRects().length).length
      };
    }, downloadSelector);
    assert.equal(result.ordered, true, `${route} ${width}: DOM order`);
    assert.ok(result.ad.height > 0 && result.download.height > 0, `${route} ${width}: result/ad/download must be visible`);
    assert.ok(result.gap >= 24, `${route} ${width}: ad/download safe spacing (${result.gap}px)`);
    assert.equal(result.overflow, false, `${route} ${width}: horizontal overflow`);
    assert.equal(result.visibleDownloads, 1, `${route} ${width}: one visible download action`);
    rows.push({ route, width, ...result });
    if ([390, 1440].includes(width)) await page.screenshot({ path: resolve(output, `${route}-${width}.png`), fullPage: true, animations: 'disabled' });
  }
  return rows;
}

const rows = [];
try {
  await open('image-converter');
  await page.locator('.image-converter__input').setInputFiles(resolve('tests/fixtures/small.png'));
  await page.locator('.image-converter__convert').click();
  await page.locator('.image-converter__result').waitFor({ state: 'visible' });
  rows.push(...await verifyResult('image-converter', '.image-converter__download'));
  const [imageDownload] = await Promise.all([page.waitForEvent('download'), page.locator('.image-converter__download').click()]);
  assert.equal(await imageDownload.failure(), null);
  await imageDownload.saveAs(resolve(output, 'converted-output.png'));

  await page.setViewportSize({ width: 390, height: 844 });
  await open('compress-pdf');
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 3; index++) pdf.addPage().drawText(`Result download layout ${index + 1}`);
  await page.locator('#file-picker').setInputFiles({ name: 'result-layout.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save({ useObjectStreams: false })) });
  await page.locator('#btn-process-action').click();
  await page.waitForFunction(() => document.getElementById('btn-download-result')?.disabled === false && !document.getElementById('tool-complete-mount')?.classList.contains('hidden'));
  rows.push(...await verifyResult('compress-pdf', '#btn-download-result'));
  const [pdfDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-download-result').click()]);
  assert.equal(await pdfDownload.failure(), null);
  await pdfDownload.saveAs(resolve(output, 'compressed-output.pdf'));
  assert.equal((await PDFDocument.load(await readFile(resolve(output, 'compressed-output.pdf')))).getPageCount(), 3);

  assert.equal(nativeRequests, 2, 'Exactly one result ad request per processed route.');
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ rows, fixtureAdsOnly: true, realDownloads: 2 }, null, 2));
} finally {
  // The dependency cache may still be completing a PDF.js worker fetch when
  // the final download assertion finishes. Let route callbacks settle before
  // disposing their request context so teardown cannot become a false failure.
  await context.unrouteAll({ behavior: 'wait' });
  await context.close();
  await browser.close();
  await new Promise(done => server.close(done));
}
console.log(`Result/download browser layout passed: ${rows.length} responsive checks and 2 real downloads; provider creatives were local fixtures only.`);
