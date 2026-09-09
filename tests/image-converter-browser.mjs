// Optional real-browser QA. Inputs are synthetic and all Google requests are blocked in this local context.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { createImageConverterFixtures } from './fixtures/image-converter-fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const evidence = resolve('test-results/image-converter-browser');
await mkdir(evidence, { recursive: true });
const fixtures = await createImageConverterFixtures();
const browser = await chromium.launch({ headless: true, ...(process.env.GXA_BROWSER_EXECUTABLE ? { executablePath: process.env.GXA_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, hasTouch: true });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(20000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

async function open() {
  assert.equal((await page.goto(`${origin}/image-converter/`)).status(), 200);
  await page.waitForFunction(() => document.querySelector('#image-converter-mount')?.getAttribute('aria-busy') === 'false');
}

async function upload(name, fixture = fixtures[name]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose Image', exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: fixture.mime, buffer: fixture.bytes });
  await page.waitForFunction(() => !document.querySelector('.image-converter__format')?.disabled || document.querySelector('.image-converter__status')?.classList.contains('is-error'));
}

async function reopen(bytes, format) {
  return page.evaluate(async ({ base64, format }) => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const core = window.GxaImageConverterCore;
    if (!core.verifyOutput(bytes, format)) throw new Error(`Invalid ${format} signature.`);
    if (format === 'bmp') { const decoded = core.decodeBmp(bytes); return { width: decoded.width, height: decoded.height, pixels: decoded.rgba.some(value => value > 0) }; }
    if (format === 'tiff') { const decoded = core.decodeTiff(bytes); return { width: decoded.width, height: decoded.height, pixels: decoded.rgba.some(value => value > 0) }; }
    if (format === 'ico') { const parsed = core.parseIco(bytes); const image = parsed.supported[0]; const bitmap = await createImageBitmap(new Blob([image.bytes], { type: 'image/png' })); const result = { width: bitmap.width, height: bitmap.height, pixels: true }; bitmap.close(); return result; }
    if (format === 'gif') { if (!window.GxaGifDecoder) await window.GxaWorkspace.loadScriptOnce('/assets/gif-decoder.js', 'GxaGifDecoder'); const decoded = window.GxaGifDecoder.decode(bytes); return { width: decoded.width, height: decoded.height, pixels: decoded.frames[0].rgba.some(value => value > 0) }; }
    const bitmap = await createImageBitmap(new Blob([bytes], { type: core.OUTPUTS[format].mime })); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d').drawImage(bitmap, 0, 0); const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(value => value > 0); const result = { width: bitmap.width, height: bitmap.height, pixels }; bitmap.close(); return result;
  }, { base64: Buffer.from(bytes).toString('base64'), format });
}

async function convert(input, output, expectedWidth, expectedHeight) {
  await open(); await upload(input); assert.equal(await page.locator('.image-converter__status').evaluate(element => element.classList.contains('is-error')), false, `${input} decode failed: ${await page.locator('.image-converter__status').innerText()}`);
  await page.locator('.image-converter__format').selectOption(output);
  const consent = page.locator('.image-converter__consent input'); if (await consent.isVisible()) await consent.check();
  await page.getByRole('button', { name: 'Convert Image', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.image-converter__result')?.hidden || document.querySelector('.image-converter__status')?.classList.contains('is-error'));
  assert.equal(await page.locator('.image-converter__status').evaluate(element => element.classList.contains('is-error')), false, `${input} to ${output} failed: ${await page.locator('.image-converter__status').innerText()}`);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: new RegExp(`Download ${output === 'jpeg' ? 'JPEG' : output.toUpperCase()}`, 'i') }).click(); const download = await downloadPromise; assert.equal(await download.failure(), null); const path = resolve(evidence, `${input.replace(/\W+/g, '-')}-to-${output}.${output === 'jpeg' ? 'jpg' : output}`); await download.saveAs(path); const bytes = await readFile(path); const decoded = await reopen(bytes, output); assert.deepEqual([decoded.width, decoded.height], [expectedWidth, expectedHeight]); assert.equal(decoded.pixels, true); return bytes;
}

try {
  await convert('fixture.jpg', 'png', 1, 1);
  await convert('fixture.png', 'jpeg', 16, 16);
  await convert('fixture.png', 'webp', 16, 16);
  await convert('fixture.webp', 'png', 1, 1);
  await convert('fixture.tiff', 'png', 16, 16);
  await convert('animated.gif', 'png', 16, 16);
  await convert('fixture.svg', 'png', 320, 180);
  await convert('fixture.bmp', 'jpeg', 16, 16);
  await convert('fixture.avif', 'png', 4, 3);
  await convert('fixture.ico', 'png', 16, 16);
  await convert('fixture.cur', 'png', 16, 16);
  await convert('fixture.png', 'gif', 16, 16);
  await convert('fixture.png', 'bmp', 16, 16);
  await convert('fixture.png', 'tiff', 16, 16);
  await convert('fixture.png', 'ico', 48, 48);

  await open(); await upload('renamed.jpg'); assert.match(await page.locator('.image-converter__detection').innerText(), /extension does not match/i); assert.equal(await page.locator('[data-original="format"]').innerText(), 'PNG');
  await open(); await upload('animated.gif'); assert.equal(await page.getByRole('button', { name: 'Convert Image', exact: true }).isDisabled(), true); assert.match(await page.locator('.image-converter__consent').innerText(), /first animation frame/i);
  await open(); await upload('transparent.png'); assert.equal(await page.locator('[data-original="alpha"]').innerText(), 'Present'); await page.locator('.image-converter__format').selectOption('jpeg'); assert.equal(await page.locator('.image-converter__background').isVisible(), true); await page.locator('.image-converter__background input[value="#000000"]').check(); await page.getByRole('button', { name: 'Convert Image', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.image-converter__result')?.hidden); const alphaDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download JPEG', exact: true }).click(); const alphaBytes = await readFile(await (await alphaDownload).path()); const alphaResult = await reopen(alphaBytes, 'jpeg'); assert.deepEqual([alphaResult.width, alphaResult.height], [512, 512]);
  await open(); await upload('unsupported.heic'); assert.match(await page.locator('.image-converter__status').innerText(), /no verified decoder/i);
  await open(); await upload('unsafe.svg', { mime: 'image/svg+xml', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><script>alert(1)</script><rect width="20" height="20"/></svg>') }); assert.match(await page.locator('.image-converter__status').innerText(), /not allowed/i);

  for (const width of [320, 360, 375, 390, 412, 430, 768]) { await page.setViewportSize({ width, height: width === 320 ? 568 : 900 }); await open(); const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(overflow <= 1, `${width}px viewport overflows by ${overflow}px.`); const box = await page.getByRole('button', { name: 'Choose Image', exact: true }).boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 44); await page.screenshot({ path: resolve(evidence, `image-converter-${width}.png`), fullPage: true }); }
  for (const [width, height] of [[1024, 768], [1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080]]) { await page.setViewportSize({ width, height }); await open(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${width} desktop overflow.`); }
  assert.deepEqual(pageErrors, []);
  console.log('Image Converter browser QA passed: 16 real conversions with signature validation and decoder reopen, AVIF, ICO/CUR, alpha flattening controls, animation consent, mismatch detection, HEIC rejection, SVG security, 7 mobile widths, and 6 desktop widths.');
} finally {
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
