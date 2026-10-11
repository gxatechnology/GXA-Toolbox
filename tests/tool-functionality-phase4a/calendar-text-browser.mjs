import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from '../browser-qa-server.mjs';
import { cachePublicDependencies } from './cache-public-dependencies.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const out = resolve('test-results/tool-functionality-phase4a/calendar-text'); await mkdir(out, { recursive: true });
const results = [], failures = [];
try {
  for (const timezoneId of ['America/Los_Angeles', 'Asia/Kolkata']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId });
    try {
      await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
      await cachePublicDependencies(context);
      const page = await context.newPage(); page.setDefaultTimeout(60000);
      page.on('pageerror', error => failures.push({ timezoneId, route: page.url(), error: error.message }));
      const preview = page.locator('#generator-preview-mount');
      async function open(id) {
        assert.equal((await page.goto(`${origin}/${id}/`, { waitUntil: 'domcontentloaded' })).status(), 200);
        await page.waitForFunction(() => typeof window.navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
      }
      async function widths(id) {
        for (const width of [320, 360, 375, 390, 412, 430, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          if (width < 1100) await page.waitForFunction(() => getComputedStyle(document.querySelector('.header-nav .nav-menu')).visibility === 'hidden');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} result overflow at ${width}`);
        }
        await page.setViewportSize({ width: 390, height: 844 });
      }
      const screenshotPrefix = timezoneId.replace('/', '-');
      await open('age-calculator');
      await page.locator('#opt-age-dob').fill('2023-01-31'); await page.locator('#opt-age-target').fill('2023-03-01');
      await page.getByRole('button', { name: 'Calculate', exact: true }).tap();
      assert.match((await preview.innerText()).replace(/\s+/g, ' '), /0 Years 1 Months 1 Days/);
      await widths('age-calculator');
      await page.screenshot({ path: resolve(out, `${screenshotPrefix}-age-mobile.png`), fullPage: true });
      results.push({ timezoneId, route: 'age-calculator', result: 'month-end result, touch Calculate and eight result widths passed' });

      await open('date-calculator');
      await page.locator('#opt-date-start').fill('2023-03-01'); await page.locator('#opt-date-end').fill('2023-01-31');
      await page.getByRole('button', { name: 'Calculate', exact: true }).tap();
      assert.match((await preview.innerText()).replace(/\s+/g, ' '), /29 Days in the past.*0 Years, 1 Months, 1 Days/);
      await page.locator('#opt-date-mode').selectOption('add'); await page.locator('#opt-date-start').fill('2023-01-31');
      await page.locator('#opt-date-offset').fill('1'); await page.locator('#opt-date-unit').selectOption('months');
      await page.getByRole('button', { name: 'Calculate', exact: true }).tap();
      assert.match(await preview.innerText(), /February 28, 2023/); await widths('date-calculator');
      results.push({ timezoneId, route: 'date-calculator', result: 'reverse duration and month-end offset, eight result widths passed' });

      await open('base64-tool');
      const text = 'हिन्दी café 🙂'; const encoded = Buffer.from(text).toString('base64');
      const output = preview.locator('textarea');
      await page.locator('#opt-b64-raw').fill(text); assert.equal(await output.inputValue(), encoded);
      await page.getByRole('button', { name: 'Decode', exact: true }).tap();
      await page.locator('#opt-b64-raw').fill(encoded); assert.equal(await output.inputValue(), text);
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-generator-download').tap()]);
      assert.equal(await download.failure(), null); assert.equal(download.suggestedFilename(), 'base64_converted.txt');
      const downloaded = resolve(out, `${screenshotPrefix}-unicode.txt`); await download.saveAs(downloaded); assert.equal(await readFile(downloaded, 'utf8'), text);
      await page.locator('#opt-b64-raw').fill('/w=='); assert.match(await output.inputValue(), /not UTF-8/); assert.equal(await preview.getAttribute('data-base64-valid'), 'false');
      await page.getByRole('button', { name: 'Encode', exact: true }).tap();
      const bytes = Buffer.from([0, 255, 128, 1, 2, 3]);
      await page.locator('#opt-b64-file').setInputFiles({ name: 'real-bytes.bin', mimeType: 'application/octet-stream', buffer: bytes });
      await page.waitForFunction(expected => document.querySelector('#generator-preview-mount textarea')?.value === expected, bytes.toString('base64'));
      await page.getByRole('button', { name: 'Decode', exact: true }).tap();
      await page.locator('#opt-b64-file').setInputFiles({ name: 'encoded.txt', mimeType: 'text/plain', buffer: Buffer.from(encoded) });
      await page.waitForFunction(expected => document.querySelector('#generator-preview-mount textarea')?.value === expected, text);
      await page.locator('#opt-b64-raw').fill('SGVsbG8='); assert.equal(await output.inputValue(), 'Hello');
      assert.equal(await page.locator('#opt-b64-file').evaluate(input => input.files.length), 0);
      await widths('base64-tool');
      await page.screenshot({ path: resolve(out, `${screenshotPrefix}-base64-mobile.png`), fullPage: true });
      results.push({ timezoneId, route: 'base64-tool', result: 'UTF-8 input/decode, real TXT download, binary encode and Base64-file import, invalid input, replace with text, eight widths passed' });

      await open('hash-tool');
      for (const text of ['', '   ', 'हिन्दी café 🙂']) {
        await page.locator('#opt-hash-text').fill(text);
        const expected = createHash('sha256').update(text).digest('hex');
        await page.waitForFunction(value => document.getElementById('generated-hash-value')?.textContent.trim() === value, expected);
      }
      await widths('hash-tool');
      results.push({ timezoneId, route: 'hash-tool', result: 'empty, whitespace and UTF-8 live digests, eight result widths passed' });
    } finally { await context.close(); }
  }
} catch (error) { failures.push({ error: error.stack }); }
finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ browser: 'Installed Chromium; emulated touch and timezones', results, failures }, null, 2) + '\n');
  await browser.close(); await new Promise(done => server.close(done));
}
assert.deepEqual(failures, []);
console.log(`Calendar/text browser: ${results.length} route/timezone workflows, real download, eight result widths passed.`);
