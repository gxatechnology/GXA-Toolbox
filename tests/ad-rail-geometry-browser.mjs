import { chromium } from 'playwright';
import { createQaServer } from './browser-qa-server.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import config from '../public_html/assets/ad-config.js';

const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1920, height: 900 } });
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
const realProvider = process.argv.includes('--real') || process.env.GXA_AD_RAIL_REAL === '1';
const providerRequests = [];
const providerResponses = [];
const providerFailures = [];
context.on('request', request => { if (/bauval\.org|abscloud\.org/.test(request.url())) providerRequests.push(request.url()); });
context.on('response', response => { if (/bauval\.org|abscloud\.org/.test(response.url())) providerResponses.push({ url: response.url(), status: response.status() }); });
context.on('requestfailed', request => { if (/bauval\.org|abscloud\.org/.test(request.url())) providerFailures.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }); });
// Deterministic layout fixture by default; real mode makes genuine provider requests.
if (!realProvider) await context.route(/bauval\.org|abscloud\.org/, async route => {
  const url = route.request().url();
  const key = url.split('/').pop();
  const intrusive = Object.values(config.intrusive).find(item => item.src === url);
  const dimensions = {
    '82dc3dcdb859ef27455f631d49183d07': [728, 90],
    '2cc9598f48bdcb102277c47352490483': [300, 250],
    'eb9ac703bb90ff49c53631490a2933f5': [320, 50],
    'a141cf44861510c02f8b814719a223bf': [468, 60],
    '983c84b73f5901c5877413ab9680312e': [160, 600],
    '900dabd0bb67d683bd5dbc7486b6d25a': [160, 300]
  };
  const size = dimensions[key];
  const body = intrusive
    ? `document.documentElement.dataset.gxaFixture${intrusive.unitId}='loaded';`
    : size
    ? `const f=document.createElement('iframe');f.width='${size[0]}';f.height='${size[1]}';f.srcdoc='<a href="https://example.com/">LOCAL TEST FIXTURE</a>';document.currentScript.parentElement.append(f);`
    : `const c=document.getElementById('container-b1b26904317d94da1830e1f5dd69d6d9');if(c){const a=document.createElement('a');a.href='https://example.com/';a.textContent='LOCAL TEST FIXTURE';c.append(a);}`;
  await route.fulfill({ contentType: 'application/javascript', body: `(function(){${body}})();` });
});
const page = await context.newPage();
const rows = [];
const requestedRoutes = process.argv.slice(2).filter(value => !value.startsWith('--'));
const routes = requestedRoutes.length ? requestedRoutes : ['compress-pdf', 'merge-pdf', 'compress-image', 'image-converter', 'organize-pdf', 'edit-pdf', 'background-remover', 'gst-calculator'];
const widths = process.argv.find(value => value.startsWith('--width='))?.slice(8).split(',').map(Number) || [1280, 1440, 1600, 1920];
const browserErrors = [];
page.on('pageerror', error => browserErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to load/i.test(message.text())) browserErrors.push(message.text()); });
await mkdir(resolve('test-results/ad-rails'), { recursive: true });
try {
  for (const id of routes) for (const width of widths) {
    const requestStart = providerRequests.length;
    await page.setViewportSize({ width, height: 900 });
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await page.goto(`${origin}/${id}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }); break; }
      catch (error) { if (attempt === 2) throw error; await page.waitForTimeout(500); }
    }
    if (id === 'background-remover') await page.waitForSelector('#root main');
    else {
      await page.waitForFunction(() => !document.querySelector('[data-static-route-shell]'));
      if (id === 'edit-pdf') await page.waitForSelector('.pdf-edit-upload');
    }
    await page.waitForTimeout(realProvider ? 2500 : 500);
    const row = await page.evaluate(() => {
      const rect = element => {
        if (!element) return null;
        const r = element.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
      };
      const first = selectors => selectors.map(selector => document.querySelector(selector)).find(element => element && element.getClientRects().length);
      const shell = first(['.tool-container', '#root main']);
      const workspace = first(['.upload-zone', '.image-converter__drop', '.pdf-edit-upload', '.crop-canvas-stage', '.gps-studio__upload', '.bg-remover-upload-zone', '.tool-interactive-area', '.premium-editor-workspace', '#root main']);
      const left = document.querySelector('[data-ad-layout-zone="left"]');
      const right = document.querySelector('[data-ad-layout-zone="right"]');
      return {
        shell: rect(shell), workspace: rect(workspace), left: rect(left), right: rect(right),
        disclosure: shell?.dataset.disclosure || null,
        workspaceParent: rect(workspace?.closest('.tool-workspace, #image-converter-mount, #edit-pdf-mount, #crop-editor-workspace, #gps-map-camera-mount')),
        workspaceGrid: shell?.querySelector('.tool-workspace') ? getComputedStyle(shell.querySelector('.tool-workspace')).gridTemplateColumns : null,
        background: document.body.classList.contains('gxa-ad-background-rails') ? {
          bodyGrid: getComputedStyle(document.body).gridTemplateColumns,
          children: [...document.body.children].filter(element => element.id === 'root' || element.classList.contains('gxa-ad-rail')).map(element => ({ name: element.id || element.dataset.adLayoutZone, grid: getComputedStyle(element).gridColumn, box: rect(element) })),
          drop: rect(document.querySelector('.upload-page .drop-zone'))
        } : null,
        leftState: left?.dataset.adState || null, rightState: right?.dataset.adState || null,
        leftStyle: left ? { position: getComputedStyle(left).position, display: getComputedStyle(left).display, visibility: getComputedStyle(left).visibility, parent: left.parentElement?.className } : null,
        rightStyle: right ? { position: getComputedStyle(right).position, display: getComputedStyle(right).display, visibility: getComputedStyle(right).visibility, parent: right.parentElement?.className } : null,
        bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        workspaceLeftSpace: workspace ? Math.round(workspace.getBoundingClientRect().left) : null,
        workspaceRightSpace: workspace ? Math.round(innerWidth - workspace.getBoundingClientRect().right) : null
      };
    });
    const requested = providerRequests.slice(requestStart);
    const target = row.background?.drop || row.workspaceParent || row.workspace;
    assert.ok(target, `${id} ${width}: functional workspace exists`);
    assert.equal(row.bodyOverflow, false, `${id} ${width}: no horizontal overflow`);
    assert.ok(row.right, `${id} ${width}: right rail exists`);
    assert.ok(Math.abs(row.right.y - target.y) <= 80, `${id} ${width}: right rail beside functional workspace`);
    assert.ok(row.right.x >= target.x + target.width + 20, `${id} ${width}: right rail separated from workspace`);
    if (width >= 1440) {
      assert.ok(row.left, `${id} ${width}: left rail exists`);
      assert.ok(Math.abs(row.left.y - target.y) <= 80, `${id} ${width}: left rail beside functional workspace`);
      assert.ok(row.left.x + row.left.width + 20 <= target.x, `${id} ${width}: left rail separated from workspace`);
    } else assert.equal(row.left, null, `${id} ${width}: no squeezed left rail`);
    const expectedRight = '2cc9598f48bdcb102277c47352490483';
    const expectedLeft = width >= 1920 ? '983c84b73f5901c5877413ab9680312e' : '900dabd0bb67d683bd5dbc7486b6d25a';
    if (!realProvider) {
      assert.equal(requested.filter(url => url.includes(expectedRight)).length, 1, `${id} ${width}: one right provider request`);
      if (width >= 1440) assert.equal(requested.filter(url => url.includes(expectedLeft)).length, 1, `${id} ${width}: one left provider request`);
    }
    let finalState = null;
    if (realProvider && process.argv.includes('--wait-fill')) {
      await page.waitForTimeout(36500);
      finalState = await page.evaluate(() => Object.fromEntries(['left', 'right'].map(zone => {
        const node = document.querySelector(`[data-ad-layout-zone="${zone}"]`);
        return [zone, node ? { state: node.dataset.adState, reason: node.dataset.adCollapseReason || null, hidden: node.hidden, frameCount: node.querySelectorAll('iframe').length, imageCount: node.querySelectorAll('img').length } : null];
      })));
    }
    rows.push({ id, width, ...row, providerRequests: requested, finalState, creativeStatus: realProvider ? 'not proven by request or mounted state' : 'fixture only' });
    if ([1440, 1920].includes(width) && ['compress-pdf', 'background-remover', 'gst-calculator'].includes(id)) {
      await page.evaluate(() => scrollTo(0, Math.max(0, (document.querySelector('.upload-zone, .tool-interactive-area, .drop-zone')?.getBoundingClientRect().top || 0) + scrollY - 180)));
      await page.waitForTimeout(150);
      await page.screenshot({ path: resolve(`test-results/ad-rails/${id}-${width}${realProvider ? '-real' : '-fixture'}.png`) });
    }
    console.log(`${id} ${width}: workspace=${JSON.stringify(row.workspace)} left=${JSON.stringify(row.left)} right=${JSON.stringify(row.right)} gutters=${row.workspaceLeftSpace}/${row.workspaceRightSpace}`);
  }
  if (!realProvider && routes.includes('compress-pdf')) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/compress-pdf/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.tool-container')?.dataset.disclosure === 'upload');
    await page.locator('#file-picker').setInputFiles(resolve('tests/fixtures/one-page.pdf'));
    await page.waitForFunction(() => document.querySelector('.tool-container')?.dataset.disclosure === 'ready');
    const loaded = await page.evaluate(() => ({
      layout: [...document.querySelector('.tool-container').classList].filter(value => value.includes('rail-')),
      railsVisible: [...document.querySelectorAll('.gxa-ad-rail')].some(element => !element.hidden && getComputedStyle(element).display !== 'none'),
      processVisible: Boolean(document.querySelector('#btn-process-action')?.getClientRects().length),
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    }));
    assert.deepEqual(loaded.layout, [], 'Loaded editor reclaims its original full-width layout');
    assert.equal(loaded.railsVisible, false, 'No side ad remains beside the loaded editor');
    assert.equal(loaded.processVisible, true, 'The processing control remains available');
    assert.equal(loaded.overflow, false, 'Loaded editor has no horizontal overflow');
    rows.push({ id: 'compress-pdf', phase: 'loaded', ...loaded });
  }
} finally {
  await writeFile(resolve(`test-results/ad-rails/geometry${realProvider ? '-real' : ''}.json`), JSON.stringify(rows, null, 2));
  await writeFile(resolve(`test-results/ad-rails/browser-errors${realProvider ? '-real' : ''}.json`), JSON.stringify(browserErrors, null, 2));
  await writeFile(resolve(`test-results/ad-rails/provider-network${realProvider ? '-real' : ''}.json`), JSON.stringify({ responses: providerResponses, failures: providerFailures }, null, 2));
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
