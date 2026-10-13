import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server=createQaServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage();const rows=[];
await page.route(/bauval\.org|abscloud\.org|googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/,r=>r.abort());
try {
 await page.goto(`http://127.0.0.1:${server.address().port}/background-remover/`,{waitUntil:'domcontentloaded'});
 await page.locator('.upload-page .drop-zone').waitFor();
 for(const width of [320,360,390,430,768,1024,1280,1440,1600,1920]) {
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.locator('.header-download').count(),0,'Do not offer export before a valid image');
  assert.equal(await page.locator('.editor-page').count(),0);
  assert.equal(await page.locator('.upload-page .primary-button').isVisible(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  rows.push({width,emptyUpload:true,exportHidden:true,editorHidden:true,overflow:false});
  if([390,1440,1920].includes(width)) await page.screenshot({path:resolve('test-results/workspace-master/after',`background-remover-${width}.png`)});
 }
 await mkdir('test-results/workspace-master',{recursive:true});
 await writeFile('test-results/workspace-master/background-header-final.json',JSON.stringify(rows,null,2));
 console.log('Background Remover empty/header disclosure passed at all 10 widths.');
} finally {await browser.close();await new Promise(r=>server.close(r));}
