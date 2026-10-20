// Optional real-Chromium content/layout QA. Google requests are blocked in this local test only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const evidence = resolve('test-results/content-layout-browser');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.GXA_BROWSER_EXECUTABLE ? { executablePath: process.env.GXA_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|tile\.openstreetmap\.org/, route => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(20000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.stack || error.message));

const representatives = [
  'compress-pdf', 'edit-pdf', 'merge-pdf', 'protect-pdf', 'ppt-to-pdf',
  'image-converter', 'gps-map-camera', 'compress-image', 'resize-image', 'crop-image', 'image-ocr', 'background-remover',
  'password-generator', 'hash-tool', 'barcode-generator', 'calculator', 'emi-calculator',
  'json-tool', 'zip-manager'
];

async function openTool(id) {
  const response = await page.goto(`${origin}/${id}/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `${id} direct route must return 200`);
  await page.waitForSelector('h1');
  const workspaceSelector = id === 'background-remover' ? '.upload-page .drop-zone'
    : id === 'crop-image' ? '.crop-editor-grid'
      : id === 'edit-pdf' ? '#edit-pdf-mount'
        : id === 'image-converter' ? '#image-converter-mount'
          : id === 'gps-map-camera' ? '#gps-map-camera-mount'
            : '.tool-workspace';
  try {
    await page.waitForSelector(workspaceSelector);
  } catch (error) {
    console.error(`Workspace did not render for ${id}:`, pageErrors, await page.locator('body').innerText().catch(() => 'body unavailable'));
    throw error;
  }
  if (id === 'background-remover') await page.waitForSelector('.upload-intro');
  else await page.waitForSelector('.tool-header');
  await page.waitForTimeout(100);
}

try {
  for (const id of representatives) {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTool(id);
    const state = await page.evaluate(() => {
      const root = document.documentElement;
      const header = document.querySelector('.header-nav, .gxa-header');
      const intro = document.querySelector('.tool-preworkspace-intro:not([hidden]), .upload-intro, .tool-header');
      const workspace = document.querySelector('.tool-workspace, #edit-pdf-mount, #image-converter-mount, #gps-map-camera-mount, .crop-editor-grid, .drop-zone');
      const headerBox = header?.getBoundingClientRect();
      const introBox = intro?.getBoundingClientRect();
      const workspaceBox = workspace?.getBoundingClientRect();
      return {
        overflow: root.scrollWidth - root.clientWidth,
        headerBottom: headerBox?.bottom || 0,
        introTop: introBox?.top || 0,
        introBottom: introBox?.bottom || 0,
        workspaceTop: workspaceBox?.top || 0,
        workspaceExists: Boolean(workspace),
        h1: document.querySelector('h1')?.textContent?.trim() || ''
      };
    });
    assert.ok(state.h1, `${id} needs a visible H1`);
    assert.ok(state.overflow <= 1, `${id} overflows the 390px viewport by ${state.overflow}px`);
    assert.ok(state.workspaceExists, `${id} needs a rendered workspace`);
    assert.ok(state.introTop >= state.headerBottom - 1, `${id} intro must not start under the sticky header`);
    assert.ok(state.workspaceTop >= state.introBottom + 20, `${id} needs at least 20px of useful intro/workspace separation`);
  }

  const screenshotSizes = [[320, 568], [390, 844], [768, 1024], [1366, 768], [1920, 1080]];
  for (const [width, height] of screenshotSizes) {
    await page.setViewportSize({ width, height });
    await openTool('password-generator');
    await page.waitForSelector('#generated-password-value');
    const geometry = await page.evaluate(() => {
      const result = document.querySelector('#generator-preview-mount');
      const style = getComputedStyle(result);
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        resultOverflow: style.overflowY,
        resultHeight: result?.getBoundingClientRect().height || 0,
        contentVisible: Boolean(document.querySelector('.tool-content-guide'))
      };
    });
    assert.ok(geometry.overflow <= 1, `${width}px evidence viewport overflows by ${geometry.overflow}px`);
    assert.ok(geometry.resultHeight > 0, `${width}px generated result must have height`);
    assert.ok(geometry.contentVisible, `${width}px needs below-workspace content`);
    await page.screenshot({ path: resolve(evidence, `password-generator-${width}x${height}.png`), fullPage: true });
  }

  assert.deepEqual(pageErrors, []);
  console.log(`Content/layout browser QA passed: ${representatives.length} cross-family routes at 390x844 and five full-page evidence viewports.`);
} finally {
  await context.close();
  await browser.close();
  await new Promise(done => server.close(done));
}
