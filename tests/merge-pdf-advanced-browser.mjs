import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as lib from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0,'127.0.0.1',done));
const browser = await chromium.launch({ headless:true, executablePath:process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/,route=>route.abort());
const page=await context.newPage();page.setDefaultTimeout(30000);
const failures=[],checks=[],out=resolve('test-results/merge-pdf-advanced');await mkdir(out,{recursive:true});
page.on('pageerror',error=>failures.push(error.message));
async function fixture(widths){const doc=await lib.PDFDocument.create();widths.forEach((w,i)=>doc.addPage([w,450]).drawText(`Source ${w} page ${i+1}`,{x:20,y:390,size:16}));return Buffer.from(await doc.save());}
const input=[{name:'source.pdf',mimeType:'application/pdf',buffer:await fixture([301,302,303])},{name:'source.pdf',mimeType:'application/pdf',buffer:await fixture([401,402])}];
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/merge-pdf/`,{waitUntil:'domcontentloaded'});
  await page.locator('#file-picker').setInputFiles(input);
  for(const i of [0,1])await page.locator('.merge-pdf-file-options summary').nth(i).tap();
  await page.locator('#merge-range-0').fill('3,1,1');await page.locator('#merge-rotation-0').selectOption('90');
  await page.locator('#merge-range-1').fill('2');await page.locator('#merge-rotation-1').selectOption('180');
  // Queue movement must keep settings associated with the actual File, even with identical names.
  await page.locator('.file-card').nth(1).getByRole('button',{name:'Move source.pdf up'}).tap();
  assert.equal(await page.locator('#merge-range-0').inputValue(),'2');
  assert.equal(await page.locator('#merge-range-1').inputValue(),'3,1,1');
  await page.locator('.file-card').first().focus();await page.keyboard.press('Alt+ArrowDown');
  assert.equal(await page.locator('#merge-range-1').inputValue(),'2');
  await page.locator('.file-card').nth(1).focus();await page.keyboard.press('Alt+ArrowUp');
  assert.equal(await page.locator('#merge-range-0').inputValue(),'2');
  for(const i of [0,1])await page.locator('.merge-pdf-file-options summary').nth(i).tap();
  for(const width of [320,360,375,390,412,430,768,1440]){
    await page.setViewportSize({width,height:900});
    if (width < 1100) await page.waitForFunction(()=>getComputedStyle(document.querySelector('.header-nav .nav-menu')).visibility==='hidden');
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1);
    assert.ok(await page.locator('#merge-range-0').evaluate(el=>el.getBoundingClientRect().height>=44));
    assert.ok(await page.locator('#btn-process-action').isVisible());
    await page.waitForSelector('.pdf-canvas-wrap[data-current-pdf-page]');
    const toolbar = await page.locator('.file-preview-shell .preview-control-bar').evaluate(bar => {
      const items=Array.from(bar.children).map(el=>({r:el.getBoundingClientRect(),el}));
      return { ok:items.every(({r,el},i)=>el.scrollWidth<=el.clientWidth+1 && items.every(({r:other},j)=>i===j||r.right<=other.left+1||r.left>=other.right-1||r.bottom<=other.top+1||r.top>=other.bottom-1)), items:items.map(({r,el})=>({text:el.textContent,rect:r.toJSON(),scroll:el.scrollWidth,client:el.clientWidth,position:getComputedStyle(el).position,flex:getComputedStyle(el).flex})) };
    });
    assert.ok(toolbar.ok, `PDF toolbar labels and controls do not overlap or clip at ${width}: ${JSON.stringify(toolbar.items)}`);
    checks.push(`Populated file options at ${width}: no overflow, 44px controls and processing visible`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.header-nav .nav-menu')).visibility==='hidden');
  await page.locator('.merge-pdf-file-options').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(out,'merge-options-mobile.png')});
  await page.locator('.pdf-preview-controls').screenshot({path:resolve(out,'pdf-toolbar-mobile.png')});
  await page.locator('#btn-process-action').tap();
  await page.waitForFunction(()=>!document.getElementById('btn-download-result').disabled);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#btn-download-result:visible').tap()]);
  assert.equal(await download.failure(),null);assert.match(download.suggestedFilename(),/\.pdf$/i);
  const path=resolve(out,'selected-rotated-merged.pdf');await download.saveAs(path);
  const doc=await lib.PDFDocument.load(await readFile(path));
  assert.deepEqual(doc.getPages().map(p=>p.getWidth()),[402,303,301,301]);
  assert.deepEqual(doc.getPages().map(p=>p.getRotation().angle),[180,90,90,90]);
  assert.equal(await page.evaluate(()=>premiumEditorState.resultBlob.type),'application/pdf');
  checks.push('Touch file reorder retains per-file selections despite identical filenames; real download/reopen proves page selection, repeated pages and rotation');
  await page.getByRole('button',{name:'Start Over',exact:true}).first().tap();
  assert.equal(await page.evaluate(()=>appState.activeFiles.length),0);
  assert.equal(await page.evaluate(()=>Object.keys(appState.activeToolOptions.mergeFiles || {}).length),0);
  await page.locator('#file-picker').setInputFiles(input.slice(0,1));
  await page.locator('.merge-pdf-file-options summary').tap();
  await page.locator('#merge-range-0').fill('99');await page.locator('#btn-process-action').tap();
  await page.waitForFunction(()=>document.body.dataset.gxaLastProcessingError?.includes('outside'));
  assert.ok(await page.locator('#btn-download-result').isDisabled());
  await page.locator('#merge-range-0').fill('1');await page.locator('#btn-process-action').tap();
  await page.waitForFunction(()=>!document.getElementById('btn-download-result').disabled);
  const [retry]=await Promise.all([page.waitForEvent('download'),page.locator('#btn-download-result:visible').tap()]);
  const retryPath=resolve(out,'retry.pdf');await retry.saveAs(retryPath);
  assert.equal((await lib.PDFDocument.load(await readFile(retryPath))).getPageCount(),1);
  checks.push('Reset clears selections; invalid range produces no downloadable result; corrected range retries successfully');
  assert.deepEqual(failures,[]);
}catch(error){failures.push(error.message);throw error;}finally{
  await writeFile(resolve(out,'results.json'),JSON.stringify({checks,failures,browser:'Installed Chromium, emulated touch, not physical devices',realAdRequests:false},null,2));
  await context.close();await browser.close();await new Promise(done=>server.close(done));
}
console.log(`Advanced Merge browser passed: ${checks.length} checks, real selected/rotated output, touch reorder, reset/retry and eight populated widths.`);
