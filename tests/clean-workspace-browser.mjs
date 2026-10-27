import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
import { PDFDocument } from 'pdf-lib';
const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server=createQaServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,acceptDownloads:true});
await cachePublicDependencies(context);
await context.route(/bauval\.org|abscloud\.org|googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/,r=>r.abort());
const page=await context.newPage(); page.setDefaultTimeout(30000);
const rows=[];
const specs=[['compress-pdf','one-page.pdf'],['merge-pdf','one-page.pdf'],['split-pdf','one-page.pdf'],['png-to-pdf','small.png'],['svg-to-png',null],['resize-image','sample.jpg'],['compress-image','sample.jpg'],['ocr-pdf','one-page.pdf']];
try {
 for(const [route,file] of specs) {
  if (process.env.GXA_STATE_ROUTE && process.env.GXA_STATE_ROUTE !== route) continue;
  const result={route,width:390};
  try {
   await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.tool-container')?.dataset.workspaceState==='empty');
   result.empty=true;
   assert.equal(await page.locator('.tool-sidebar-settings:visible').count(),0);
   await page.evaluate(()=>{window.__workspaceStates=[];new MutationObserver(()=>{const s=document.querySelector('.tool-container')?.dataset.workspaceState;if(s&&!window.__workspaceStates.includes(s))window.__workspaceStates.push(s);}).observe(document.querySelector('.tool-container'),{attributes:true,attributeFilter:['data-workspace-state']});});
   const chooser=page.waitForEvent('filechooser'); await page.locator('#drop-zone button').tap();
   let input=file?resolve('tests/fixtures',file):{name:'shape.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>')};
   if(route==='compress-pdf') {const pdf=await PDFDocument.create();for(let i=0;i<3;i++)pdf.addPage().drawText(`Workspace compression fixture ${i+1}`);input={name:'compressible.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save({useObjectStreams:false}))};}
   await (await chooser).setFiles(input);
   await page.waitForFunction(()=>document.querySelector('.tool-container')?.dataset.workspaceState==='loaded');
   result.loaded=true;
   assert.equal(await page.locator('#tool-upload-mount:visible').count(),0);
   await page.locator('#btn-process-action').tap();
   await page.waitForFunction(()=>document.querySelector('.tool-container')?.dataset.workspaceState==='result' || document.body.dataset.gxaLastProcessingError,null,{timeout:120000});
   assert.equal(await page.evaluate(()=>document.body.dataset.gxaLastProcessingError || ''),'','Processing must finish without an engine error');
   result.states=await page.evaluate(()=>window.__workspaceStates);
   assert.ok(result.states.includes('processing'),'Actual processing state observed');
   result.processing=true;result.result=true;
   const download=page.waitForEvent('download');
   const button=page.locator('#btn-download-result'); await button.tap();
   const output=await download; assert.equal(await output.failure(),null); assert.ok((await readFile(await output.path())).length>0);
   result.download=true;
   await page.evaluate(()=>resetActiveTool());
   await page.waitForFunction(()=>document.querySelector('.tool-container')?.dataset.workspaceState==='empty');
   result.reset=true;
   if(route==='compress-pdf') {
    await page.locator('#file-picker').setInputFiles(resolve('tests/fixtures/one-page.pdf'));
    await page.locator('#btn-process-action').click();
    await page.waitForFunction(()=>document.querySelector('.tool-container')?.dataset.workspaceState==='error');
    assert.match(await page.locator('.tool-workspace-error').innerText(),/already efficiently compressed/);
    await page.evaluate(()=>resetActiveTool());
    await page.waitForFunction(()=>document.querySelector('.tool-container')?.dataset.workspaceState==='empty');
    assert.equal(await page.locator('.tool-workspace-error:visible').count(),0);
    result.actionableErrorAndRecovery=true;
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   result.pass=true;
  } catch(error) {result.pass=false;result.error=error.message;result.diagnostic=await page.evaluate(()=>({state:document.querySelector('.tool-container')?.dataset.workspaceState,status:[...document.querySelectorAll('[role="alert"],.toast,#processing-stage-label')].map(e=>e.textContent),states:window.__workspaceStates})).catch(()=>null);}
  rows.push(result);console.log(JSON.stringify(result));
 }
} finally {
 await mkdir('test-results/workspace-master',{recursive:true});
 await writeFile(`test-results/workspace-master/states${process.env.GXA_STATE_ROUTE ? '-'+process.env.GXA_STATE_ROUTE : ''}.json`,JSON.stringify(rows,null,2));
 await context.close();await browser.close();await new Promise(r=>server.close(r));
}
if(rows.some(r=>!r.pass))process.exitCode=1;
