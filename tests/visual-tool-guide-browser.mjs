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
page.setDefaultNavigationTimeout(90000);
const output = resolve('test-results/visual-tool-guides');
await mkdir(output, { recursive: true });
const rows = [], errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const route of ['merge-pdf', 'crop-image', 'image-converter', 'json-tool', 'emi-calculator']) {
      await page.goto(`${origin}/${route}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('[data-static-route-shell]') && Boolean(document.querySelector('.tool-steps--visual')));
      const state = await page.evaluate(() => {
        const guide = document.querySelector('.tool-steps--visual');
        const workspace = document.querySelector('.tool-workspace, .crop-editor-grid, #image-converter-mount, .premium-editor-workspace, .tool-interactive-area');
        const steps = [...guide.querySelectorAll('.tool-guide-step')];
        return {
          guideTool: guide.dataset.guideTool,
          count: steps.length,
          gridColumns: getComputedStyle(guide).gridTemplateColumns.split(' ').length,
          visualCount: guide.querySelectorAll('.tool-guide-step__art svg').length,
          firstToolVisual: Boolean(guide.querySelector('[data-tool-illustration]')),
          guideTop: Math.round(guide.getBoundingClientRect().top + scrollY),
          workspaceBottom: workspace ? Math.round(workspace.getBoundingClientRect().bottom + scrollY) : null,
          overflowingStep: steps.findIndex(step => step.scrollWidth > step.clientWidth + 1),
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1
        };
      });
      assert.equal(state.guideTool, route);
      assert.ok(state.count >= 4 && state.visualCount === state.count && state.firstToolVisual);
      assert.equal(state.pageOverflow, false, `${route} ${width}: page overflow`);
      assert.equal(state.overflowingStep, -1, `${route} ${width}: guide card overflow`);
      assert.ok(state.workspaceBottom === null || state.guideTop >= state.workspaceBottom, `${route} ${width}: guide must follow workspace`);
      assert.equal(state.gridColumns, width <= 600 ? 1 : width <= 900 ? 2 : 3, `${route} ${width}: visual guide columns`);
      rows.push({ route, width, ...state });
      if (route === 'merge-pdf' && [390, 1440].includes(width)) {
        await page.locator('.tool-steps--visual').screenshot({ path: resolve(output, `${route}-${width}.png`), animations: 'disabled' });
      }
    }
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('.everyday-audience__list')) && !document.querySelector('[data-static-route-shell]'));
    assert.equal(await page.locator('.everyday-audience__list li').count(), 8);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/background-remover/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('[data-static-route-shell]') && document.querySelector('.tool-steps--visual[data-guide-tool="background-remover"]'));
  assert.equal(await page.locator('.tool-steps--visual[data-guide-tool="background-remover"] .tool-guide-step').count(), 4);
  assert.equal(await page.locator('.tool-steps--visual[data-guide-tool="background-remover"] .tool-guide-step__art svg').count(), 4);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.locator('.tool-steps--visual[data-guide-tool="background-remover"]').screenshot({ path: resolve(output, 'background-remover-390.png'), animations: 'disabled' });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ rows, errors }, null, 2));
} finally {
  await context.close();
  await browser.close();
  await new Promise(done => server.close(done));
}
console.log(`Visual guide browser passed: ${rows.length} tool/width checks and four homepage checks.`);
