import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { createQaServer } from '../browser-qa-server.mjs';
import { loadToolRegistry } from '../../scripts/tool-registry.mjs';
import { cachePublicDependencies } from './cache-public-dependencies.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
await cachePublicDependencies(context);
const page = await context.newPage(); page.setDefaultTimeout(60000);
const out = resolve('test-results/tool-functionality-phase4a'); await mkdir(out, { recursive: true });
const rows = [], workflows = [], failures = [];
page.on('pageerror', error => failures.push({ route: page.url(), error: error.message }));
async function open(id) {
  assert.equal((await page.goto(`${origin}/${id}/`, { waitUntil: 'domcontentloaded' })).status(), 200);
  if (id === 'background-remover') await page.waitForSelector('#root main');
  else await page.waitForFunction(() => typeof window.navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
}
try {
  for (const tool of await loadToolRegistry()) {
    const row = { id: tool.id, directLoad: false, widths: [], processing: 'Not tested by route smoke check' };
    try {
      await open(tool.id); row.directLoad = true;
      assert.ok((await page.locator('h1').first().innerText()).trim());
      for (const width of [320, 360, 375, 390, 412, 430, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        // Wait for the existing desktop-to-drawer transition, not just layout.
        if (tool.id !== 'background-remover' && width < 1100) await page.waitForFunction(() => getComputedStyle(document.querySelector('.header-nav .nav-menu')).visibility === 'hidden');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`);
        row.widths.push(width);
      }
    } catch (error) { row.error = error.message; failures.push({ route: tool.id, error: error.message }); }
    rows.push(row); console.log(`${tool.id}: ${row.error ? 'FAIL ' + row.error : 'route + eight widths passed (not a processing certification)'}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await open('emi-calculator');
  for (const [id, value] of [['opt-emi-amount', '12000'], ['opt-emi-rate', '0'], ['opt-emi-years', '1']]) await page.locator(`#${id}`).fill(value);
  await page.getByRole('button', { name: 'Calculate', exact: true }).tap();
  assert.match(await page.locator('#generator-preview-mount').innerText(), /1,000/);
  assert.ok(await page.locator('#opt-emi-rate').evaluate(input => input.validity.valid));
  await page.screenshot({ path: resolve(out, 'emi-zero-interest-mobile.png'), fullPage: true });
  workflows.push({ id: 'emi-calculator', test: 'mobile entry, touch Calculate, zero rate result, HTML validity', passed: true });

  await open('zip-manager');
  const payloads = [['same.txt', 'first contents'], ['same.txt', 'second contents'], ['same (2).txt', 'third contents'], ['हिन्दी.txt', 'नमस्ते']];
  await page.locator('#file-picker').setInputFiles(payloads.map(([name, text]) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) })));
  await page.locator('#btn-process-action').tap();
  await page.waitForFunction(() => !document.getElementById('btn-download-result')?.disabled);
  const mime = await page.evaluate(() => premiumEditorState.resultBlob?.type); assert.equal(mime, 'application/zip');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-download-result:visible').tap()]);
  assert.equal(await download.failure(), null); assert.match(download.suggestedFilename(), /\.zip$/i);
  const path = resolve(out, 'duplicate-unicode-files.zip'); await download.saveAs(path);
  const zip = await JSZip.loadAsync(await readFile(path), { checkCRC32: true });
  const entries = Object.values(zip.files).filter(entry => !entry.dir); assert.equal(entries.length, 4);
  assert.deepEqual((await Promise.all(entries.map(entry => entry.async('string')))).sort(), payloads.map(([, text]) => text).sort());
  await page.screenshot({ path: resolve(out, 'zip-result-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Start Over', exact: true }).first().tap();
  assert.equal(await page.evaluate(() => appState.activeFiles.length), 0);
  workflows.push({ id: 'zip-manager', test: 'real file selection, touch processing/download/reset, MIME/extension/CRC and four reopened contents', passed: true });
} catch (error) { failures.push({ route: page.url(), error: error.stack }); }
finally {
  await writeFile(resolve(out, 'browser-results.json'), JSON.stringify({ browser: 'Installed Chromium; emulated touch, not physical devices', rows, workflows, failures }, null, 2) + '\n');
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
assert.deepEqual(failures, []);
console.log(`Phase 4A browser: ${rows.length} direct routes, eight widths, ${workflows.length} focused real workflows. Other processing and cross-browser axes remain separate.`);
