// Local native-picker lifecycle QA. Optional Playwright is supplied by the host,
// not installed in the production application. All files are synthetic fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const evidence = resolve('test-results/upload-area-layout');
await mkdir(evidence, { recursive:true });
const browser = await chromium.launch({ headless:true, ...(process.env.GXA_BROWSER_EXECUTABLE ? { executablePath:process.env.GXA_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ hasTouch:true, acceptDownloads:true, reducedMotion:'reduce' });
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|tile\.openstreetmap\.org/, route => route.abort());
const page = await context.newPage();
page.on('dialog', dialog => dialog.accept());
page.setDefaultTimeout(20000);
const results = [];
const specs = [
  ...['merge-pdf','compress-image','compress-pdf'].map(route => ({route, choose:'#drop-zone', file:route === 'compress-image' ? 'sample.jpg':'one-page.pdf', preview:'.file-card', reset:'.file-card-remove', area:'#drop-zone'})),
  {route:'image-converter', choose:'.image-converter__choose', file:'sample.jpg', preview:'.image-converter__original', reset:'.image-converter__reset', area:'.image-converter__drop'},
  {route:'gps-map-camera', choose:'.gps-studio__choose', file:'sample.jpg', preview:'.gps-studio__photo', reset:'.gps-studio__reset', area:'.gps-studio__upload'},
  {route:'edit-pdf', choose:'#pdf-edit-file', file:'one-page.pdf', preview:'.pdf-edit-document', reset:'[data-action="reset"]', area:'.pdf-edit-upload'},
  {route:'crop-image', choose:'#crop-upload-state button', file:'sample.jpg', preview:'#crop-image-mount', area:'#crop-upload-state'},
];
async function choose(spec, width) {
  const pending = page.waitForEvent('filechooser');
  if (width < 768) await page.locator(spec.choose).tap();
  else await page.locator(spec.choose).click();
  await (await pending).setFiles(resolve('tests/fixtures',spec.file));
  await page.locator(spec.preview).waitFor({state:'visible'});
}
async function checkArea(selector) {
  // Disclosure is committed in requestAnimationFrame after reset; measure the
  // settled layout, not the previous editor grid midway through that update.
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.locator(selector).evaluate(el => el.scrollIntoView({block:'start',behavior:'instant'}));
  const check = await page.locator(selector).evaluate(el => {
    const r=el.getBoundingClientRect(), header=document.querySelector('.header-nav,.gxa-header').getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,header:header.bottom,width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(check.left>=0 && check.right<=check.width+1 && check.top>=check.header-1 && check.overflow<=1,JSON.stringify(check));
}
try {
  for (const [width,height] of [[320,568],[390,844],[1366,768]]) {
    await page.setViewportSize({width,height});
    for (const spec of specs) {
      assert.equal((await page.goto(`${origin}/${spec.route}/`)).status(),200);
      await page.locator(spec.area).waitFor({state:'visible'});
      await checkArea(spec.area);
      await choose(spec,width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),`${spec.route} uploaded overflow`);
      if (spec.route==='crop-image') {
        // Exercise the bounded editing stage as well as the new natural upload state.
        const apply=page.locator(width<768 ? '#crop-mobile-apply-button':'#crop-apply-button');
        await apply.click();
        const downloadButton = page.locator(width<768 ? '#crop-mobile-download-button':'#crop-download-button');
        await downloadButton.waitFor({state:'visible'});
        const download=page.waitForEvent('download');
        await downloadButton.click();
        assert.equal(await (await download).failure(),null);
        await page.getByRole('button',{name:'Reset',exact:true}).click();
      } else await page.locator(spec.reset).click();
      await page.locator(spec.area).waitFor({state:'visible'});
      await checkArea(spec.area);
      await choose(spec,width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),`${spec.route} re-upload overflow`);
      await page.screenshot({path:resolve(evidence,`${spec.route}-${width}-reupload.png`)});
      results.push({route:spec.route,width,upload:true,reset:true,reupload:true,pointer:width<768?'touch':'mouse'});
      console.log(`${spec.route} ${width}: native picker, preview, reset/remove and re-upload passed`);
    }
    // Hold the model response locally to test cancellation during loading, not
    // a race with fast inference. No masks or successful processing are faked.
    let releaseModel;
    const modelGate = new Promise(done => { releaseModel=done; });
    const holdModel = async route => { await modelGate; await route.abort().catch(()=>{}); };
    await page.route('**/*.onnx',holdModel);
    await page.goto(`${origin}/background-remover/`);
    const bg={choose:'.upload-page .primary-button',file:'landscape.png',preview:'.processing-preview img'};
    await page.locator('.upload-page .drop-zone').waitFor({state:'visible'});
    await checkArea('.upload-page .drop-zone');
    await choose(bg,width);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.locator('.upload-page .drop-zone').waitFor({state:'visible'});
    await checkArea('.upload-page .drop-zone');
    await choose(bg,width);
    releaseModel();
    await page.goto('about:blank');
    await page.unroute('**/*.onnx',holdModel);
    results.push({route:'background-remover',width,upload:true,reset:true,reupload:true,scope:'real decode/preview; model request held to verify loading cancellation; inference not asserted'});
    console.log(`background-remover ${width}: native picker, processing preview, cancel and re-upload passed`);
  }
  await page.setViewportSize({width:1366,height:900});
  await page.goto(`${origin}/merge-pdf/`, {waitUntil:'domcontentloaded'});
  await page.locator('#drop-zone').waitFor({state:'visible'});
  const bytes = [...await readFile(resolve('tests/fixtures/one-page.pdf'))];
  const transfer = await page.evaluateHandle(bytes => {
    const files = new DataTransfer();
    for (const name of ['first.pdf','second.pdf']) files.items.add(new File([new Uint8Array(bytes)],name,{type:'application/pdf'}));
    return files;
  },bytes);
  await page.locator('#drop-zone').dispatchEvent('drop',{dataTransfer:transfer});
  await transfer.dispose();
  await page.waitForFunction(()=>document.querySelectorAll('.file-card').length===2);
  await page.locator('#btn-process-action').click();
  await page.waitForFunction(()=>document.querySelector('#btn-download-result')?.disabled===false);
  const pending = page.waitForEvent('download');
  await page.locator('#btn-download-result').click();
  const download = await pending;
  assert.equal((await PDFDocument.load(await readFile(await download.path()))).getPageCount(),2);
  results.push({route:'merge-pdf',width:1366,scope:'two real PDFs via DataTransfer drop; processed, downloaded and reopened with two pages'});
  await writeFile(resolve(evidence,'lifecycle.json'),JSON.stringify(results,null,2));
  console.log(`PASS: ${results.length} file-input lifecycle checks, with real crop downloads.`);
} finally {
  await context.close(); await browser.close(); await new Promise(done=>server.close(done));
}
