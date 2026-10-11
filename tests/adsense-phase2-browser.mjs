import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { loadToolQuality } from '../scripts/tool-registry.mjs';
import { AD_NETWORK } from '../config/ad-network.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.GXA_BROWSER_EXECUTABLE ? { executablePath: process.env.GXA_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
await context.route(/bauval\.org|abscloud\.org/, route => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(20000);
// Direct routes still load shared CDN resources; give navigation its own budget.
// Interaction assertions retain the shorter timeout and all original checks.
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const screenshots = resolve('test-results/adsense-phase2');
await mkdir(screenshots, { recursive: true });
async function open(id = '') {
  assert.equal((await page.goto(`${origin}/${id ? id + '/' : ''}`, { waitUntil: 'domcontentloaded' })).status(), 200);
  await page.waitForFunction(() => typeof window.navigate === 'function' && document.querySelector('h1') && !document.querySelector('#main-content > [data-static-route-shell]'));
}
try {
  const quality = await loadToolQuality();
  for (const [id, state] of Object.entries(quality).filter(([, value]) => !value.indexable)) {
    await open(id);
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, follow', id);
    assert.equal(await page.locator('script[src*="pagead2.googlesyndication.com"]').count(), 0, id);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${id} mobile overflow`);
    assert.equal(state.adsEligible, false);
  }
  await open('html-to-pdf');
  await page.locator('#opt-html-raw').fill('<h1>Browser export</h1>' + '<p>Full paragraph text remains visible in the export.</p>'.repeat(90) + '<p>FINAL_BROWSER_SENTINEL</p>');
  await page.evaluate(() => processEnteredHtml());
  await page.waitForFunction(() => document.querySelector('#btn-download-result')?.disabled === false && !document.querySelector('#tool-complete-mount')?.classList.contains('hidden'));
  const exportButton = page.locator('#btn-mobile-download-result:visible, #btn-download-result:visible').first();
  const [exported] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  await exported.saveAs(resolve(screenshots, 'html-reflow.pdf'));
  assert.equal(await exported.failure(), null);
  await page.screenshot({ path: resolve(screenshots, 'html-to-pdf-mobile.png'), fullPage: true });
  await page.locator('#opt-html-raw').fill('<p>हिन्दी</p>');
  await page.evaluate(() => processEnteredHtml());
  assert.ok((await page.locator('body').getAttribute('data-gxa-last-processing-error')).includes('Unicode'));
  assert.equal(await page.locator('#btn-download-result').isEnabled(), false);

  await open('qr-reader');
  await page.addScriptTag({ url: `${origin}/assets/vendor/zxing/index.min.js` });
  // Create a genuine QR bitmap in this local test; no production fake data.
  const qr = await page.evaluate(() => {
    const matrix = new ZXing.QRCodeWriter().encode('GXA real fallback decode', ZXing.BarcodeFormat.QR_CODE, 256, 256, new Map());
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = 'black';
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) if (matrix.get(x, y)) ctx.fillRect(x, y, 1, 1);
    return canvas.toDataURL().split(',')[1];
  });
  const nativeAvailable = await page.evaluate(() => typeof BarcodeDetector === 'function');
  if (nativeAvailable) {
    const nativeResult = await page.evaluate(async data => {
      const file = new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], 'qr.png', { type: 'image/png' });
      return (await GxaWorkspace.detectBarcode(file, ['qr_code'])).rawValue;
    }, qr);
    assert.equal(nativeResult, 'GXA real fallback decode');
  }
  await page.evaluate(() => { window.BarcodeDetector = undefined; window.ZXing = undefined; });
  await page.locator('input[type=file]').first().setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: Buffer.from(qr, 'base64') });
  await page.evaluate(() => runFileProcessingPipeline());
  await page.waitForFunction(() => document.querySelector('#comparison-metric-mount textarea')?.value.includes('GXA real fallback decode'));
  assert.equal(await page.locator('script[data-gxa-src="/assets/vendor/zxing/index.min.js"]').count(), 1);
  await page.screenshot({ path: resolve(screenshots, 'qr-fallback-mobile.png'), fullPage: true });
  const failed = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 200;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 200, 200);
    const blob = await new Promise(done => canvas.toBlob(done));
    try { await GxaWorkspace.detectBarcode(new File([blob], 'blank.png', { type: 'image/png' }), ['qr_code']); return 'unexpected success'; }
    catch (error) { return error.message; }
  });
  assert.match(failed, /No readable code/);
  // A real Code 128 fixture generated by the existing engine, then decoded
  // through ZXing with native detection disabled.
  await open('barcode-generator');
  const code128 = await page.evaluate(async () => {
    const mount = document.createElement('div'); document.body.append(mount);
    await GxaWorkspace.renderCode('GXA-PHASE2-128', 'CODE128', '#000000', mount, { size: 384 });
    const svg = mount.querySelector('svg');
    const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob), image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0); URL.revokeObjectURL(url); mount.remove();
    return canvas.toDataURL().split(',')[1];
  });
  await open('barcode-reader');
  await page.evaluate(() => { window.BarcodeDetector = undefined; });
  await page.locator('input[type=file]').first().setInputFiles({ name: 'code128.png', mimeType: 'image/png', buffer: Buffer.from(code128, 'base64') });
  await page.evaluate(() => runFileProcessingPipeline());
  await page.waitForFunction(() => document.querySelector('#comparison-metric-mount textarea')?.value.includes('GXA-PHASE2-128'));

  await open();
  await page.evaluate(() => GxaAdState.check());
  assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), AD_NETWORK === 'adsterra' ? 1 : 0, 'Adsterra selection must pause the inactive AdSense network.');
  await page.evaluate(() => { document.getElementById('main-content').replaceChildren(); GxaAdState.check(); });
  assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1, 'Empty content must pause requests.');
  await open();
  await page.evaluate(() => GxaAdState.fail());
  assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1, 'Failed state must pause requests.');
  await open();
  await page.evaluate(() => { window.documentSentinel = 'before-navigation'; navigate('tool-uuid-generator'); });
  await page.waitForURL('**/uuid-generator/');
  await page.waitForFunction(() => typeof window.GxaToolQuality === 'object');
  assert.equal(await page.evaluate(() => window.documentSentinel), undefined, 'Ad eligibility boundary must discard the old document.');
  assert.equal(await page.locator('script[src*="pagead2.googlesyndication.com"]').count(), 0);
  await page.evaluate(() => navigate('tool-json-tool'));
  await page.waitForURL('**/json-tool/');
  assert.equal(await page.locator('script[src*="pagead2.googlesyndication.com"]').count(), AD_NETWORK === 'adsense' ? 1 : 0);
  await page.goBack({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('script[src*="pagead2.googlesyndication.com"]').count(), 0, 'Back navigation must remain ad-free.');
  await open();
  assert.equal(await page.locator('.hero-section .status-dot').count(), 0);
  assert.doesNotMatch(await page.locator('.hero-section').innerText(), /95|gxa-toolbox\.app/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `home overflow at ${width}`);
  }
  assert.deepEqual(errors, [], 'Unexpected browser runtime errors');
  console.log(`Phase 2 Chromium passed: 14 noindex/no-ad routes, mobile overflow, real HTML download/error, QR and Code128 ZXing decoding, failed decode, document navigation/back, homepage 320/390/768/1440. Native BarcodeDetector available: ${nativeAvailable}.`);
} finally {
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
