import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
import config from '../public_html/assets/ad-config.js';
import { PDFDocument } from 'pdf-lib';
import { loadToolQuality } from '../scripts/tool-registry.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ hasTouch: true }); await cachePublicDependencies(context);
await context.addInitScript(() => {
  window.adResizeEvidence = [];
  window.addEventListener('resize', () => window.adResizeEvidence.push({ width: innerWidth, parents: [...document.querySelectorAll('.gxa-ad-network')].map(node => ({ zone: node.dataset.adLayoutZone, width: node.parentElement?.getBoundingClientRect().width })) }));
});
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
const csp = (await readFile('_headers', 'utf8')).match(/Content-Security-Policy: (.+)/)[1];
await context.route(url => url.origin === origin, async route => {
  if (route.request().resourceType() !== 'document') return route.fallback();
  const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
});
let mode = 'filled', requests = [];
const errors = [], rows = [], out = resolve('test-results/ad-layout-expansion'); await mkdir(out, { recursive: true });
await context.route(/bauval\.org|abscloud\.org/, async route => {
  const url = route.request().url(), unit = config.banners.find(item => item.src === url);
  assert.ok(unit || url === config.native.src, `Unapproved provider request: ${url}`); requests.push(url);
  if (mode === 'blocked') return route.abort();
  if (mode === 'empty') return route.fulfill({ contentType: 'application/javascript', body: '/* intentional no fill */' });
  // Test-only provider adapter: verify isolated standard options and draw no real ad.
  const target = unit ? 'document.currentScript.parentElement' : `document.getElementById(${JSON.stringify(config.native.containerId)})`;
  const check = unit ? `if(atOptions.key!==${JSON.stringify(unit.key)}||atOptions.width!==${unit.width}||atOptions.height!==${unit.height}||atOptions.format!=='iframe')throw Error('Wrong isolated options');` : '';
  const creative = unit
    ? `const a=document.createElement('iframe');a.width='${unit.width}';a.height='${unit.height}';a.src='about:blank';a.style.border='0';${target}.append(a);`
    : `const a=document.createElement('a');a.href='https://example.com/';a.textContent='TEST ONLY — intercepted advertisement';a.style.cssText='display:block;box-sizing:border-box;background:#e5e7eb;color:#111;padding:12px;overflow-wrap:anywhere;width:100%;height:90px';${target}.append(a);`;
  await route.fulfill({ contentType: 'application/javascript', body: `(function(){${check}${creative}})();` });
});
const page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
async function open(id, width) {
  requests = []; await page.setViewportSize({ width, height: 900 });
  await page.goto(`${origin}/${id}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof navigate === 'function' && !document.querySelector('[data-static-route-shell]'));
  await page.waitForFunction(() => window.GxaAdNetwork && document.querySelector('.gxa-ad-network'));
  // Route styles load lazily; measure ad-induced changes only after CSS arrives.
  await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet));
  await page.evaluate(() => document.fonts.ready);
}
async function loadSlots() {
  // A snapshot avoids looping when observers remove sentinels after requesting.
  const zones = await page.locator('.gxa-ad-network').evaluateAll(nodes => nodes.map(node => node.dataset.adLayoutZone));
  for (const zone of zones) {
    await page.evaluate(zone => {
      const node = document.querySelector(`[data-ad-layout-zone="${zone}"]`);
      if (node?.dataset.adState === 'waiting') node.previousElementSibling?.scrollIntoView({ block: 'center' });
    }, zone);
    await page.waitForFunction(zone => document.querySelector(`[data-ad-layout-zone="${zone}"]`)?.dataset.adState !== 'waiting', zone);
  }
  await page.waitForFunction(() => [...document.querySelectorAll('.gxa-ad-network')].every(node => !['waiting', 'loading'].includes(node.dataset.adState)), null, { timeout: 40000 });
}
try {
  for (const id of ['image-converter', 'compress-image', 'compress-pdf', 'merge-pdf', 'split-pdf', 'edit-pdf', 'crop-image', 'gst-calculator', 'json-tool'].filter(id => !process.env.GXA_AD_QA_ROUTE || id === process.env.GXA_AD_QA_ROUTE)) {
    for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1600, 1800, 1920, 2400].filter(width => !process.env.GXA_AD_QA_WIDTH || width === Number(process.env.GXA_AD_QA_WIDTH))) {
      await open(id, width);
      const workspaceWidth = await page.evaluate(() => document.querySelector('.upload-zone,.image-converter__drop,.pdf-edit-upload,.crop-upload-state')?.getBoundingClientRect().width ?? null);
      await loadSlots();
      const filledWorkspaceWidth = await page.evaluate(() => document.querySelector('.upload-zone,.image-converter__drop,.pdf-edit-upload,.crop-upload-state')?.getBoundingClientRect().width ?? null);
      if (workspaceWidth !== null) assert.ok(Math.abs(workspaceWidth-filledWorkspaceWidth) <= 1, `${id} ${width}: ad fill must not resize the upload workspace`);
      const result = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.gxa-ad-network[data-ad-state="mounted"]')];
        const controls = [...document.querySelectorAll('.tool-workspace, #edit-pdf-mount, #image-converter-mount, .premium-session-panel')].filter(node => node.getClientRects().length);
        const overlaps = nodes.some(node => controls.some(control => { const a=node.getBoundingClientRect(),b=control.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }));
        const top = nodes.find(node => node.dataset.adLayoutZone === 'top');
        const header = document.querySelector('.tool-header');
        const after = nodes.find(node => node.dataset.adLayoutZone === 'after-tool'), guide = document.querySelector('.tool-content-guide');
        return { zones: nodes.map(node => node.dataset.adLayoutZone), overflow: document.documentElement.scrollWidth > innerWidth + 1, overlaps,
          afterBeforeGuide: !after || !guide || Boolean(after.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING),
          topOrdered: !top || (header.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          insideControl: nodes.some(node => node.closest('.tool-workspace, #edit-pdf-mount, #image-converter-mount')),
          nativeCount: document.querySelectorAll('[id="container-b1b26904317d94da1830e1f5dd69d6d9"]').length };
      });
      assert.equal(result.overflow, false, `${id} ${width} overflow`); assert.equal(result.overlaps, false, `${id} ${width} overlap`);
      assert.equal(result.insideControl, false); assert.equal(result.topOrdered, true); assert.ok(result.nativeCount <= 1);
      assert.equal(result.afterBeforeGuide,true,`${id}: after-tool ad must precede guide, not interrupt result controls`);
      assert.ok(result.zones.length <= (width < 768 ? 2 : ['edit-pdf','crop-image'].includes(id) ? 3 : 4));
      if (width < 1280 || ['edit-pdf','crop-image'].includes(id)) assert.ok(!result.zones.some(zone => ['left','right'].includes(zone)));
      assert.equal(new Set(requests).size, requests.length, 'One execution per key');
      if (result.zones.includes('top')) {
        const expectedWidth = width >= 1280 ? 728 : width >= 768 ? 468 : 320;
        const unit = config.banners.find(item => item.width === expectedWidth);
        assert.ok(requests.includes(unit.src), `${id} ${width}: correct top banner`);
      }
      assert.ok(!requests.some(url => [config.intrusive.popunder.src, config.intrusive.socialBar.src].includes(url)), 'Intrusive formats must remain unrequested on every tested route');
      const before = requests.length; await page.evaluate(() => { for(let i=0;i<10;i++)GxaAdNetwork.sync(); }); assert.equal(requests.length, before);
      if (['compress-image', 'edit-pdf'].includes(id) && [390, 768, 1440, 1920].includes(width)) {
        await page.evaluate(() => scrollTo(0,0));
        await page.waitForFunction(() => scrollY < 1);
        await page.screenshot({ path: resolve(out, `${id}-${width}-viewport.png`), animations: 'disabled' });
        await page.screenshot({ path: resolve(out, `${id}-${width}.png`), fullPage: true, animations: 'disabled' });
        assert.equal(await page.locator('.gxa-ad-network[data-ad-state="mounted"]').count(),result.zones.length, 'Screenshot/scroll must not retire filled slots: ' + JSON.stringify(await page.evaluate(()=>({history:window.adResizeEvidence,slots:[...document.querySelectorAll('.gxa-ad-network')].map(n=>({zone:n.dataset.adLayoutZone,state:n.dataset.adState,parentWidth:n.parentElement.getBoundingClientRect().width,retired:n.dataset.adRetiredGeometry}))}))));
      }
      rows.push({ id, width, ...result }); console.log(`${id} ${width}: ${result.zones.join(', ')}`);
    }
  }
  for (const failure of ['blocked','empty']) {
    mode = failure; await open('compress-image',1920); await loadSlots();
    assert.equal(await page.locator('.gxa-ad-network:not([hidden])').count(),0);
    assert.equal(await page.locator('.gxa-ad-network').evaluateAll(nodes=>nodes.reduce((sum,n)=>sum+n.getBoundingClientRect().height,0)),0);
    assert.ok(await page.locator('#file-picker').count()); rows.push({ failure, status:'collapsed, uploader retained' });
  }
  mode='filled'; await open('compress-image',1920); await loadSlots(); const count=requests.length;
  await page.setViewportSize({width:320,height:900});
  await page.waitForFunction(()=>![...document.querySelectorAll('.gxa-ad-rail')].some(node=>!node.hidden));
  assert.equal(requests.length,count); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await open('gst-calculator',390); await loadSlots();
  await page.locator('#opt-gst-amount').fill('100'); await page.locator('#opt-gst-rate').selectOption('18');
  await page.getByRole('button',{name:'Calculate',exact:true}).click(); assert.match(await page.locator('#generator-preview-mount').innerText(),/118/);
  await open('json-tool',390); await loadSlots(); await page.locator('#opt-json-raw').fill('{"ads":true}');
  assert.match(await page.locator('#generator-preview-mount').innerText(),/"ads"\s*:\s*true/);
  await open('compress-pdf',390); await loadSlots();
  const pdf = await PDFDocument.create(); for(let i=0;i<3;i++) pdf.addPage().drawText(`Ad layout real export test ${i+1}`);
  const choose = page.getByRole('button',{name:/^Select (?:files?|PDF)$/}).first(); await choose.focus();
  const [picker] = await Promise.all([page.waitForEvent('filechooser'),choose.press('Enter')]);
  await picker.setFiles({name:'ad-layout.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save({useObjectStreams:false}))});
  await page.locator('#btn-process-action').click();
  await page.waitForFunction(()=>document.getElementById('btn-download-result')?.disabled===false,null,{timeout:180000});
  const [download] = await Promise.all([page.waitForEvent('download'),page.locator('#btn-mobile-download-result:visible, #btn-download-result:visible').first().click()]);
  assert.equal(await download.failure(),null); await download.saveAs(resolve(out,'compressed.pdf'));
  assert.equal((await PDFDocument.load(await readFile(resolve(out,'compressed.pdf')))).getPageCount(),3);
  rows.push({id:'compress-pdf',width:390,status:'real upload, processing, downloaded PDF reopened with 3 pages; ads initially filled'});
  for (const [id, policy] of Object.entries(await loadToolQuality())) {
    if (policy.adsEligible) continue;
    requests=[]; await page.goto(`${origin}/${id}/`); assert.equal(await page.locator('script[src="/assets/ad-network.js"]').count(),0); assert.equal(requests.length,0);
  }
  assert.deepEqual(errors,[]);
} finally {
  await writeFile(resolve(out,'results.json'),JSON.stringify({rows,errors,liveAdsExecuted:false},null,2));
  await context.close(); await browser.close(); await new Promise(done=>server.close(done));
}
console.log(`Expanded ad layout passed: ${rows.length} checks; fixture ads only; 14 excluded routes.`);
