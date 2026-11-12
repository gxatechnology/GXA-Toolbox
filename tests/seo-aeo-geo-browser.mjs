import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|bauval\.org|abscloud\.org/, route => route.abort());

const routes = ['', 'merge-pdf', 'compress-image', 'json-tool'];
const results = [];
try {
  for (const width of [390, 768, 1440]) {
    for (const route of routes) {
      const path = route ? `/${route}/` : '/';
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 200, `${path} initial response`);
      const initial = await response.text();
      const canonical = initial.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
      const title = initial.match(/<title>([^<]+)<\/title>/i)?.[1];
      const description = initial.match(/<meta name="description" content="([^"]+)"/i)?.[1];
      const socialImage = initial.match(/<meta property="og:image" content="([^"]+)"/i)?.[1];
      assert.equal(canonical, `https://gxatoolbox.in${path}`);
      assert.ok(title && title.includes('GXA Toolbox'), `${path} initial title`);
      assert.ok(description && socialImage, `${path} initial description and social image`);
      assert.match(initial, /<h1\b[^>]*>[\s\S]*?<\/h1>/i, `${path} initial H1`);
      if (route) assert.match(initial, /<a\s[^>]*href="\/[a-z0-9-]+\/"/i, `${path} crawlable internal links`);

      const page = await context.newPage();
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.addInitScript(() => {
        window.__seoLab = { cls: 0, lcp: null, shifts: [] };
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) {
            window.__seoLab.cls += entry.value;
            window.__seoLab.shifts.push({ value: entry.value, sources: (entry.sources || []).slice(0, 2).map(source => {
              const node = source.node;
              return node?.id || (typeof node?.className === 'string' ? node.className.slice(0, 80) : node?.tagName || 'unknown');
            }) });
          }
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__seoLab.lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      assert.equal((await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })).status(), 200);
      if (route) await page.waitForFunction(() => !document.querySelector('[data-static-route-shell]'));
      await page.waitForLoadState('load');
      await page.waitForTimeout(300);
      const state = await page.evaluate(() => ({
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content,
        socialImage: document.querySelector('meta[property="og:image"]')?.content,
        h1: document.querySelectorAll('h1').length,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        cls: window.__seoLab?.cls ?? null,
        lcp: window.__seoLab?.lcp ?? null,
        shifts: window.__seoLab?.shifts || []
      }));
      assert.equal(state.canonical, canonical, `${path} hydrated canonical`);
      assert.equal(state.title, title.replaceAll('&amp;', '&'), `${path} hydrated title`);
      assert.equal(state.description, description.replaceAll('&amp;', '&'), `${path} hydrated description`);
      assert.equal(state.socialImage, socialImage, `${path} hydrated social image`);
      assert.equal(state.h1, 1, `${path} H1 count`);
      assert.equal(state.overflow, false, `${path} horizontal overflow at ${width}px`);
      results.push({ path, width, cls: Number(state.cls?.toFixed(3)), lcpMs: state.lcp == null ? null : Math.round(state.lcp),
        topShiftSources: state.cls > 0.1 ? state.shifts.sort((a, b) => b.value - a.value).slice(0, 2) : [] });
      await page.close();
    }
  }
  console.log(`SEO/AEO/GEO browser smoke passed: ${results.length} direct loads; initial HTML, hydrated metadata, H1 and horizontal overflow verified.`);
  console.log('Local lab observations (not field Core Web Vitals):', JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
