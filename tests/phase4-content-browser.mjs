import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { loadContentPageRegistry } from '../scripts/tool-registry.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const out = resolve('test-results/phase4-content'); await mkdir(out, { recursive: true });
const rows = [];
const editorial = (await loadContentPageRegistry()).filter(page => page.kind);
const paths = ['', ...editorial.map(page => page.id), 'merge-pdf', 'pdf-to-jpg', 'crop-image', 'compress-image', 'image-ocr', 'gst-calculator', 'json-tool'];
try {
  for (const enabled of [false, true]) {
    const context = await browser.newContext({ javaScriptEnabled: enabled, viewport: { width: 390, height: 844 }, hasTouch: true });
    await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const id of paths) {
      assert.equal((await page.goto(`${origin}/${id ? `${id}/` : ''}`, { waitUntil: 'domcontentloaded' })).status(), 200);
      if (enabled) await page.waitForFunction(() => typeof window.navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
      assert.equal(await page.locator('h1').count(), 1, `${id}: H1 count`);
      assert.ok((await page.locator('main').innerText()).length > 250, `${id}: empty informational view`);
      for (const width of [320, 360, 390, 412, 430, 768, 1366, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        if (enabled && width <= 1100) await page.waitForFunction(() => {
          const menu = document.querySelector('.header-nav .nav-menu');
          return menu && getComputedStyle(menu).visibility === 'hidden' && menu.inert;
        });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id}: overflow at ${width}, JS=${enabled}`);
      }
      rows.push({ route: `/${id}/`, javascript: enabled, status: 'passed' });
      if (['pdf-tools', 'guides/ocr-scans', 'json-tool'].includes(id)) {
        await page.setViewportSize({ width: 390, height: 844 });
        if (enabled) await page.waitForFunction(() => getComputedStyle(document.querySelector('.header-nav .nav-menu')).visibility === 'hidden');
        await page.screenshot({ path: resolve(out, `${id.replaceAll('/', '-')}-${enabled ? 'js' : 'no-js'}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    if (enabled) {
      await page.evaluate(() => navigate('content-guides/emi'));
      await page.waitForURL('**/guides/emi/');
      assert.match(await page.locator('h1').innerText(), /EMI/);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://gxatoolbox.in/guides/emi/');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('[data-static-route-shell]'));
      assert.match(await page.locator('h1').innerText(), /EMI/);
    }
    assert.equal((await page.goto(`${origin}/not-a-real-guide/`)).status(), 404);
    assert.equal((await page.goto(`${origin}/json-formatter/`)).status(), 404, 'Do not invent an alias for the existing /json-tool/ route');
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(resolve(out, 'results.json'), JSON.stringify(rows, null, 2) + '\n');
  console.log(`Phase 4 browser passed: ${rows.length} JS/no-JS page checks, eight widths, nested SPA route + refresh, real 404 and six screenshots.`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
