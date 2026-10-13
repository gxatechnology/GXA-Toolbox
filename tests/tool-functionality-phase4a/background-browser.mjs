import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { createQaServer } from '../browser-qa-server.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await context.route(/bauval\.org|abscloud\.org|googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
const page = await context.newPage(); page.setDefaultTimeout(60000);
const out = resolve('test-results/tool-functionality-phase4a'); await mkdir(out, { recursive: true });
const source = resolve('tests/fixtures/background-remover-qa/07-product-white.jpg');
const errors = []; page.on('pageerror', error => errors.push(error.message));
let result;
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/background-remover/?provider=wasm`);
  await page.locator('input[type=file]').first().setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await page.getByRole('alert').waitFor({ state: 'visible' });
  await page.locator('input[type=file]').first().setInputFiles(source);
  // Real bundled model + real ONNX WASM; no segmentation mock or placeholder mask.
  await page.locator('.phase-editing').waitFor({ timeout: 180000 });
  const metrics = await page.evaluate(() => JSON.parse(document.documentElement.dataset.gxaSegmentationMetrics));
  assert.ok(metrics.inferenceMs > 0 && metrics.modelBytes > 0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `editor overflow ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.header-download').tap();
  await page.getByRole('dialog').getByRole('button', { name: 'PNG', exact: true }).tap();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).tap()]);
  assert.equal(await download.failure(), null); assert.match(download.suggestedFilename(), /\.png$/i);
  const target = resolve(out, 'background-real-wasm.png'); await download.saveAs(target);
  const original = await sharp(source).metadata(); const bytes = await readFile(target); const output = await sharp(bytes).metadata();
  assert.equal(output.format, 'png'); assert.deepEqual([output.width, output.height], [original.width, original.height]); assert.ok(output.hasAlpha);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0, opaque = 0;
  for (let i = 3; i < data.length; i += info.channels) { if (data[i] < 20) transparent++; if (data[i] > 235) opaque++; }
  assert.ok(transparent > 100 && opaque > 100, 'Real export must contain both removed background and retained subject');
  await page.screenshot({ path: resolve(out, 'background-editor-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  result = { status: 'passed', provider: 'real WASM', browser: 'Chromium touch emulation', metrics, width: output.width, height: output.height, transparent, opaque, limitations: 'One source photo; brush/pinch/crop, Firefox/Safari and physical devices not verified here.' };
  console.log('Background Remover: actual WASM inference, invalid input, mobile export and independently decoded full-resolution alpha PNG passed.');
} catch (error) { result = { status: 'failed', error: error.message, errors }; throw error; }
finally {
  await writeFile(resolve(out, 'background-results.json'), JSON.stringify(result, null, 2) + '\n');
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
