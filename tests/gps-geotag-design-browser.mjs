import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0,'127.0.0.1',done));
const origin = 'http://127.0.0.1:' + server.address().port;
const evidence = resolve('test-results/gps-compact-stamp'); await mkdir(evidence,{recursive:true});
const browser = await chromium.launch({headless:true,...(process.env.GXA_BROWSER_EXECUTABLE?{executablePath:process.env.GXA_BROWSER_EXECUTABLE}:{})});
const context = await browser.newContext({hasTouch:true,acceptDownloads:true,viewport:{width:1440,height:1000}});
await context.route(/googletagmanager|google-analytics|googlesyndication|doubleclick|tile.openstreetmap/, route=>route.abort());
let geocodeMode='success', mapMode='success', mapRequests=0;
let mapBytes;
await context.route('**/api/location-geocode?**',async route=>{
  const mode=geocodeMode, url=new URL(route.request().url());
  if(mode==='slow') await new Promise(done=>setTimeout(done,400));
  if(mode==='failure') return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Lookup unavailable in QA'})});
  const result=mode==='empty'?null:{latitude:27.184,longitude:78.024,place:mode==='slow'?'Older point':'Palika Nagar',address:'12/P-30F Park Road, Palika Nagar, Agra, Uttar Pradesh 282006, India',locality:'Palika Nagar',city:'Agra',state:'Uttar Pradesh',postal:'282006',country:'India',timezone:'Asia/Kolkata'};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(url.searchParams.get('action')==='search'?{results:[result]}:{result})});
});
await context.route('**/api/location-map',async route=>{
  mapRequests++; const data=route.request().postDataJSON(); assert.deepEqual(Object.keys(data).sort(),['latitude','longitude']);
  if(mapMode==='failure') return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Street map unavailable in QA.'})});
  return route.fulfill({contentType:'image/png',body:mapBytes});
});
const page=await context.newPage(); page.setDefaultTimeout(15000); const errors=[];page.on('pageerror',error=>errors.push(error.message));
const open=async()=>{await page.goto(origin+'/gps-map-camera/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('.gps-studio__file',{state:'attached'});};
const fixture=async(width,height,map=false)=>Buffer.from(await page.evaluate(({width,height,map})=>{
  const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,map?'#dae6df':'#7db1d0');gradient.addColorStop(1,map?'#f1efe4':'#d1c6a7');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  if(map){ctx.strokeStyle='#fff';ctx.lineWidth=15;for(let x=40;x<width;x+=110){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+80,height);ctx.stroke();}for(let y=50;y<height;y+=100){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y+40);ctx.stroke();}ctx.fillStyle='#15332a';ctx.font='20px sans-serif';ctx.fillText('SYNTHETIC MAP FIXTURE · NOT REAL GEOGRAPHY',12,30);ctx.font='16px sans-serif';ctx.fillText('QA attribution footer — preserve this whole image',12,height-12);}
  else {ctx.fillStyle='#c4bdaa';ctx.fillRect(width*.16,height*.23,width*.65,height*.44);ctx.fillStyle='#475d67';for(let x=width*.2;x<width*.78;x+=width*.11)for(let y=height*.29;y<height*.6;y+=height*.1)ctx.fillRect(x,y,width*.07,height*.06);ctx.fillStyle='#fff';ctx.font=`600 ${width*.025}px sans-serif`;ctx.fillText('SYNTHETIC QA PHOTO · EXPORT LAYOUT TEST',width*.06,height*.08);}
  return c.toDataURL('image/png').split(',')[1];
},{width,height,map}),'base64');
const upload=async(width,height)=>{const buffer=await fixture(width,height);await page.locator('.gps-studio__file').setInputFiles({name:'synthetic-qa-photo.png',mimeType:'image/png',buffer});await page.waitForFunction(({width,height})=>document.querySelector('.gps-studio__file-meta').textContent.includes(`${width} × ${height}`),{width,height});await page.locator('.gps-studio__date').fill('2026-09-22T14:35');return buffer;};
const point=async(lat=27.184,lon=78.024)=>{await page.locator('.gps-studio__lat').fill(String(lat));await page.locator('.gps-studio__lon').fill(String(lon));await page.locator('.gps-studio__apply-coordinates').click();};
const resolved=()=>page.waitForFunction(()=>!document.querySelector('.gps-studio__resolved').hasAttribute('aria-busy'));
async function download(name){await page.locator('.gps-studio__generate').click();await page.waitForFunction(()=>!document.querySelector('.gps-studio__result').hidden);const pending=page.waitForEvent('download');await page.locator('.gps-studio__download').click();const file=await pending;assert.equal(file.suggestedFilename(),'geotagged-photo.'+(name.endsWith('.png')?'png':'jpg'));await file.saveAs(resolve(evidence,name));return new Uint8Array(await readFile(await file.path()));}
const geometry=()=>page.evaluate(()=>window.gpsQaRenders.at(-1));
function assertCompact(draw, fraction=.18){
  const {box,width,height}=draw;
  assert(Math.abs(box.map.width / Math.min(width,height) - fraction)<1e-8,'Map size must follow the original shorter edge');
  assert(box.map.x < width*.02,'Map must sit at the left edge in every template');
  assert(box.map.x+box.map.width < box.text.x,'Map and text cannot overlap');
  assert(Math.abs(box.y+box.height-height)<.01,'Bottom strip must be anchored to the photo, not viewport');
  if(fraction===.18)assert(box.height/height<.25,'Normal Small stamp should occupy less than a quarter of the photo height');
}
try {
  await open();
  await page.evaluate(()=>{const original=GxaGpsExport;window.gpsQaRenders=[];window.GxaGpsExport={...original,render(target,photo,model,options){const box=original.render(target,photo,model,options);window.gpsQaRenders.push({box,width:target.width,height:target.height,mapSize:model.mapSize,template:model.template});return box;}};});
  assert.equal(await page.locator('.gps-studio__map-size').inputValue(),'small');
  assert.equal(await page.locator('.gps-studio__opacity').inputValue(),'84');
  assert(await page.locator('.gps-studio__format').isDisabled(),'Combined EXIF mode must use JPG');
  mapBytes=await fixture(640,480,true);await upload(1080,1440);await point();await resolved();
  assert.equal(await page.locator('[data-field=place]').inputValue(),'Palika Nagar, Agra');
  assert.match(await page.locator('.gps-studio__resolved-address').innerText(),/282006/);
  assert.equal(mapRequests,0,'Street map transmission must require explicit action');
  await page.locator('.gps-studio__date').fill('2026-09-22T14:35');
  await page.locator('.gps-studio__alt').fill('169');
  await page.locator('[data-visible=postal]').check();
  await page.locator('[data-visible=country]').check();
  const outputs=[];
  for(const shape of ['portrait','landscape']){
    if(shape==='landscape')await upload(1600,900);
    for(const template of ['classic','field','travel']){
      await page.locator('.gps-studio__template').selectOption(template);
      const bytes=await download(template+'-'+shape+'.jpg');
      const metadata=await page.evaluate(bytes=>GxaGpsPhotoCore.inspectJpeg(new Uint8Array(bytes)),Array.from(bytes));
      assert(metadata.hasGps);assert(Math.abs(metadata.gps.latitude-27.184)<1e-6);
      const size=await page.evaluate(async bytes=>{const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/jpeg'}));const size=[image.width,image.height];image.close();return size;},Array.from(bytes));
      assert.deepEqual(size,shape==='portrait'?[1080,1440]:[1600,900]);
      const draw=await geometry();assertCompact(draw);outputs.push({template,shape,bytes:bytes.length,geometry:draw});
    }
  }
  await page.locator('.gps-studio__load-map').click();await page.waitForFunction(()=>document.querySelector('.gps-studio__map-status').textContent.startsWith('Street map ready'));
  await page.locator('.gps-studio__template').selectOption('classic');
  await download('street-map-landscape.jpg');assertCompact(await geometry());assert.equal(mapRequests,1);
  await upload(1080,1440);await page.locator('.gps-studio__date').fill('2026-09-22T14:35');
  await download('street-map-portrait.jpg');assertCompact(await geometry());
  for(const [mapSize,fraction] of [['medium',.23],['large',.28]]){
    await page.locator('.gps-studio__map-size').selectOption(mapSize);
    await page.waitForFunction(size=>window.gpsQaRenders.at(-1).mapSize===size,mapSize);
    assertCompact(await geometry(),fraction);
    await download(mapSize+'-portrait.jpg');assertCompact(await geometry(),fraction);
  }
  await page.locator('.gps-studio__map-size').selectOption('small');
  // Actual high-resolution PNG downloads: same strip geometry as the downsampled
  // preview, full source dimensions, and unchanged photo pixels above the strip.
  const highResolution=[];
  await page.locator('.gps-studio__mode').selectOption('stamp');
  await page.waitForFunction(()=>!document.querySelector('.gps-studio__format').disabled);
  await page.locator('.gps-studio__format').selectOption('image/png');
  for(const [shape,width,height] of [['portrait',3000,4000],['landscape',3840,2160]]){
    const source=await upload(width,height);await page.locator('.gps-studio__date').fill('2026-09-22T14:35');
    await page.setViewportSize({width:390,height:844});
    const bytes=await download('high-resolution-'+shape+'.png');
    assert.deepEqual(Array.from(bytes.slice(0,8)),[137,80,78,71,13,10,26,10]);
    const renders=await page.evaluate(()=>window.gpsQaRenders.slice(-2));
    const [preview,exported]=renders;assertCompact(exported);
    assert.equal(Math.max(preview.width,preview.height),1600);
    assert.equal(exported.width,width);assert.equal(exported.height,height);
    for(const key of ['x','y','width','height'])assert(Math.abs(preview.box[key]/preview.width-exported.box[key]/width)<1e-8,'Preview/export '+key+' mismatch');
    for(const key of ['x','y','width','height'])assert(Math.abs(preview.box.map[key]/preview.width-exported.box.map[key]/width)<1e-8,'Preview/export map '+key+' mismatch');
    const pixels=await page.evaluate(async({original,output,top})=>{
      const decode=async bytes=>createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
      const a=await decode(original),b=await decode(output);const c=document.createElement('canvas');c.width=a.width;c.height=1;const ctx=c.getContext('2d');
      const sample=Math.max(0,Math.floor(top)-2);
      ctx.drawImage(a,0,-sample);const before=ctx.getImageData(0,0,c.width,1).data;
      ctx.clearRect(0,0,c.width,1);ctx.drawImage(b,0,-sample);const after=ctx.getImageData(0,0,c.width,1).data;
      const result={width:b.width,height:b.height,unchanged:before.every((value,i)=>value===after[i])};a.close();b.close();return result;
    },{original:Array.from(source),output:Array.from(bytes),top:exported.box.y});
    assert.deepEqual(pixels,{width,height,unchanged:true});highResolution.push(exported);
  }
  await page.locator('.gps-studio__mode').selectOption('both');
  await page.waitForFunction(()=>document.querySelector('.gps-studio__format').disabled);
  assert.equal(await page.locator('.gps-studio__format').inputValue(),'image/jpeg','Switching modes cannot silently omit GPS EXIF');
  await page.setViewportSize({width:1440,height:1000});await upload(1080,1440);
  await page.locator('[data-field=place]').fill('Manual title');await page.locator('[data-field=address]').fill('Manual address');await page.locator('.gps-studio__lookup').click();await resolved();
  assert.equal(await page.locator('[data-field=place]').inputValue(),'Manual title');assert.equal(await page.locator('[data-field=address]').inputValue(),'Manual address');
  geocodeMode='slow';await point(25,75);await page.locator('[data-field=place]').fill('Edited while resolving');await resolved();assert.equal(await page.locator('[data-field=place]').inputValue(),'Edited while resolving');
  geocodeMode='slow';await point(26,76);geocodeMode='failure';await point(-33,151);await resolved();await page.waitForTimeout(450);
  assert.equal(await page.locator('.gps-studio__resolved-title').innerText(),'Location name unavailable');assert.equal(await page.locator('[data-field=city]').inputValue(),'');
  assert.equal(await page.locator('.gps-studio__lat').inputValue(),'-33.000000');
  mapMode='failure';await page.locator('.gps-studio__load-map').click();await page.waitForFunction(()=>document.querySelector('.gps-studio__map-status').textContent.includes('instead'));
  await download('fallback-no-address.jpg');
  geocodeMode='empty';await point(0,0);await resolved();assert.equal(await page.locator('.gps-studio__resolved-title').innerText(),'Location name unavailable');
  await page.locator('.gps-studio__coordinate-format').selectOption('dms');
  await page.locator('.gps-studio__position').selectOption('top');await download('zero-coordinates-top-dms.jpg');

  // The canvas text is measured in the renderer's transformed coordinates; detect clipped or overflowing labels.
  const bounds=await page.evaluate(()=>{
    const target=document.createElement('canvas');target.width=1080;target.height=1440;const photo=document.querySelector('.gps-studio__preview canvas');
    const ctx=target.getContext('2d'), original=ctx.fillText.bind(ctx), runs=[];
    ctx.fillText=(text,x,y,...rest)=>{const t=ctx.getTransform(),width=ctx.measureText(text).width;runs.push({text,x:x*t.a+t.e,right:(x+width)*t.a+t.e,y:y*t.d+t.f});return original(text,x,y,...rest);};
    const model=GxaGeoModel.buildExportOverlayModel({location:{latitude:27,longitude:78},date:'2026-09-22T14:35',fields:{place:'A meaningful long location title to test wrapping',address:'LongStreetNameWithoutSpaces'.repeat(5)+', Agra, Uttar Pradesh 282006, India',remarks:'Detailed inspection note '.repeat(8)},template:'classic'});
    const box=GxaGpsExport.render(target,photo,model);
    return {box,runs};
  });
  for(const run of bounds.runs){assert(run.x>=0&&run.right<=1081&&run.y>=0&&run.y<=1441,'Text exceeds image: '+JSON.stringify(run));assert(!/undefined|null|NaN/.test(run.text));}
  assert(bounds.runs.some(run=>run.text.includes('282006')),'Address tail must not be lost');
  const edgeCases=await page.evaluate(()=>{
    const photo=document.createElement('canvas');photo.width=3001;photo.height=4003;
    const map=document.createElement('canvas');map.width=640;map.height=480;
    const logo=document.createElement('canvas');logo.width=60;logo.height=60;
    const run=(width,height,options,provider=false)=>{
      const target=document.createElement('canvas');target.width=width;target.height=height;
      const ctx=target.getContext('2d'),fill=ctx.fillText.bind(ctx),draw=ctx.drawImage.bind(ctx),texts=[],mapCalls=[];
      ctx.fillText=(text,...args)=>{texts.push(text);return fill(text,...args);};
      ctx.drawImage=(image,...args)=>{if(image===map)mapCalls.push(args);return draw(image,...args);};
      const model=GxaGeoModel.buildExportOverlayModel({location:{latitude:27,longitude:78},date:'2026-09-22T14:35',fields:{place:'Long location title',address:'An address with complete details '.repeat(12),remarks:'An optional report '.repeat(10)},...options});
      const box=GxaGpsExport.render(target,photo,model,{mapImage:provider?map:null,logo});
      return {box,texts,mapCalls,corner:Array.from(ctx.getImageData(width-3,height-3,1,1).data)};
    };
    const parity=[];
    for(const template of ['classic','field','travel']){
      const full=run(3001,4003,{template}),preview=run(Math.round(3001*1600/4003),1600,{template});
      parity.push({full,preview});
    }
    return {parity,top:run(1080,1440,{position:'top'}),hidden:run(1080,1440,{showMap:false}),provider:run(1080,1440,{},true),transparent:run(1080,1440,{opacity:.78}),opaque:run(1080,1440,{opacity:1})};
  });
  for(const {full,preview} of edgeCases.parity){
    assert.deepEqual(preview.texts,full.texts,'Odd source dimensions must not change wrapping in the downsampled preview');
    for(const key of ['y','height'])assert(Math.abs(preview.box[key]/1600-full.box[key]/4003)<1e-8);
    assert(full.texts.includes('COORDINATE LOCATOR'));assert(full.texts.includes('Not a street map'));
  }
  assert.equal(edgeCases.top.box.y,0);
  assert.equal(edgeCases.hidden.box.map,null);assert(!edgeCases.hidden.texts.includes('COORDINATE LOCATOR'));
  assert(edgeCases.provider.texts.includes('STREET MAP'));assert(!edgeCases.provider.texts.includes('Not a street map'));
  assert(edgeCases.provider.texts.some(text=>text.includes('© OpenStreetMap contributors')&&text.includes('Powered by Geoapify')));
  assert.equal(edgeCases.provider.mapCalls.length,1);assert.equal(edgeCases.provider.mapCalls[0].length,4,'Contain the whole provider bitmap, never crop its attribution');
  assert.notDeepEqual(edgeCases.transparent.corner,edgeCases.opaque.corner,'Opacity control must affect real output pixels');
  await page.locator('.gps-studio__position').selectOption('bottom');geocodeMode='success';await upload(1080,1440);await point();await resolved();
  for(const width of [320,360,390,430,768,1024,1440]){
    await page.setViewportSize({width,height:width<600?844:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow at '+width);
    await page.locator('.gps-studio__inspect').check();await page.waitForFunction(()=>!document.querySelector('.gps-studio__detail').hidden);
    assert(await page.locator('.gps-studio__detail canvas').evaluate(el=>el.getBoundingClientRect().width<=innerWidth));
    if (width === 390) {
      await page.locator('.gps-studio__detail-zoom input').fill('200');
      assert(await page.locator('.gps-studio__detail').evaluate(el=>el.scrollWidth>el.clientWidth), 'Zoom must enlarge the stamp in a contained scroll region');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), 'Zoom must not overflow the page');
      await page.locator('.gps-studio__detail').evaluate(el=>el.scrollLeft=100);
      assert(await page.locator('.gps-studio__detail').evaluate(el=>el.scrollLeft>0));
      await page.screenshot({path:resolve(evidence,'stamp-zoom-mobile.png'),animations:'disabled'});
      await page.locator('.gps-studio__detail-zoom input').fill('100');
    }
    await page.locator('.gps-studio__photo').scrollIntoViewIfNeeded();
    if([390,1440].includes(width))await page.screenshot({path:resolve(evidence,'studio-'+width+'.png'),animations:'disabled'});
  }
  await page.locator('.gps-studio__inspect').uncheck();
  await page.locator('#theme-toggle-btn').click();await page.locator('.gps-studio__resolved').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(evidence,'studio-dark.png'),animations:'disabled'});
  await page.locator('.gps-studio__reset').click();assert.equal(await page.locator('[data-field=address]').inputValue(),'');assert(await page.locator('.gps-studio__load-map').isDisabled());
  assert.deepEqual(errors,[]);
  await writeFile(resolve(evidence,'results.json'),JSON.stringify({outputs,highResolution,mapRequests,passed:['three compact templates × two orientations exported/reopened','Small default and 18/23/28% map sizes','left map in all presets','full-resolution PNG/preview parity','odd source dimensions and long-text wrapping parity in all presets','top positioning and map visibility','opacity changes pixels','provider labels and uncropped attribution','unchanged pixels above overlay','JPG EXIF mode/PNG safety','verified EXIF','explicit provider map','provider failure fallback','empty/no-name/zero coordinates','manual edit preserved across lookup and pending request','stale lookup ignored','address fields cleared at new point','long address tail and text bounds','stamp detail view','seven viewport widths','dark mode','reset'],errors},null,2));
  console.log('Compact geotag browser QA passed: six template/orientation JPEGs, map sizes, full-resolution mobile PNG downloads/preview parity, EXIF, map/fallback, race safety, text bounds and responsive inspector.');
}finally{await context.close();await browser.close();await new Promise(done=>server.close(done));}
