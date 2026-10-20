import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { loadToolRegistry, loadToolQuality, loadContentPageRegistry } from '../scripts/tool-registry.mjs';
import config from '../public_html/assets/ad-config.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const tools = await loadToolRegistry();
const quality = await loadToolQuality();
const content = await loadContentPageRegistry();
const eligible = ['', ...tools.filter(tool => quality[tool.id].adsEligible).map(tool => tool.id), ...content.filter(page => ['guide', 'category'].includes(page.kind)).map(page => page.id)];
const excluded = content.filter(page => !['guide', 'category'].includes(page.kind)).map(page => page.id);
const width = Number(process.argv[2] || 1920);
assert.ok([390, 768, 1024, 1280, 1440, 1600, 1920].includes(width), 'Use one of the audited viewport widths');
const server = createQaServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width, height: 900 } });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
const rows = [], errors = [];
const navigationRetries = [];
let requests = [];
await context.route(/bauval\.org|abscloud\.org/, async route => {
  const url = route.request().url();
  const unit = config.banners.find(item => item.src === url);
  const intrusive = Object.values(config.intrusive).find(item => item.src === url);
  assert.ok(unit || url === config.native.src || intrusive?.enabled, `Unexpected provider URL: ${url}`);
  requests.push(url);
  // Controlled local response proves request wiring and slot lifecycle only.
  // It is not an Adsterra creative and cannot count as a real impression.
  const body = intrusive
    ? `document.documentElement.dataset.gxaFixture${intrusive.unitId}='loaded';`
    : unit
    ? `const f=document.createElement('iframe');f.width='${unit.width}';f.height='${unit.height}';f.srcdoc='<a href="https://example.com/">LOCAL TEST FIXTURE</a>';document.currentScript.parentElement.append(f);`
    : `const c=document.getElementById('${config.native.containerId}');const a=document.createElement('a');a.href='https://example.com/';a.textContent='LOCAL TEST FIXTURE';c.append(a);`;
  await route.fulfill({ contentType: 'application/javascript', body: `(function(){${body}})();` });
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror', error => errors.push(error.message));
try {
  for (const id of eligible) {
    requests = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(`${origin}/${id ? `${id}/` : ''}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (id === 'background-remover') await page.waitForSelector('#root main', { timeout: 20000 });
        else await page.waitForFunction(() => !document.querySelector('[data-static-route-shell]') && document.querySelector('#main-content h1'), null, { timeout: 20000 });
        await page.waitForFunction(() => window.GxaAdNetwork && document.querySelector('.gxa-ad-network'), null, { timeout: 20000 });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        navigationRetries.push({ route: id || '/', attempt: attempt + 1, reason: error.message.split('\n')[0] });
        requests = [];
      }
    }
    // Homepage editorial content can hydrate a frame after the first slot.
    if (!id) await page.waitForFunction(() => document.querySelectorAll('.gxa-ad-network').length >= 2);
    const planned = await page.locator('.gxa-ad-network').evaluateAll(nodes => nodes.map(node => ({ zone: node.dataset.adLayoutZone, format: node.dataset.adFormat })));
    for (const { zone } of planned) {
      await page.evaluate(value => document.querySelector(`[data-ad-layout-zone="${value}"]`)?.previousElementSibling?.scrollIntoView({ block: 'center' }), zone);
      await page.waitForFunction(value => document.querySelector(`[data-ad-layout-zone="${value}"]`)?.dataset.adState !== 'waiting', zone);
    }
    await page.waitForFunction(() => [...document.querySelectorAll('.gxa-ad-network')].every(node => node.dataset.adState !== 'loading'));
    const actual = await page.locator('.gxa-ad-network').evaluateAll(nodes => nodes.map(node => ({
      zone: node.dataset.adLayoutZone, format: node.dataset.adFormat, state: node.dataset.adState,
      reason: node.dataset.adCollapseReason || null, rendered: !node.hidden,
      unitKey: node.querySelector('script[src*="bauval.org"]')?.getAttribute('src')?.split('/').pop() || null,
      insideWorkspace: Boolean(node.closest('.tool-workspace, #edit-pdf-mount, #image-converter-mount, .premium-editor-workspace'))
    })));
    assert.equal(new Set(requests).size, requests.length, `${id || '/'} duplicated a provider request`);
    assert.equal(requests.filter(url => url === config.intrusive.popunder.src).length, 1, `${id || '/'}: one Popunder bootstrap`);
    assert.equal(requests.filter(url => url === config.intrusive.socialBar.src).length, 1, `${id || '/'}: one Social Bar bootstrap`);
    assert.ok(!requests.includes(config.intrusive.smartlink.src));
    const routePath = `/${id ? `${id}/` : ''}`;
    assert.deepEqual(await page.evaluate(() => GxaAdIntrusive.status()), {
      popunder: { unitId: 31513006, src: 'https://abscloud.org/1/3a66eef4b20eb6bc449cee178926437d', state: 'loaded', route: routePath },
      'social-bar': { unitId: 31513007, src: 'https://bauval.org/14/fcd69a971630acd0557b6a7e1c55ba85', state: 'loaded', route: routePath }
    });
    assert.ok(actual.every(slot => !slot.insideWorkspace));
    assert.ok(actual.every(slot => slot.rendered && slot.state === 'mounted'), `${id || '/'}: ${JSON.stringify(actual)}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id || '/'} overflows`);
    const railGeometry = await page.evaluate(() => {
      const box = element => { if (!element) return null; const r = element.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) }; };
      return { workspace: box(document.querySelector('.tool-container > .tool-workspace, .tool-container > #edit-pdf-mount, .tool-container > #image-converter-mount, .tool-container > #crop-editor-workspace, .tool-container > #gps-map-camera-mount, #root .upload-page .drop-zone')),
        left: box(document.querySelector('[data-ad-layout-zone="left"]')), right: box(document.querySelector('[data-ad-layout-zone="right"]')) };
    });
    rows.push({ route: routePath, planned, actual, requests, railGeometry });
    console.log(`${id || '/'}: ${planned.map(slot => slot.zone).join(', ')}`);
  }
  for (const id of excluded) {
    requests = [];
    await page.goto(`${origin}/${id}/`, { waitUntil: 'commit', timeout: 60000 });
    assert.equal(await page.locator('.gxa-ad-network').count(), 0, id);
    assert.equal(await page.evaluate(() => window.GxaAdNetwork?.eligible() ?? false), false, id);
    assert.equal(requests.length, 0, id);
  }
  assert.deepEqual(errors, []);
} finally {
  await mkdir(resolve('test-results/ad-coverage'), { recursive: true });
  await writeFile(resolve(`test-results/ad-coverage/results-${width}.json`), JSON.stringify({ source: 'local fixture, not real creative fill', viewport: width, publicUrls: 1 + tools.filter(tool => quality[tool.id].adsEligible).length + content.length, eligibleUrls: eligible.length, excludedCompanyUrls: excluded.length, rows, errors, navigationRetries }, null, 2));
  await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(`Ad coverage fixture passed at ${width}px: ${rows.length} eligible URLs; ${excluded.length} company/legal URLs intentionally ad-free.`);
