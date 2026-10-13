import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const phase = process.env.GXA_UI_PHASE || 'after';
if (!['before', 'after'].includes(phase)) throw Error('Invalid phase');
const output = resolve('test-results/tool-ui-final', phase);
await mkdir(output, { recursive: true });
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext();
await cachePublicDependencies(context);
await context.route(/bauval\.org|abscloud\.org|googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, r => r.abort());
const page = await context.newPage();
const rows = [], errors = [];
page.on('pageerror', e => errors.push({ route: new URL(page.url()).pathname, error: e.message }));
const representatives = ['png-to-pdf','merge-pdf','crop-image','compress-image','image-converter','edit-pdf','split-pdf','gst-calculator','json-tool','background-remover'];
try {
  for (const tool of await loadToolRegistry()) {
    for (const width of [320,360,390,430,768,1024,1280,1440,1600,1920]) {
      await page.setViewportSize({ width, height: 900 });
      // Direct-load every route; resize the same page to test responsive transitions.
      if (width === 320) await page.goto(`http://127.0.0.1:${server.address().port}/${tool.id}/`, { waitUntil: 'domcontentloaded' });
      if (width === 390 && representatives.includes(tool.id)) await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('h1') && !document.querySelector('[data-static-route-shell]'));
      await page.waitForTimeout(150);
      const state = await page.evaluate(() => {
        const visible = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
        const rect = el => el ? { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) } : null;
        const h1 = document.querySelector('h1'), header = document.querySelector('.tool-header'), breadcrumb = document.querySelector('.breadcrumb, .tool-breadcrumb');
        const upload = [...document.querySelectorAll('.upload-zone,.crop-upload-state,.image-converter__drop,.pdf-edit-upload,.upload-page .drop-zone,input[type=file]')].find(visible);
        const navigation = document.querySelector('.header-nav, .gxa-header');
        const headerOverlap = !!(navigation && h1 && h1.getBoundingClientRect().top < navigation.getBoundingClientRect().bottom - 1);
        const duplicates = [...document.querySelectorAll('[role=status]')].filter(visible).map(n=>n.textContent.trim()).filter(t=>/^(select|choose|upload).*(begin|start|continue)/i.test(t));
        for (const step of document.querySelectorAll('.tool-steps li')) {
          const title = step.querySelector('h3')?.textContent.trim().replace(/[.!?]+$/, '');
          const detail = step.querySelector('p')?.textContent.trim().replace(/[.!?]+$/, '');
          if (title && title === detail) duplicates.push('Repeated guide step');
        }
        return { title: h1?.textContent.trim(), titleRect: rect(h1), header: rect(header), headerOverlap, breadcrumb: breadcrumb?.textContent.replace(/\s+/g,' ').trim() || '', upload: rect(upload), buttons: [...document.querySelectorAll('main button')].filter(visible).slice(0,20).map(n=>n.textContent.trim() || n.getAttribute('aria-label')), duplicates, overflow: document.documentElement.scrollWidth > innerWidth + 1, category: document.querySelector('.tool-category-label')?.textContent.trim() || '', favorite: !!document.querySelector('.tool-favorite'), disclosure: document.querySelector('[data-disclosure]')?.dataset.disclosure || 'specialized', result: 'Not processed in this layout audit; functional suites separate' };
      });
      rows.push({ route: tool.id, name: tool.name, categoryName: tool.category, width, ...state });
      if (representatives.includes(tool.id) && [390,1440,1920].includes(width)) await page.screenshot({ path: resolve(output, `${tool.id}-${width}.png`), fullPage: false });
    }
    console.log(`${phase}: ${tool.id} reviewed at 10 widths`);
  }
} finally {
  await writeFile(resolve(output,'results.json'),JSON.stringify({rows,errors},null,2));
  await context.close(); await browser.close(); await new Promise(done=>server.close(done));
}
console.log(`${rows.length} layout observations; ${rows.filter(r=>r.overflow).length} overflows; ${errors.length} page errors.`);
if (phase === 'after' && (rows.length !== 950 || rows.some(r=>r.overflow || r.headerOverlap || r.duplicates.length) || errors.length)) process.exitCode = 1;
