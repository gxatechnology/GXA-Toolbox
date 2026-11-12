import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv.includes('--baseline');
const diagnose = process.argv.includes('--diagnose');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, acceptDownloads: true });
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|bauval\.org|abscloud\.org/, route => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(60000);
const output = resolve(`test-results/responsive-ux-dom/${baseline ? 'before' : diagnose ? 'diagnose' : 'after'}`);
await mkdir(output, { recursive: true });
const rows = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function open(route) {
  await page.goto(`${origin}/${route ? `${route}/` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
}

try {
  for (const width of [320, 360, 375, 390, 412, 414, 430, 480, 600, 768, 820, 1024, 1280, 1440, 1600, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await open('compress-pdf');
    const mobile = width <= 1100;
    if (mobile) {
      await page.locator('#mobile-nav-toggle').click();
      await page.locator('#nav-pdf-trigger').click();
      await page.waitForFunction(() => document.querySelector('#nav-pdf-menu')?.getBoundingClientRect().height >= 200);
    }
    const state = await page.evaluate(() => {
      const rect = node => { if (!node) return null; const box = node.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom) }; };
      const menu = document.querySelector('#nav-pdf-menu');
      const drawer = document.querySelector('.header-nav .nav-menu');
      const groups = [...menu.querySelectorAll('.mega-tool-group')].map(node => rect(node));
      const hero = document.querySelector('.tool-header');
      const upload = document.querySelector('#tool-upload-mount');
      const guide = document.querySelector('.tool-content-guide');
      return { viewport: innerWidth, drawer: rect(drawer), menu: rect(menu), columns: getComputedStyle(menu).gridTemplateColumns, groups, expanded: document.querySelector('#nav-pdf-trigger').getAttribute('aria-expanded'), overflow: document.documentElement.scrollWidth > innerWidth + 1, upload: rect(upload), guide: rect(guide), header: rect(hero) };
    });
    rows.push({ route: 'compress-pdf', width, state });
    if (!baseline && !diagnose) {
      assert.equal(state.overflow, false, `${width}: body overflow`);
      if (mobile) {
        assert.equal(state.expanded, 'true');
        assert.equal(state.groups.every((group, index) => index === 0 || group.y >= state.groups[index - 1].bottom - 1), true, `${width}: accordion groups must stack in one column`);
        await page.locator('#nav-pdf-trigger').click();
        assert.equal(await page.locator('#nav-pdf-trigger').getAttribute('aria-expanded'), 'false', `${width}: PDF accordion must close`);
        await page.locator('#mobile-nav-toggle').click();
      }
    }
    if ([390, 1440].includes(width)) await page.screenshot({ path: resolve(output, `compress-pdf-${width}.png`), fullPage: true, animations: 'disabled' });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await open('organize-pdf');
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 3; index++) pdf.addPage().drawText(`Responsive UX ${index + 1}`);
  await page.locator('#file-picker').setInputFiles({ name: 'organize-ux.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save({ useObjectStreams: false })) });
  await page.locator('#btn-process-action').click();
  await page.waitForFunction(() => document.getElementById('btn-download-result')?.disabled === false && !document.getElementById('tool-complete-mount')?.classList.contains('hidden'));
  const result = await page.evaluate(() => {
    const rect = node => { if (!node) return null; const box = node.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom) }; };
    const preview = document.querySelector('#premium-result-preview');
    const compare = preview?.querySelector('.premium-output-compare');
    const figure = preview?.querySelector('figure');
    const frame = preview?.querySelector('iframe');
    const stats = document.querySelector('#premium-result-stats');
    const ad = document.querySelector('[data-ad-trigger="result-ready"]');
    const download = document.querySelector('.result-download-section');
    const button = document.querySelector('#btn-download-result');
    return { preview: rect(preview), compare: rect(compare), figure: rect(figure), frame: rect(frame), previewOverflow: getComputedStyle(preview).overflow, figureOverflow: figure && getComputedStyle(figure).overflow, stats: rect(stats), ad: rect(ad), download: rect(download), button: rect(button), adState: ad?.dataset.adState, resultType: preview?.dataset.resultType, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  rows.push({ route: 'organize-pdf', width: 390, result });
  await page.screenshot({ path: resolve(output, 'organize-pdf-result-390.png'), fullPage: true, animations: 'disabled' });
  await page.locator('#tool-complete-mount').screenshot({ path: resolve(output, 'organize-pdf-result-panel-390.png'), animations: 'disabled' });
  if (!baseline && !diagnose) {
    assert.equal(result.overflow, false);
    assert.ok(result.compare.bottom <= result.preview.bottom + 1, 'PDF preview contents must remain inside the preview wrapper');
    assert.equal(result.previewOverflow, 'hidden', 'embedded PDF viewer must be clipped to its own preview section');
    assert.ok(result.stats.y >= result.preview.bottom, 'stats must follow preview');
    assert.ok(result.download.y >= result.stats.bottom, 'download must follow stats');
    assert.ok(result.button.y >= result.download.y && result.button.bottom <= result.download.bottom + 1, 'download button contained in panel');
    assert.equal(await page.locator('#result-download-title').textContent(), 'Download your PDF');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-download-result').click()]);
    assert.equal(await download.failure(), null);
    await page.locator('.result-download-section button').last().click();
    await page.locator('#tool-upload-mount').waitFor({ state: 'visible' });
  }

  if (!baseline && !diagnose) {
    await open('compress-pdf');
    await page.locator('#mobile-nav-toggle').click();
    await page.locator('#nav-image-trigger').click();
    assert.equal(await page.locator('#nav-image-trigger').getAttribute('aria-expanded'), 'true');
    await page.locator('#nav-pdf-trigger').click();
    assert.equal(await page.locator('#nav-image-trigger').getAttribute('aria-expanded'), 'false', 'only one accordion may remain open');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#mobile-nav-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#mobile-nav-toggle').evaluate(node => node === document.activeElement), true, 'Escape restores focus');
    assert.equal(await page.locator('.mobile-nav-backdrop').evaluate(node => getComputedStyle(node).pointerEvents), 'none', 'closed backdrop cannot block the page');
    await page.locator('#mobile-nav-toggle').click();
    await page.setViewportSize({ width: 1280, height: 800 });
    assert.equal(await page.evaluate(() => document.body.classList.contains('mobile-menu-open')), false, 'drawer must close on desktop resize');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#mobile-nav-toggle').getAttribute('aria-expanded'), 'false', 'mobile return must keep drawer state synchronized');
  }

  await open('compress-pdf');
  await page.locator('#mobile-nav-toggle').click();
  await page.locator('.mobile-all-tools-link a, .mobile-all-tools-link button').click();
  await page.waitForFunction(() => document.querySelector('#tools-grid-anchor'));
  if (!baseline && !diagnose) await page.waitForFunction(() => { const top = document.querySelector('#tools-grid-anchor')?.getBoundingClientRect().top; return top != null && top <= 220 && top >= -30; });
  const allTools = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, scrollY, targetTop: Math.round(document.querySelector('#tools-grid-anchor').getBoundingClientRect().top) }));
  rows.push({ route: 'all-tools', width: 390, allTools });
  if (!baseline && !diagnose) assert.ok(allTools.targetTop <= 220 && allTools.targetTop >= -30 && allTools.scrollY > 0 && allTools.hash === '#tools-grid-anchor', `All Tools must arrive at directory: ${JSON.stringify(allTools)}`);
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ baseline, rows, errors }, null, 2));
  if (!baseline && !diagnose) assert.deepEqual(errors, []);
} finally {
  await context.close();
  await browser.close();
  await new Promise(done => server.close(done));
}
console.log(`Responsive UX DOM ${baseline ? 'baseline' : 'verification'}: ${rows.length} records.`);
