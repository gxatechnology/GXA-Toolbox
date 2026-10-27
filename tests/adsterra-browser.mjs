import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { loadToolQuality, loadContentPageRegistry } from '../scripts/tool-registry.mjs';
import config from '../public_html/assets/ad-config.js';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
if (config.network !== 'adsterra') {
  console.log(`Adsterra fixture browser suite not applicable with network=${config.network}; build-switch/publication contracts remain in npm test.`);
  process.exit(0);
}
const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const out = resolve('test-results/adsterra'); await mkdir(out, { recursive: true });
const csp = (await readFile('_headers', 'utf8')).match(/Content-Security-Policy: (.+)/)[1];
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await cachePublicDependencies(context);
// Dedicated native lifecycle regression. Default expanded placement is exercised
// separately by ad-layout-browser.mjs, including every approved banner adapter.
await context.route('**/assets/ad-config.js', async route => {
  const source = await readFile('public_html/assets/ad-config.js', 'utf8');
  // Keep the actual homepage configuration; isolate Native only on tool pages.
  const isHome = new URL(route.request().headers().referer || origin).pathname === '/';
  await route.fulfill({ contentType: 'application/javascript', body: isHome ? source : source.replace('top: true, right: true, left: true, afterTool: true, content: true', 'top: false, right: false, left: false, afterTool: true, content: false') });
});
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
let mode = 'filled', requests = 0;
const unexpected = [], errors = [], rows = [];
// Controlled fixture ONLY in tests. Never contact the real advertising service.
await context.route(/bauval\.org|abscloud\.org/, async route => {
  const url = route.request().url(), unit = config.banners.find(item => item.src === url);
  const intrusive = Object.values(config.intrusive).find(item => item.src === url);
  if (url !== config.native.src && !unit && !intrusive?.enabled) { unexpected.push(url); await route.abort(); return; }
  requests++;
  if (mode === 'blocked') { await route.abort(); return; }
  const body = intrusive ? `document.documentElement.dataset.gxaFixture${intrusive.unitId}='loaded';` : mode === 'empty' ? '/* no fill */' : unit
    ? `const a=document.createElement('iframe');a.width='${unit.width}';a.height='${unit.height}';a.srcdoc='<a href="https://example.com/">LOCAL TEST FIXTURE</a>';(document.currentScript?.parentElement||document.querySelector('script[src="${unit.src}"]')?.parentElement)?.append(a);`
    : `const c=document.getElementById('${config.native.containerId}');if(c){const a=document.createElement('a');a.href='https://example.com/';a.textContent='TEST FIXTURE — no live advertisement';a.style.cssText='display:block;box-sizing:border-box;width:100%;min-height:90px;padding:20px;border:1px solid #aaa;overflow-wrap:anywhere';c.append(a);}`;
  await route.fulfill({ contentType: 'application/javascript', body: `(function(){${body}})();` });
});
await context.route(url => url.origin === origin, async route => {
  if (route.request().resourceType() !== 'document') return route.fallback();
  const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
});
const page = await context.newPage(); page.setDefaultTimeout(60000);
page.on('pageerror', error => errors.push(error.message));
async function open(id = '') {
  await page.goto(`${origin}/${id ? id + '/' : ''}`, { waitUntil: 'domcontentloaded' });
  if (id === 'background-remover') await page.waitForSelector('#root main');
  else if (!['dashboard', 'not-a-real-route'].includes(id)) await page.waitForFunction(() => typeof window.navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
  if (!id) await page.waitForFunction(() => document.querySelector('.command-search-section') && document.querySelectorAll('.gxa-ad-network').length === 2);
}
async function requestSlot() {
  await page.evaluate(() => document.querySelector('.gxa-ad-sentinel')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => window.GxaAdNetwork.hasRequested());
}
async function revealResultSlot() {
  const state = await page.evaluate(() => {
    const marker = document.querySelector('[data-ad-trigger="result-ready"]');
    if (!marker) return { marker: false };
    marker.closest('#tool-complete-mount, .crop-result-panel')?.classList.remove('hidden');
    const result = marker.closest('.image-converter__result, .gps-studio__result, .result-download-section');
    if (result) result.hidden = false;
    const editor = marker.closest('#edit-pdf-mount');
    if (editor) {
      editor.dataset.resultReady = 'true';
      const download = marker.parentElement?.querySelector('.result-download-section');
      if (download) download.hidden = false;
      window.GxaAdNetwork?.sync();
      return { marker: true, editor: true, download: Boolean(download), hidden: download?.hidden };
    }
    window.GxaAdNetwork?.sync();
    return { marker: true, editor: false };
  });
  if (state.editor) assert.deepEqual(state, { marker: true, editor: true, download: true, hidden: false });
}
try {
  const quality = await loadToolQuality();
  for (const [id] of Object.entries(quality).filter(([, q]) => q.adsEligible)) {
    await open(id);
    await page.waitForSelector('.gxa-ad-network', { state: 'attached' });
    assert.equal(await page.locator('.gxa-ad-network').count(), 1, id);
    assert.equal(await page.locator('.tool-workspace .gxa-ad-network:not([data-ad-trigger="result-ready"]), #crop-editor-workspace .gxa-ad-network:not([data-ad-trigger="result-ready"]), .premium-editor-workspace .gxa-ad-network:not([data-ad-trigger="result-ready"])').count(), 0, `${id}: only a gated result placement may live in the result workspace`);
    rows.push({ route: id, status: 'eligible candidate; result candidate remains gated until processing succeeds' });
    console.log(`${id}: eligible candidate checked`);
  }
  for (const [id, policy] of Object.entries(quality).filter(([, q]) => !q.adsEligible)) {
    const before = requests; await open(id); await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    assert.equal(await page.locator('script[src="/assets/ad-network.js"]').count(), 0); assert.equal(requests, before);
    rows.push({ route: id, status: 'ad-free' });
  }
  for (const id of ['dashboard', 'not-a-real-route']) {
    const before = requests; await open(id); assert.equal(await page.locator('script[src="/assets/ad-network.js"]').count(), 0); assert.equal(requests, before);
  }
  for (const article of await loadContentPageRegistry()) {
    const before = requests; await open(article.id);
    if (['guide', 'category'].includes(article.kind)) {
      await page.waitForSelector('.gxa-ad-network', { state: 'attached' });
      assert.equal(await page.locator('.gxa-ad-network').count(), 1);
      rows.push({ route: article.id, status: 'one editorial candidate' });
    } else {
      await page.evaluate(() => { scrollTo(0, document.body.scrollHeight); window.GxaAdNetwork?.sync(); });
      assert.equal(await page.locator('.gxa-ad-network').count(), 0);
      assert.equal(requests, before);
      rows.push({ route: article.id, status: 'legal/company/hub page: no provider request' });
    }
  }
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 }); const before = requests; await open('crop-image');
    await revealResultSlot();
    await requestSlot(); // The after-tool candidate may already be within the lazy-load margin.
    await page.waitForSelector('.gxa-ad-network[data-ad-state="mounted"]');
    assert.equal(requests, before + 2); assert.equal(await page.locator(`#${config.native.containerId}`).count(), 1);
    assert.equal(await page.locator(`#gxa-adsterra-popunder`).count(), 0);
    assert.equal(await page.locator(`#gxa-adsterra-social-bar`).count(), 1);
    assert.equal(await page.locator('script[src="' + config.native.src + '"]').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await page.evaluate(() => {
      const slot = document.querySelector('.gxa-ad-network').getBoundingClientRect();
      const preview = document.querySelector('.crop-result-meta')?.getBoundingClientRect();
      const download = document.querySelector('.result-download-section')?.getBoundingClientRect();
      return (!preview || preview.bottom + 24 <= slot.top) && (!download || slot.bottom + 24 <= download.top);
    }), 'Ad must sit between result details and download with safe spacing');
    await page.evaluate(() => { for (let i = 0; i < 8; i++) GxaAdNetwork.sync(); setTheme(appState.theme === 'dark' ? 'light' : 'dark'); });
    assert.equal(requests, before + 2, 'No display or provider-bootstrap remount requests');
    await page.screenshot({ path: resolve(out, `crop-native-${width}.png`), animations: 'disabled' });
    rows.push({ route: 'crop-image', width, status: 'one lazy fixture, no overlap/overflow' });
  }
  await page.evaluate(() => { window.testDocument = true; navigate('tool-resize-image'); });
  await page.waitForURL('**/resize-image/'); await page.waitForFunction(() => typeof navigate === 'function');
  assert.equal(await page.evaluate(() => window.testDocument), undefined, 'Loaded ad must not follow an SPA route');
  await revealResultSlot();
  await requestSlot(); await page.waitForSelector('.gxa-ad-network[data-ad-state="mounted"]');
  await page.evaluate(() => navigate('tool-uuid-generator')); await page.waitForURL('**/uuid-generator/');
  assert.equal(await page.locator('script[src="/assets/ad-network.js"]').count(), 0);
  await page.goBack(); await page.waitForFunction(() => typeof navigate === 'function');
  assert.ok(await page.locator(`#${config.native.containerId}`).count() <= 1);
  // Edit PDF is not force-readied here: its real result requires a generated
  // preview and is covered by the editor browser suite plus the result-layout
  // contract. This provider-lifecycle fixture must not fabricate editor output.
  for (const id of ['compress-pdf', 'merge-pdf', 'split-pdf', 'image-converter']) {
    for (const width of [320, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await open(id);
      if (id === 'edit-pdf') {
        await page.locator('.pdf-edit-upload').waitFor();
        await page.waitForTimeout(500);
      }
      if (id === 'image-converter') await page.locator('.image-converter__drop').waitFor();
      await revealResultSlot();
      await requestSlot(); await page.waitForSelector('.gxa-ad-network[data-ad-state="mounted"]');
      const resultGeometry = await page.evaluate(() => {
        const ad = document.querySelector('.gxa-ad-network').getBoundingClientRect();
        const download = document.querySelector('.result-download-section')?.getBoundingClientRect();
        return { ad: { top: ad.top, bottom: ad.bottom, height: ad.height }, download: download ? { top: download.top, bottom: download.bottom, height: download.height } : null, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.ok((!resultGeometry.download || resultGeometry.ad.bottom + 24 <= resultGeometry.download.top) && !resultGeometry.overflow, `${id} ${width}: filled native must remain separated above the download section: ${JSON.stringify(resultGeometry)}`);
      rows.push({ route: id, width, status: 'filled result fixture above download, no overlap or overflow' });
    }
  }
  await open('edit-pdf');
  await page.locator('.pdf-edit-upload').waitFor();
  assert.equal(await page.locator('[data-ad-trigger="result-ready"]').getAttribute('data-ad-state'), 'waiting', 'Edit PDF result ad stays gated before a real preview exists');
  for (const id of ['', 'guides/pdf-compression', 'background-remover']) {
    await open(id);
    await page.evaluate(() => { for (let i = 0; i < 8; i++) window.GxaAdNetwork.sync(); });
    assert.equal(await page.locator('.gxa-ad-network').count(), id ? 1 : 2, 'Homepage has one discovery banner plus one editorial candidate');
    if (!id) await page.evaluate(() => [...document.querySelectorAll('.gxa-ad-sentinel')].at(-1)?.scrollIntoView({ block: 'center' }));
    await requestSlot(); await page.waitForSelector('.gxa-ad-network[data-ad-state="mounted"]');
    if (!id) await page.locator(`#${config.native.containerId}`).waitFor({ state: 'attached' });
    assert.equal(await page.locator(`#${config.native.containerId}`).count(), 1); rows.push({ route: id || '/', status: 'one editorial placement' });
  }
  await open('resize-image');
  await page.evaluate(() => showAuthModal('signup'));
  assert.equal(await page.locator('.gxa-ad-network:not([hidden])').count(), 0);
  await page.evaluate(() => closeModal());
  const suppressedRequests = requests;
  await page.evaluate(() => GxaAdNetwork.sync());
  assert.equal(requests, suppressedRequests, 'Closing a dialog must not refresh a requested unit');
  await open('resize-image'); await revealResultSlot(); await requestSlot(); await page.waitForSelector('.gxa-ad-network[data-ad-state="mounted"]');
  await page.evaluate(() => showAuthModal('login'));
  await page.waitForFunction(() => document.querySelector('.gxa-ad-network')?.hidden === true);
  await page.evaluate(() => closeModal());
  const afterModal = requests; await page.evaluate(() => GxaAdNetwork.sync()); assert.equal(requests, afterModal);
  for (const failure of ['blocked', 'empty']) {
    mode = failure; const before = requests; await open('resize-image'); await revealResultSlot(); await requestSlot();
    await page.waitForFunction(() => ['failed', 'empty'].includes(document.querySelector('.gxa-ad-network')?.dataset.adState), null, { timeout: 60000 });
    assert.equal(await page.locator('.gxa-ad-network').evaluate(e => e.getBoundingClientRect().height), 0);
    assert.equal(requests, before + 3); assert.ok(await page.locator('#file-picker').count());
    await page.evaluate(() => GxaAdNetwork.sync()); assert.equal(requests, before + 3);
    rows.push({ route: 'resize-image', status: failure + ': collapsed, no retry, uploader retained' });
  }
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
} finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ rows, requests, errors, unexpected, liveAdsRequested: false, csp }, null, 2));
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
console.log(`Adsterra browser passed: ${rows.length} checks, all 14 excluded routes, responsive/native fixtures, document navigation, failures and production CSP; no live ad requests.`);
