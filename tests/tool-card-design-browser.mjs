// Production output, real Chrome rendering/input; isolated local preferences only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const tools = await loadToolRegistry();
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const evidence = resolve('test-results/tool-card-design');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.GXA_BROWSER_EXECUTABLE ? { executablePath: process.env.GXA_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ hasTouch: true });
// Never send test visits to production tracking or create ad impressions.
await context.route(/googletagmanager|google-analytics|googlesyndication|doubleclick/, route => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
const cards = () => page.locator('#tools-grid-container .tool-tile');
const screenshot = name => page.screenshot({ path: resolve(evidence, name + '.png'), animations: 'disabled' });
const viewDirectory = () => page.locator('.tools-directory > .section-heading-row').evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
async function assertCount(expected) { assert.equal(await cards().count(), expected); }
try {
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.tool-tile');
  await page.evaluate(() => document.fonts.ready);
  await assertCount(tools.length);
  assert.equal(await page.locator('.tool-card-link button').count(), 0, 'Favorites must not be nested in links');
  const links = await cards().locator('a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  assert.deepEqual(links, tools.map(tool => '/' + tool.id + '/'));
  const svgErrors = await page.locator('.tool-tile .gxa-tool-icon').evaluateAll(nodes => nodes.filter(svg => new DOMParser().parseFromString(svg.outerHTML, 'image/svg+xml').querySelector('parsererror')).length);
  assert.equal(svgErrors, 0);

  for (const width of [320, 360, 375, 390, 412, 430, 480, 600, 768, 820, 1024, 1280, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await viewDirectory();
    await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('.tools-directory').style.getPropertyValue('--browse-header-height')) - document.querySelector('#navbar').getBoundingClientRect().height) < 1);
    const geometry = await page.evaluate(() => {
      const rect = element => element.getBoundingClientRect();
      const grid = document.querySelector('.tools-grid');
      const input = document.querySelector('#tool-search');
      const icon = rect(document.querySelector('.tool-filter-bar .search-icon'));
      const tiles = [...grid.querySelectorAll('.tool-tile')];
      return {
        width: innerWidth, overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth,
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        cardHeight: rect(tiles[0]).height,
        inputClearance: rect(input).left + parseFloat(getComputedStyle(input).paddingLeft) - icon.right,
        clippedTitles: tiles.filter(tile => { const title = tile.querySelector('h3'); return title.scrollWidth > title.clientWidth + 1; }).length,
        smallStars: tiles.filter(tile => { const r = rect(tile.querySelector('button')); return r.width < 44 || r.height < 44; }).length,
        smallTabs: [...document.querySelectorAll('.filter-tab')].filter(tab => rect(tab).height < 44).length,
        headerBrand: document.querySelector('.logo')?.textContent || document.querySelector('#navbar').innerText
      };
    });
    assert(geometry.overflow <= 1, JSON.stringify(geometry));
    assert(geometry.inputClearance >= 10, 'Search icon overlaps input at ' + width);
    assert.equal(geometry.clippedTitles, 0, 'Tool title clipping at ' + width);
    assert.equal(geometry.smallStars + geometry.smallTabs, 0, 'Touch target size at ' + width);
    assert.match(geometry.headerBrand, /GXA\s*Toolbox/);
    results.push(geometry);
    if ([320, 390, 768, 1440].includes(width)) await screenshot('after-' + width);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await viewDirectory();
  const star = page.locator('[data-favorite-tool="merge-pdf"]').first();
  await star.focus();
  await star.press('Space');
  assert.equal(await star.getAttribute('aria-pressed'), 'true');
  assert(await star.evaluate(el => el === document.activeElement), 'Saving must preserve keyboard focus');
  assert.equal(new URL(page.url()).pathname, '/');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tool-tile');
  assert.equal(await star.getAttribute('aria-pressed'), 'true', 'Favorites must survive a reload');
  await viewDirectory();
  await page.locator('.filter-tab[data-category="saved"]').tap();
  await assertCount(1);
  await star.tap();
  await assertCount(0);
  assert.match(await page.locator('.tools-empty-state').innerText(), /Your favorites start here/);
  await page.locator('.tools-empty-state button').tap();
  await assertCount(tools.length);

  for (const category of new Set(tools.map(tool => tool.category))) {
    await page.locator('.filter-tab[data-category="' + category + '"]').tap();
    await assertCount(tools.filter(tool => tool.category === category).length);
    assert.equal(await page.locator('.filter-tab[aria-pressed="true"]').count(), 1);
  }
  await page.locator('#clear-tool-filters').tap();
  await page.locator('#tool-search').fill('zzzz-no-such-tool');
  await assertCount(0);
  await page.locator('.tools-empty-state button').tap();
  await page.locator('#tool-search').fill('crop');
  await assertCount(tools.filter(tool => /crop/i.test(tool.name + ' ' + tool.desc)).length);
  const crop = page.locator('.tool-card-link[href="/crop-image/"]').first();
  // Modified clicks retain their native browser link semantics.
  assert.equal(await crop.evaluate(el => { const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }); el.dispatchEvent(event); return event.defaultPrevented; }), false);
  await crop.tap();
  await page.waitForURL('**/crop-image/');
  assert.equal(await page.locator('#related-tools-grid .tool-tile').count(), 4);
  assert.equal(await page.locator('#related-tools-grid .gxa-tool-icon').count(), 4);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tool-search');
  assert.equal(await page.locator('#tool-search').inputValue(), 'crop');
  await page.locator('#clear-tool-filters').tap();

  // Filtering from far down the directory must not leave the viewport below its new results.
  await page.evaluate(() => window.scrollTo({ top: document.querySelector('.tools-grid').offsetTop + 2000, behavior: 'instant' }));
  const dock = page.locator('.tool-filter-bar');
  const header = page.locator('#navbar');
  assert((await dock.boundingBox()).y >= (await header.boundingBox()).height, 'Sticky filters cover header');
  await page.locator('#tool-search').fill('merge');
  assert(await cards().first().isVisible());
  const first = await cards().first().boundingBox();
  const bar = await dock.boundingBox();
  assert(first.y >= bar.y + bar.height - 1 && first.y < 844, 'Search results must appear below sticky bar');
  await page.locator('#clear-tool-filters').tap();
  await page.locator('#tool-search').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.tool-card-link').first().evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
  await screenshot('keyboard-focus');

  await page.locator('#theme-toggle-btn').tap();
  await viewDirectory();
  await screenshot('after-dark-390');
  assert(await page.locator('body').evaluate(el => el.classList.contains('dark-mode')));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screenshot('after-dark-1440');
  await page.locator('#theme-toggle-btn').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await cards().first().evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(value => parseFloat(value) <= 0.00001)), 'Reduced motion must suppress visible transitions, including the existing global .01ms reset');
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(await dock.evaluate(el => getComputedStyle(el).position), 'static', 'Landscape toolbar must not occupy most of screen');
  await viewDirectory();
  await screenshot('after-landscape');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#mobile-nav-toggle').tap();
  assert.equal(await page.locator('#mobile-nav-toggle').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#mobile-nav-toggle').getAttribute('aria-expanded'), 'false');
  await page.locator('.command-trigger').tap();
  assert(await page.locator('.command-result-icon .gxa-tool-icon').count() > 0);
  await screenshot('command-search');
  await page.keyboard.press('Escape');

  // Local design contact sheet, generated by the actual icon renderer; never production content.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    const main = document.querySelector('#main-content');
    main.replaceChildren();
    const sheet = document.createElement('section');
    sheet.style.cssText = 'display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:20px;padding:32px;margin-top:72px;background:var(--color-bg)';
    toolsList.forEach(tool => {
      const tile = document.createElement('div');
      tile.className = 'tool-tile cat-' + tool.category;
      tile.style.cssText = 'display:grid;justify-items:center;gap:12px;padding:16px;border:0;text-align:center;font-size:12px;color:var(--color-text-primary)';
      tile.innerHTML = GxaToolIcons.svg(tool.id);
      const label = document.createElement('span'); label.textContent = tool.name; tile.append(label); sheet.append(tile);
    });
    main.append(sheet); window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.locator('#main-content').screenshot({ path: resolve(evidence, 'all-95-illustrations.png'), animations: 'disabled' });
  assert.deepEqual(errors, [], 'Unexpected browser runtime errors');
  await writeFile(resolve(evidence, 'results.json'), JSON.stringify({ tools: tools.length, viewports: results, passed: ['95 valid distinct icons and native links', 'touch filters and search', 'favorite persistence/focus and empty state', 'related cards', 'navigation and Back state', 'sticky result visibility', 'keyboard focus', 'dark mode', 'reduced motion', 'landscape', 'mobile menu', 'command search'], pageErrors: errors }, null, 2));
  console.log('Tool-card browser QA passed: ' + tools.length + ' cards; ' + results.length + ' widths; touch, keyboard, navigation, filters, favorites, light/dark and reduced motion. Evidence: ' + evidence);
} finally {
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
