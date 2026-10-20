import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import config from '../public_html/assets/ad-config.js';

const server = createQaServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });
let popupCount = 0;
page.on('popup', popup => { popupCount++; popup.close().catch(() => {}); });
const requests = [], responses = [], failures = [], errors = [], consoleErrors = [];
page.on('request', request => {
  if (/bauval\.org|abscloud\.org/.test(request.url())) requests.push(request.url());
});
page.on('response', response => {
  if (/bauval\.org|abscloud\.org/.test(response.url())) responses.push({ url: response.url(), status: response.status() });
});
page.on('requestfailed', request => {
  if (/bauval\.org|abscloud\.org/.test(request.url())) failures.push({ url: request.url(), failure: request.failure() });
});
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
try {
  await page.goto(`${origin}/compress-pdf/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.GxaAdNetwork && document.querySelector('[data-ad-layout-zone="content-lower"]')));
  const zones = await page.locator('.gxa-ad-network').evaluateAll(nodes => nodes.map(node => node.dataset.adLayoutZone));
  for (const zone of zones) {
    await page.evaluate(zone => {
      const slot = document.querySelector(`[data-ad-layout-zone="${zone}"]`);
      slot?.previousElementSibling?.scrollIntoView({ block: 'center' });
    }, zone);
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(35000);
  await mkdir(resolve('test-results/ad-coverage'), { recursive: true });
  await page.screenshot({ path: resolve('test-results/ad-coverage/real-provider-compress-pdf-1920.png'), fullPage: true, animations: 'disabled' });
  const state = await page.evaluate(() => ({
    network: GxaAdConfig.network,
    providerSiteId: GxaAdConfig.providerSiteId,
    eligible: GxaAdNetwork.eligible(),
    slots: [...document.querySelectorAll('.gxa-ad-network')].map(node => ({
      zone: node.dataset.adLayoutZone,
      unitId: Number(node.dataset.adUnitId) || null,
      scriptUrl: node.dataset.adScriptUrl || null,
      format: node.dataset.adFormat,
      state: node.dataset.adState,
      reason: node.dataset.adCollapseReason || null,
      planned: node.dataset.adFormat === 'native' ? null : (() => {
        const [width, height] = node.dataset.adFormat.split('x').map(Number);
        return { width, height };
      })(),
      geometry: { width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height },
      scriptPresent: Boolean(node.querySelector('script[src*="bauval.org"], script[src*="abscloud.org"]')),
      iframeInitialized: node.querySelectorAll('iframe').length,
      actualCreative: [...node.querySelectorAll('iframe, img, a[href]')].some(element => {
        if (element.tagName === 'IMG') return element.complete && element.naturalWidth > 0;
        if (element.tagName === 'A') return Boolean(element.textContent.trim() || element.querySelector('img'));
        try {
          const body = element.contentDocument?.body;
          return Boolean(body && (body.textContent.trim()
            || body.querySelector('a[href], img[src], video, canvas, object, embed, iframe[src]:not([src="about:blank"])')));
        } catch {
          return Boolean(element.getAttribute('src') && element.getAttribute('src') !== 'about:blank');
        }
      })
    })),
    overflow: document.documentElement.scrollWidth > innerWidth + 1
    , intrusive: window.GxaAdIntrusive?.status() || null
  }));
  const csp = (await readFile('_headers', 'utf8')).match(/Content-Security-Policy: (.+)/)?.[1] || null;
  const diagnostics = {
    source: 'single local-origin genuine-provider sample; not production fill data',
    config: {
      providerSiteId: config.providerSiteId,
      enabledDisplayUnits: [config.native, ...config.banners].map(unit => ({ unitId: unit.unitId, key: unit.key || unit.containerId, src: unit.src, width: unit.width || null, height: unit.height || null })),
      nonDisplayUnits: Object.entries(config.intrusive).map(([name, unit]) => ({ name, unitId: unit.unitId, enabled: unit.enabled, src: unit.src || null, reason: unit.activationBlockedReason || null }))
    },
    csp,
    state,
    requests,
    responses,
    failures,
    popupCount,
    runtimeExceptions: errors,
    cspOrConsoleErrors: consoleErrors.filter(message => /content security policy|refused to|bauval|abscloud/i.test(message))
  };
  await writeFile(resolve('test-results/ad-coverage/real-provider-diagnostics.json'), JSON.stringify(diagnostics, null, 2));
  console.log(JSON.stringify(diagnostics, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
