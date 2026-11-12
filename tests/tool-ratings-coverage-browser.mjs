import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createQaServer } from './browser-qa-server.mjs';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

const server = createQaServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|bauval\.org|abscloud\.org/, route => route.abort());
await context.route('**/api/tool-ratings**', route => route.fulfill({
  contentType: 'application/json',
  body: JSON.stringify({ success: true, available: true, aggregate: { average: null, count: 0 } })
}));
const page = await context.newPage();
const missing = [];
let checked = 0;
try {
  for (const tool of await loadToolRegistry()) {
    if (['background-remover', 'ppt-to-pdf'].includes(tool.id)) continue;
    await page.goto(`${origin}/${tool.id}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
    try {
      await page.waitForFunction(id => {
        const rating = document.querySelector(`[data-tool-rating][data-tool-id="${id}"]`);
        return rating?.dataset.ratingAvailable === 'true' && rating.querySelectorAll('[data-rating-value]').length === 5;
      }, tool.id, { timeout: 10000 });
      checked++;
    } catch {
      missing.push(tool.id);
    }
  }
  assert.deepEqual(missing, [], `Missing rating component on: ${missing.join(', ')}`);
  assert.equal(checked, 93);
  console.log(`Rating component coverage passed: ${checked} main-app routes with real-API-shaped zero-rating fixtures; Background Remover separately gated after export; PPT to PDF intentionally excluded.`);
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
