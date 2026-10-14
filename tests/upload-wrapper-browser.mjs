import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({headless:true, executablePath:process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context = await browser.newContext();
await cachePublicDependencies(context);
await context.route(/bauval\.org|abscloud\.org|googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, r => r.abort());
const page = await context.newPage(), rows = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
const output = resolve('test-results/upload-wrapper'); await mkdir(output,{recursive:true});
const routes = ['organize-pdf','compress-pdf','png-to-pdf','jpg-to-pdf','svg-to-png','image-converter','compress-image','resize-image','edit-pdf'];
try {
 for (const route of routes) for (const width of [390,1440,1920]) {
  await page.setViewportSize({width,height:900});
  await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-disclosure="upload"]');
  await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet));
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => {
   const zone = document.querySelector('.upload-zone,.image-converter__drop,.pdf-edit-upload');
   const wrapper = zone.closest('.tool-interactive-area,.image-converter__panel');
   const r = zone.getBoundingClientRect(), parent = zone.parentElement.getBoundingClientRect();
   const css = wrapper && getComputedStyle(wrapper);
   return {width:r.width,height:r.height,centerOffset:Math.abs(r.x+r.width/2-parent.x-parent.width/2),overflow:document.documentElement.scrollWidth>innerWidth+1,wrapper:css ? {background:css.backgroundColor,border:css.borderTopWidth,shadow:css.boxShadow,padding:css.paddingTop}:null};
  });
  assert.equal(geometry.overflow,false);
  assert.ok(geometry.centerOffset<2, `${route} ${width}: ${JSON.stringify(geometry)}`);
  if (geometry.wrapper) assert.deepEqual(geometry.wrapper,{background:'rgba(0, 0, 0, 0)',border:'0px',shadow:'none',padding:'0px'});
  if(width>1000) {assert.ok(geometry.width>=650 && geometry.width<=850); assert.ok(geometry.height>=260 && geometry.height<=340, `${route} ${width}: ${JSON.stringify(geometry)}`);}
  await page.screenshot({path:resolve(output,`${route}-${width}.png`)});
  const input = route==='svg-to-png' ? {name:'shape.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>')} : resolve('tests/fixtures', ['organize-pdf','compress-pdf','edit-pdf'].includes(route) ? 'one-page.pdf' : 'small.png');
  await page.locator('input[type=file]').first().setInputFiles(input);
  await page.waitForSelector('[data-disclosure="ready"]');
  const loaded = await page.evaluate(() => {
   const el=document.querySelector('.tool-interactive-area,.image-converter__panel');
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,border:el?getComputedStyle(el).borderTopWidth:null};
  });
  assert.equal(loaded.overflow,false);
  if(loaded.border) assert.notEqual(loaded.border,'0px');
  rows.push({route,viewport:width,...geometry,loaded});
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS: ${routes.length} tools, ${rows.length} empty/loaded viewport checks, no overflow or page errors.`);
} finally {
 await writeFile(resolve(output,'results.json'),JSON.stringify({rows,errors},null,2));
 await browser.close(); await new Promise(r=>server.close(r));
}
