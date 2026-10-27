import assert from 'node:assert/strict';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
import sharp from 'sharp';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

const output = 'test-results/advanced-engine';
await mkdir(output, { recursive: true });
const server = createQaServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { date: new Date().toISOString(), browsers: [], routes: [], workflows: [], failures: [], limitations: ['Route smoke is not processing verification.', 'No physical devices tested.', 'Private/API/advertising requests disabled during local QA.'] };
const browsers = [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]];
async function downloadBytes(download) {
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
try {
  for (const [name, launcher] of browsers) {
    try { await access(launcher.executablePath()); }
    catch { report.browsers.push({ name, status: 'NOT TESTED', reason: 'Browser binary is not installed.' }); continue; }
    const browser = await launcher.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|\/api\/|\/\.netlify\//, route => route.abort());
    await cachePublicDependencies(context);
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push({ url: page.url(), message: error.message }));
    async function open(id) {
      await page.goto(`${origin}/${id}/`, { waitUntil: 'domcontentloaded' });
      if (id === 'background-remover') await page.waitForSelector('#root main');
      else await page.waitForFunction(() => typeof window.navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
    }
    try {
      for (const [id, input, outputId, source, downloadFunction] of [
        ['js-beautifier', 'opt-js-raw', 'generated-js-display', 'const text="a;b{c}";const x={a:[1,2]};', 'downloadJsFile'],
        ['css-beautifier', 'opt-css-raw', 'generated-css-display', '.x::after{content:"a;b{c}";color:red}', 'downloadCssFile'],
        ['html-beautifier', 'opt-html-beaut-raw', 'generated-html-beaut-display', '<div><pre>one  two</pre><b>Hi</b></div>', 'downloadHtmlBeautFile'],
        ['sql-formatter', 'opt-sql-raw', 'generated-sql-display', "select 'from  where' as x from t", 'downloadSqlFile']
      ]) {
        await open(id);
        await page.locator(`#${input}`).fill(source);
        await page.waitForFunction(id => !!document.getElementById(id), outputId);
        const text = await page.locator(`#${outputId}`).inputValue();
        assert.ok(text.length > 0);
        if (id === 'js-beautifier' || id === 'css-beautifier') assert.ok(text.includes('"a;b{c}"'));
        if (id === 'sql-formatter') assert.ok(text.includes("'from  where'"));
        const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(fn => window[fn](), downloadFunction)]);
        assert.equal((await downloadBytes(download)).toString(), text);
        report.workflows.push({ browser: name, id, passed: true, evidence: 'Actual UI input; local worker; real download bytes equal preview.' });
      }
      await open('regex-tester');
      const regexResult = await page.evaluate(async () => {
        const { runJob } = await import('/assets/engine-jobs.js');
        const start = performance.now(); let heartbeats = 0;
        const timer = setInterval(() => heartbeats++, 20);
        try { await runJob('regex', { pattern: '(a+)+$', flags: '', subject: 'a'.repeat(40) + '!' }, {}, 'regex', 400); return { unexpectedSuccess: true }; }
        catch (error) { return { error: error.message, elapsedMs: performance.now() - start, heartbeats }; }
        finally { clearInterval(timer); }
      });
      assert.match(regexResult.error, /time limit/); assert.ok(regexResult.heartbeats > 2);
      report.workflows.push({ browser: name, id: 'regex-tester', passed: true, evidence: 'Real catastrophic regex terminated; UI heartbeat continued.', ...regexResult });
      await open('png-to-svg');
      const pixels = Buffer.alloc(64 * 64 * 4);
      for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) { const i = (y * 64 + x) * 4; pixels[i] = 255; pixels[i + 3] = 255; }
      const png = await sharp(pixels, { raw: { width: 64, height: 64, channels: 4 } }).png().toBuffer();
      await page.locator('#file-picker').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
      await page.locator('#btn-process-action').click();
      await page.waitForFunction(() => !document.getElementById('btn-download-result')?.disabled);
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-download-result:visible').click()]);
      const svg = await downloadBytes(download);
      assert.match(svg.toString(), /<path\b/); assert.doesNotMatch(svg.toString(), /<image\b/);
      await sharp(svg).png().toBuffer();
      await page.screenshot({ path: `${output}/${name}-trace-mobile.png`, fullPage: true });
      report.workflows.push({ browser: name, id: 'png-to-svg', passed: true, evidence: 'Real PNG upload/process/SVG download; independently reopened with sharp.' });
      report.browsers.push({ name, status: 'focused workflows passed' });
      if (name === 'chromium') {
        for (const tool of await loadToolRegistry()) {
          const row = { id: tool.id, widths: [], processing: 'NOT TESTED by route smoke' };
          try {
            await open(tool.id);
            for (const width of [390, 768, 1440]) {
              await page.setViewportSize({ width, height: 900 });
              await page.waitForTimeout(100);
              const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
              assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
              row.widths.push(width);
            }
            row.passed = true;
          } catch (error) { row.passed = false; row.error = error.message; }
          report.routes.push(row);
          console.log(`${tool.id}: ${row.passed ? 'three-width route smoke passed' : row.error}`);
        }
      }
    } catch (error) { report.failures.push({ browser: name, error: error.stack }); }
    finally { report.failures.push(...errors); await context.close(); await browser.close(); }
  }
} finally {
  await writeFile(`${output}/browser-results.json`, JSON.stringify(report, null, 2));
  await new Promise(resolve => server.close(resolve));
}
assert.equal(report.failures.length, 0, JSON.stringify(report.failures));
assert.ok(report.routes.every(row => row.passed), JSON.stringify(report.routes.filter(row => !row.passed)));
console.log(`${report.workflows.length} focused workflows; ${report.routes.length} route smoke checks.`);
