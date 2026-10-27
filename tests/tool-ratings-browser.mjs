import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, acceptDownloads: true });
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|bauval\.org|abscloud\.org/, route => route.abort());

let submissions = 0;
let submissionPayload = null;
let failNextSubmission = true;
await context.route('**/api/tool-ratings**', async route => {
  if (route.request().method() === 'POST') {
    submissions += 1;
    submissionPayload = JSON.parse(route.request().postData() || '{}');
    if (failNextSubmission) {
      failNextSubmission = false;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ available: false, message: 'Ratings are temporarily unavailable.' }) });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ available: true, message: 'Thank you for your feedback!', aggregate: { average: 4.5, count: 2 } })
    });
  }
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ available: true, aggregate: { average: 4, count: 1 } })
  });
});

const page = await context.newPage();
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const output = resolve('test-results/tool-ratings');
await mkdir(output, { recursive: true });

async function open(route) {
  await page.goto(`${origin}/${route ? `${route}/` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
}

const responsive = [];
try {
  await open('json-tool');
  await page.locator('[data-tool-rating]:visible').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-tool-rating]:visible [data-rating-value]').count(), 5);
  await page.locator('[data-tool-rating]:visible [data-rating-value="3"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-tool-rating]:visible [data-rating-value="4"]').getAttribute('aria-checked'), 'true');
  await page.locator('[data-tool-rating]:visible [name="review"]').fill('Useful and clear.');

  for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      ratingWidth: Math.round(document.querySelector('[data-tool-rating]').getBoundingClientRect().width),
      minimumStarTarget: Math.min(...[...document.querySelectorAll('[data-rating-value]')].map(node => node.getBoundingClientRect().width))
    }));
    assert.equal(result.overflow, false, `${width}px: no horizontal overflow`);
    assert.ok(result.ratingWidth <= width, `${width}px: rating fits viewport`);
    assert.ok(result.minimumStarTarget >= 44, `${width}px: stars remain touch accessible`);
    responsive.push({ width, ...result });
    if ([390, 1440].includes(width)) await page.screenshot({ path: resolve(output, `rating-${width}.png`), fullPage: true, animations: 'disabled' });
  }

  await page.locator('[data-tool-rating]:visible [data-rating-details] button[type="submit"]').click();
  await page.getByText('Ratings are temporarily unavailable.').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-tool-rating]:visible [data-rating-value="4"]').getAttribute('aria-checked'), 'true');
  assert.equal(await page.locator('[data-tool-rating]:visible [name="review"]').inputValue(), 'Useful and clear.');
  assert.equal(await page.locator('[data-tool-rating]:visible [data-rating-details] button[type="submit"]').isEnabled(), true);
  await page.locator('[data-tool-rating]:visible [data-rating-details] button[type="submit"]').click();
  await page.locator('.tool-rating__thanks').waitFor({ state: 'visible' });
  assert.equal(submissions, 2, 'one failed request followed by one explicit retry');
  assert.ok(Number.isInteger(submissionPayload?.rating) && submissionPayload.rating >= 1 && submissionPayload.rating <= 5);

  await open('compress-pdf');
  assert.equal(await page.locator('[data-tool-rating]:visible').count(), 0, 'result rating is hidden before a result exists');
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('GXA Toolbox rating workflow');
  await page.locator('#file-picker').setInputFiles({ name: 'rating-check.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save({ useObjectStreams: false })) });
  await page.locator('#btn-process-action').click();
  await page.waitForFunction(() => document.getElementById('btn-download-result')?.disabled === false);
  await page.locator('[data-tool-rating]').waitFor({ state: 'visible' });
  const order = await page.evaluate(() => {
    const download = document.getElementById('btn-download-result');
    const rating = document.querySelector('[data-tool-rating]');
    return Boolean(download.compareDocumentPosition(rating) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  assert.equal(order, true, 'rating follows the result/download controls');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-download-result').click()]);
  assert.equal(await download.failure(), null, 'download remains independent of rating submission');

  await open('');
  assert.equal(await page.locator('.trust-marquee__track > .trust-marquee__item').count(), 12);
  assert.equal(await page.locator('.trust-marquee__viewport').getAttribute('tabindex'), '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const animation = await page.locator('.trust-marquee__track').evaluate(node => getComputedStyle(node).animationName);
  assert.equal(animation, 'none', 'trust marquee honors reduced motion');

  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ responsive, submissions, realDownload: true, providerData: 'deterministic local API fixture only' }, null, 2));
} finally {
  await context.close();
  await browser.close();
  await new Promise(done => server.close(done));
}

console.log(`Tool ratings browser QA passed: ${responsive.length} viewports, keyboard/touch targets, result gating, real download and reduced-motion marquee.`);
