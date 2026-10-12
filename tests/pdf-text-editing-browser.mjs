import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as lib from 'pdf-lib';
import sharp from 'sharp';
import { createQaServer } from './browser-qa-server.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
const { chromium }=createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE||'playwright');
const out=resolve('test-results/pdf-text-editing');await mkdir(out,{recursive:true});
const server=createQaServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,executablePath:process.env.GXA_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/,route=>route.abort());
const page=await context.newPage();page.setDefaultTimeout(45000);page.on('dialog',dialog=>dialog.accept());
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const checks=[];
async function open(bytes,name='text.pdf'){
  await page.goto(`http://127.0.0.1:${server.address().port}/edit-pdf/`,{waitUntil:'domcontentloaded'});
  await page.locator('#pdf-edit-file').setInputFiles({name,mimeType:'application/pdf',buffer:Buffer.from(bytes)});
  await page.waitForFunction(()=>document.querySelector('.pdf-edit-document')?.hidden===false&&document.querySelector('#edit-pdf-mount')?.getAttribute('aria-busy')==='false');
}
async function select(text){
  await page.getByRole('button',{name:'Edit Text',exact:true}).click();
  await page.getByRole('button',{name:`PDF text: ${text}`,exact:true}).click();
  await page.locator('#pdf-text-value').waitFor();
}
async function download(name){
  const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download Edited PDF',exact:true}).click()]);
  assert.equal(await file.failure(),null);const path=resolve(out,name);await file.saveAs(path);return new Uint8Array(await readFile(path));
}
async function inspect(bytes,name){
  const result=await page.evaluate(async({bytes})=>{
    const pdf=await pdfjsLib.getDocument({data:Uint8Array.from(bytes),isEvalSupported:false}).promise;
    const text=[],images=[];
    for(let n=1;n<=pdf.numPages;n++){
      const p=await pdf.getPage(n),content=await p.getTextContent();text.push(content.items.map(i=>i.str).join(' '));
      const view=p.getViewport({scale:1.5}),canvas=document.createElement('canvas');canvas.width=view.width;canvas.height=view.height;
      await p.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;images.push(canvas.toDataURL('image/png'));canvas.width=1;canvas.height=1;
    }await pdf.destroy();return{text,images};
  },{bytes:Array.from(bytes)});
  for(let i=0;i<result.images.length;i++)await writeFile(resolve(out,`${name}-${i+1}.png`),Buffer.from(result.images[i].split(',')[1],'base64'));
  return result.text;
}
try{
  const scan=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="white"/><text x="120" y="300" font-family="Arial" font-size="72" fill="black">HELLO SCAN</text></svg>')).png().toBuffer();
  const doc=await lib.PDFDocument.create(),font=await doc.embedFont(lib.StandardFonts.Helvetica),image=await doc.embedPng(scan);
  for(let i=0;i<4;i++){
    const p=doc.addPage([400,500]);
    if(i===2)p.drawImage(image,{x:0,y:0,width:400,height:500});
    else {p.drawText(i===1?'ROTATED ORIGINAL':'ORIGINAL TEXT',{x:40,y:i===1?200:400,font,size:20,color:lib.rgb(.1,.2,.4),rotate:lib.degrees(i===1?90:0)});p.drawText(`UNTOUCHED ${i}`,{x:40,y:50,font,size:12});}
    if(i===3)p.drawImage(image,{x:200,y:100,width:160,height:200});
  }
  const annotation=doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[40,30,180,45],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:lib.PDFString.of('https://example.com')}}));doc.getPage(0).node.addAnnot(annotation);
  const bytes=await doc.save();await writeFile(resolve(out,'source.pdf'),bytes);await open(bytes);
  await select('ORIGINAL TEXT');assert.equal(await page.locator('#pdf-text-mode').inputValue(),'native');
  await page.locator('#pdf-text-value').fill('CANCEL THIS');await page.locator('#pdf-text-value').press('Escape');assert.equal(await page.locator('#pdf-text-value').count(),0);
  await select('ORIGINAL TEXT');await page.locator('#pdf-text-value').fill('CHANGED TEXT');await page.locator('#pdf-text-value').press('Enter');
  await page.getByRole('button',{name:'PDF text: CHANGED TEXT',exact:true}).waitFor();
  await page.locator('[data-action="undo"]').click();await page.getByRole('button',{name:'PDF text: ORIGINAL TEXT',exact:true}).waitFor();
  await page.locator('[data-action="redo"]').click();await page.getByRole('button',{name:'PDF text: CHANGED TEXT',exact:true}).waitFor();
  await page.locator('[data-action="next"]').click();await page.getByRole('button',{name:'PDF text: ROTATED ORIGINAL',exact:true}).click();
  assert.equal(await page.locator('#pdf-text-mode').inputValue(),'native');await page.locator('#pdf-text-value').fill('ROTATED CHANGE');await page.locator('[data-text-action="apply"]').click();
  await page.getByRole('button',{name:'PDF text: ROTATED CHANGE',exact:true}).waitFor();
  const native=await download('native.pdf'),nativeText=await inspect(native,'native');
  assert.match(nativeText[0],/CHANGED TEXT/);assert.doesNotMatch(nativeText[0],/ORIGINAL TEXT/);assert.match(nativeText[1],/ROTATED CHANGE/);assert.match(nativeText[3],/ORIGINAL TEXT/);
  const reopened=await lib.PDFDocument.load(native);assert.equal(reopened.getPageCount(),4);assert.equal(reopened.getPage(0).node.Annots().size(),1);
  for(let i=0;i<4;i++)assert.deepEqual(reopened.getPage(i).getSize(),{width:400,height:500});
  assert.ok(reopened.getPage(3).node.Resources().lookup(lib.PDFName.of('XObject'),lib.PDFDict).keys().length>0);
  checks.push('Native UI, Escape/Enter, undo/redo, rotated native text, four-page reopen, unchanged text/images/annotations/dimensions');
  // Chromium's print engine produces a genuine embedded/subset font fixture.
  const print=await context.newPage();await print.setContent('<!doctype html><html><body style="font-family:Arial;font-size:24px">SUBSET ORIGINAL</body></html>');
  const subset=await print.pdf({width:'5.555556in',height:'6.944444in'});await print.close();await writeFile(resolve(out,'subset-source.pdf'),subset);
  await open(subset,'subset.pdf');await select('SUBSET ORIGINAL');
  assert.equal(await page.locator('#pdf-text-mode').inputValue(),'visual');assert.equal(await page.locator('#pdf-text-mode option[value="native"]').count(),0);
  await page.locator('#pdf-text-value').fill('VISUAL CHANGE');
  for(const width of [320,360,375,390,412,430,768,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(250);assert.equal(await page.locator('#pdf-text-value').inputValue(),'VISUAL CHANGE','Resize must not discard the draft');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Text selection overflow ${width}`);}
  await page.setViewportSize({width:390,height:844});await page.mouse.move(0,700);await page.locator('.pdf-text-panel').scrollIntoViewIfNeeded();await page.waitForTimeout(700);await page.screenshot({path:resolve(out,'text-panel-mobile.png')});
  await page.locator('[data-text-action="apply"]').tap();
  await page.locator('[data-property="text"]').waitFor();
  await page.locator('[data-property="font"]').selectOption('HelveticaBoldItalic');await page.locator('[data-property="fontSize"]').fill('18');
  for(const width of [1440,768,430,412,390,375,360,320]){await page.setViewportSize({width,height:900});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Text editor overflow ${width}`);}
  await page.locator('[data-action="delete"]').tap();assert.equal(await page.locator('.pdf-text-mask').count(),0);
  await page.locator('[data-action="undo"]').tap();await page.waitForSelector('.pdf-text-mask');
  await page.locator('.pdf-edit-object').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
  await page.getByRole('button',{name:'Preview Edited PDF',exact:true}).tap();await page.getByRole('button',{name:'Back to editing',exact:true}).tap();
  assert.doesNotMatch(await page.locator('#pdf-edit-status').innerText(),/could not finish/);
  await page.locator('.pdf-edit-selection').scrollIntoViewIfNeeded();await page.waitForTimeout(700);await page.screenshot({path:resolve(out,'visual-mobile.png')});
  const visual=await download('visual.pdf'),visualText=await inspect(visual,'visual');
  assert.match(visualText[0],/VISUAL CHANGE/);assert.match(visualText[0],/SUBSET ORIGINAL/,'Visual cover honestly leaves underlying extracted text');
  checks.push('Real subset-font fallback, visual mask/new text export, font style/size controls, mobile widths');
  await open(bytes);await page.locator('[data-action="next"]').click();await page.locator('[data-action="next"]').click();
  await page.getByRole('button',{name:'Edit Text',exact:true}).tap();await page.getByRole('button',{name:'Recognize text (OCR)',exact:true}).tap();
  await page.getByRole('button',{name:/OCR text: HELLO SCAN/}).waitFor({timeout:240000});
  await page.locator('#pdf-text-region-picker').selectOption('0');assert.equal(await page.locator('#pdf-text-mode').inputValue(),'visual');
  await page.locator('#pdf-text-value').fill('SCAN REPLACED');await page.locator('[data-text-action="apply"]').click();
  await page.locator('[data-property="width"]').fill('220');
  const ocr=await download('ocr.pdf'),ocrText=await inspect(ocr,'ocr');assert.match(ocrText[2],/SCAN REPLACED/);
  checks.push('Real English OCR worker, scan region selection, visual replacement, exported/reopened text and render');
  await page.locator('[data-action="reset"]').tap();assert.equal(await page.locator('.pdf-text-region').count(),0);assert.equal(await page.locator('#pdf-text-value').count(),0);
  await open(bytes);await page.getByRole('button',{name:'Edit Text',exact:true}).tap();
  let releaseLibrary, requestedLibrary;
  const libraryHeld=new Promise(resolve=>{releaseLibrary=resolve;});
  const libraryRequested=new Promise(resolve=>{requestedLibrary=resolve;});
  const hold=async route=>{requestedLibrary();await libraryHeld;await route.continue();};
  await context.route('**/assets/vendor/tesseract/tesseract.min.js',hold);
  await page.getByRole('button',{name:'Recognize text (OCR)',exact:true}).tap();await libraryRequested;
  await page.getByRole('button',{name:'Cancel OCR',exact:true}).tap();releaseLibrary();
  await page.waitForFunction(()=>!!window.Tesseract);await context.unroute('**/assets/vendor/tesseract/tesseract.min.js',hold);
  assert.match(await page.locator('#pdf-edit-status').innerText(),/OCR cancelled/);
  const abortCore=route=>route.abort();await context.route('**/tesseract.js-core@*/**',abortCore);
  await page.getByRole('button',{name:'Recognize text (OCR)',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('#pdf-edit-status')?.textContent.includes('OCR could not finish'));
  await context.unroute('**/tesseract.js-core@*/**',abortCore);
  await page.locator('#pdf-text-region-picker').selectOption('0');await page.locator('#pdf-text-value').fill('AFTER FAILURE');await page.locator('[data-text-action="apply"]').tap();
  assert.match((await inspect(await download('after-ocr-failure.pdf'),'after-ocr-failure'))[0],/AFTER FAILURE/);
  checks.push('OCR cancellation and failed model download leave native editing/download usable; reset clears regions and drafts');
  assert.deepEqual(errors,[]);
  console.log(`PDF text editing browser passed: ${checks.join('; ')}`);
}catch(error){
  console.error(await page.evaluate(()=>({editor:document.querySelector('#edit-pdf-mount')?.innerText,workspace:typeof window.GxaWorkspace,core:typeof window.GxaPdfTextCore,text:typeof window.GxaPdfTextEditor,ui:typeof window.GxaPdfEditor})));
  await page.screenshot({path:resolve(out,'failure.png'),fullPage:true});throw error;
}finally{await writeFile(resolve(out,'results.json'),JSON.stringify({checks,errors},null,2));await browser.close();await new Promise(done=>server.close(done));}
