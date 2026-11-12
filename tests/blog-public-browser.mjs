import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase } from '@netlify/database';
import { NetlifyDB } from '@netlify/database-dev';
import { createQaServer } from './browser-qa-server.mjs';
import { setDatabaseClientForTests } from '../netlify/functions/_database.mjs';
import { saveAdminPost } from '../netlify/functions/_blog-store.mjs';
import articleHandler from '../netlify/functions/blog-public.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const local = new NetlifyDB({ logger: () => {} });
const server = createQaServer();
let database, browser;
try {
  const connectionString = await local.start();
  await local.applyMigrations(fileURLToPath(new URL('../netlify/database/migrations', import.meta.url)));
  database = getDatabase({ connectionString }); setDatabaseClientForTests(database);
  await saveAdminPost(database.pool, { sub: 'local-blog-test' }, {
    title: 'How to check a PDF after merging', slug: 'check-merged-pdf', excerpt: 'Review the order and readability of a merged PDF.',
    markdown: '## Check the page sequence\n\nOpen the merged document and confirm that its cover, body and appendix follow the intended order.\n\n## Inspect readability\n\nCheck fine print and important links before sharing the result.',
    status: 'published', noindex: false, author_name: 'GXA Technologies', categories: ['PDF'], tags: ['merge']
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext();
  await context.route('**/blog/check-merged-pdf/', async route => {
    const response = await articleHandler(new Request('https://gxatoolbox.in/blog/check-merged-pdf/?slug=check-merged-pdf'));
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = resolve('test-results/blog-public'); await mkdir(output, { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto(`${origin}/blog/check-merged-pdf/`, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.title(), 'How to check a PDF after merging | GXA Toolbox');
    assert.equal(await page.locator('h1').textContent(), 'How to check a PDF after merging');
    assert.equal(await page.locator('.blog-prose h2').count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}: public article overflow`);
    await page.screenshot({ path: resolve(output, `article-${width}.png`), fullPage: true, animations: 'disabled' });
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Public blog browser passed: real PostgreSQL article rendered to HTML at 390 and 1440px, correct metadata/headings, no overflow.');
} finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise(done => server.close(done));
  setDatabaseClientForTests(undefined);
  if (database?.pool) await database.pool.end();
  await local.stop();
}
