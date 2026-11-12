import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext();
let writes = 0;
await context.route('**/.netlify/functions/admin-session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, authenticated: true }) }));
await context.route('**/.netlify/functions/blog-admin*', route => {
  if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, items: [], hasNext: false }) });
  writes++;
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, post: { id:'11111111-1111-4111-8111-111111111111', version: 1, slug:'example-blog-post', status:'draft' }, cachePurged: true }) });
});
const page = await context.newPage();
const screenshots = resolve('test-results/blog-studio');
await mkdir(screenshots, { recursive: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 740 : 900 });
    await page.goto(`${origin}/admin/blog/`, { waitUntil: 'domcontentloaded' });
    await page.locator('#new-post').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}: Blog Studio overflow`);
    await page.locator('#new-post').click();
    assert.equal(await page.locator('#article-form').isVisible(), true);
    await page.locator('#post-title').fill('Example blog post');
    assert.equal(await page.locator('#post-slug').inputValue(), 'example-blog-post');
    if ([390, 1440].includes(width)) await page.screenshot({ path: resolve(screenshots, `editor-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.locator('[data-view="media"]').click();
    assert.equal(await page.locator('#media-file').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}: media view overflow`);
  }
  assert.equal(writes, 0, 'UI browsing should not mutate the database');
  assert.deepEqual(errors, []);
  console.log('Blog Studio browser passed: four responsive widths, authenticated list, article editor, slug generation, media view, no overflow or writes.');
} finally {
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
