import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext();
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|bauval\.org|abscloud\.org/, route => route.abort());
const page = await context.newPage();
const errors = [], rows = [];
page.on('pageerror', error => errors.push(error.message));
const output = resolve('test-results/home-marquee-layout');
await mkdir(output, { recursive: true });

try {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('.trust-marquee__track')) && !document.querySelector('[data-static-route-shell]'));
    const state = await page.evaluate(() => {
      const hero = document.querySelector('.premium-hero').getBoundingClientRect();
      const strip = document.querySelector('.trust-marquee').getBoundingClientRect();
      const search = document.querySelector('.command-search-section').getBoundingClientRect();
      const button = document.querySelector('.home-command-search').getBoundingClientRect();
      const track = document.querySelector('.trust-marquee__track');
      return {
        heroBottom: hero.bottom, stripTop: strip.top, stripBottom: strip.bottom,
        searchTop: search.top, searchBottom: search.bottom, buttonTop: button.top,
        gap: strip.top - search.bottom,
        stripHeight: strip.height,
        running: getComputedStyle(track).animationName !== 'none',
        overflow: document.documentElement.scrollWidth > innerWidth + 1
      };
    });
    assert.ok(state.searchTop >= state.heroBottom - 1, `${width}: search must follow the hero`);
    assert.ok(state.gap >= 0, `${width}: trust section overlaps search (${JSON.stringify(state)})`);
    assert.ok(state.stripHeight >= 44, `${width}: marquee is clipped vertically`);
    assert.ok(state.buttonTop < state.stripTop, `${width}: search must appear before the trust marquee`);
    assert.equal(await page.locator('.trust-marquee__copy:first-child .trust-marquee__item').count(), 8);
    assert.equal(await page.locator('.trust-marquee__copy[aria-hidden="true"]').count(), 1);
    assert.equal(await page.locator('#trust-showcase-title').textContent(), 'Trusted by 5 Million+ Users');
    assert.equal(state.overflow, false, `${width}: horizontal body overflow`);
    assert.equal(state.running, true, `${width}: marquee animation stopped`);
    await page.locator('.home-command-search').click();
    assert.ok(await page.locator('[role="dialog"]').count(), `${width}: search control must remain functional`);
    rows.push({ width, ...state });
    if ([390, 1440].includes(width)) {
      await page.keyboard.press('Escape');
      await page.screenshot({ path: resolve(output, `home-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('.trust-marquee__track')) && !document.querySelector('[data-static-route-shell]'));
  assert.equal(await page.locator('.trust-marquee__track').evaluate(node => getComputedStyle(node).animationName), 'none', 'Reduced motion must stop animation.');
  assert.equal(await page.locator('.trust-marquee__copy:first-child .trust-marquee__item:visible').count(), 8, 'Reduced motion must retain the primary organization sequence.');
  assert.equal(await page.locator('.trust-marquee__copy[aria-hidden="true"]:visible').count(), 0, 'Reduced motion must hide the duplicate sequence.');
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ rows, errors, reducedMotion: true }, null, 2));
} finally {
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
console.log(`Home marquee layout passed: ${rows.length} responsive widths, search interaction, reduced motion and no overflow.`);
