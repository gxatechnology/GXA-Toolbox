// Local browser fixtures only. Never requests production services or writes real accounts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createAdminQaServer, fixture } from './admin-browser-qa-server.mjs';
import { buildToolAnalytics } from '../netlify/functions/_admin-tool-analytics.mjs';
import { getAdminDateRange } from '../netlify/functions/_admin-integrations.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server=createAdminQaServer();
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
const evidence=resolve('test-results/admin-final-audit');
const mobileEvidence=resolve('test-results/admin-mobile-after');
await mkdir(evidence,{recursive:true});
await mkdir(mobileEvidence,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.GXA_BROWSER_EXECUTABLE?{executablePath:process.env.GXA_BROWSER_EXECUTABLE}:{})});
const context=await browser.newContext({hasTouch:true,reducedMotion:'reduce'});
let authenticated=false, failure=0, mode='connected', logoutFailure=false, requests=0, holdData=null;
await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin) return route.abort();
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname.endsWith('/admin-session')) return json({authenticated});
  if(url.pathname.endsWith('/admin-login')){authenticated=true;return json({success:true});}
  if(url.pathname.endsWith('/admin-logout')){if(logoutFailure)return json({message:'Unavailable'},503);authenticated=false;return json({success:true});}
  if(url.pathname.endsWith('/admin-data')){
    requests++;
    if(!authenticated || failure) return json({message:'Test failure'},failure||401);
    const data=structuredClone(fixture);
    data.range=url.searchParams.get('range')||'30d';data.dateRange=getAdminDateRange(data.range);
    if(mode==='missing'){
      for(const report of Object.values(data.reports)) Object.assign(report,{status:'configuration_required',label:'Reporting not connected',metrics:null,rows:[],trend:[],groups:{}});
      data.toolAnalytics=buildToolAnalytics([],false);data.overview.internal=null;
    }
    if(mode==='no-data')Object.assign(data.reports.ga4,{status:'connected',dataState:'no_data',label:'Connected · No Data',metrics:null,rows:[],trend:[],groups:{}});
    if(holdData) await holdData;
    return json(data);
  }
  return route.continue();
});
const page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const results=[];
const overflow=async(label)=>{
  const size=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth}));
  assert.ok(size.body<=size.viewport+1&&size.root<=size.viewport+1,`${label}: ${JSON.stringify(size)}`);
};
const ready=()=>page.waitForFunction(()=>!document.getElementById('refresh-data').disabled&&!document.getElementById('admin-app').hidden);
const nav=async section=>{if(await page.locator('#open-drawer').isVisible())await page.locator('#open-drawer').tap();await page.locator(`[data-section="${section}"]`).tap();await page.waitForFunction(value=>document.querySelector('.nav-item.active')?.dataset.section===value,section);};
try{
  await page.setViewportSize({width:320,height:800});await page.goto(origin+'/admin/');
  await page.locator('#admin-login-form').waitFor({state:'visible'});await overflow('login320');
  await page.screenshot({path:resolve(mobileEvidence,'login-320.png'),fullPage:true});
  assert.equal(await page.locator('#admin-email').inputValue(),'');assert.equal(await page.locator('#admin-password').inputValue(),'');
  await page.locator('#admin-email').fill('local.admin@example.test');await page.locator('#admin-password').fill('LocalTestOnly!');await page.locator('#admin-login-form button[type=submit]').tap();await ready();
  await page.setViewportSize({width:320,height:568});await page.locator('#open-drawer').tap();await overflow('drawer320x568');
  await page.screenshot({path:resolve(mobileEvidence,'drawer-320.png')});
  await page.locator('#admin-logout').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#admin-logout').evaluate(button=>button.getBoundingClientRect().bottom<=innerHeight),'Short-screen drawer must scroll to logout.');
  await page.screenshot({path:resolve(mobileEvidence,'drawer-lower-320.png')});
  await page.keyboard.press('Escape');
  const widths=[320,360,375,390,414,430,480,600,768,1024,1280,1440,1920];
  const screenshots=new Map([
    ['320/overview','overview-320.png'],
    ['390/adsterra','adsterra-390.png'],
    ['430/tools','tools-430.png'],
    ['600/support','support-600.png'],
    ['768/overview','overview-768.png'],
    ['1440/overview','overview-1440.png']
  ]);
  for(const width of widths){
    await page.setViewportSize({width,height:width>=1000?900:844});
    if(width<=768){
      await page.locator('.mobile-brand').waitFor({state:'visible'});
      assert.equal((await page.locator('.mobile-brand strong').innerText()).trim(),'GXA Toolbox');
      assert.equal(await page.locator('.account-actions').isVisible(),false);
    }else{
      assert.equal(await page.locator('.mobile-brand').isVisible(),false);
      assert.equal(await page.locator('.sidebar').isVisible(),true);
      assert.equal(await page.locator('.topbar-title').isVisible(),true);
    }
    for(const section of ['overview','analytics','tools','seo','adsense','adsterra','users','support','system']){
      await nav(section);await overflow(`${width}/${section}`);
      if(width<=768){assert.equal(await page.locator('.sidebar').evaluate(node=>node.classList.contains('open')),false);assert.equal(await page.locator('.drawer-backdrop').isVisible(),false);}
      const activeLabel=(await page.locator('.nav-item.active').innerText()).trim().split(/\n/).at(-1).trim();
      assert.equal((await page.locator('#mobile-section-title').innerText()).trim(),activeLabel);
      assert.doesNotMatch(await page.locator('#dashboard-content').innerText(),/\bNaN\b|\bInfinity\b/);
      const screenshot=screenshots.get(`${width}/${section}`);
      if(screenshot){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(mobileEvidence,screenshot),fullPage:true});}
      if(section==='tools'){
        assert.equal(await page.locator('#tool-results tbody tr').count(),25);
        const ids=new Set();
        while(true){for(const name of await page.locator('#tool-results tbody tr td:first-child').allTextContents())ids.add(name);const next=page.locator('[data-page="1"]');if(await next.isDisabled())break;await next.tap();}
        assert.equal(ids.size,fixture.toolAnalytics.rows.length);
        await page.locator('#tool-search').fill('GPS Map Camera');assert.equal(await page.locator('#tool-results tbody tr').count(),1);
        await page.locator('#tool-search').fill('');await page.locator('#tool-category').selectOption('image');
        assert.ok((await page.locator('#tool-results tbody tr td:nth-child(2)').allTextContents()).every(value=>value==='image'));
        await page.locator('#tool-category').selectOption('');await page.locator('#tool-activity').selectOption('zero');
        assert.match(await page.locator('#tool-results').innerText(),new RegExp(`${fixture.toolAnalytics.rows.length-1} matching`));
        await page.locator('#tool-activity').selectOption('all');
        assert.ok(await page.locator('#tool-results tbody tr td:first-child').first().evaluate(cell=>cell.getBoundingClientRect().width>=190),'Tool names need a readable column, not letter-by-letter wrapping.');
        if([320,390,768,1366].includes(width)){
          await page.evaluate(()=>window.scrollTo(0,0));
          await page.screenshot({path:resolve(evidence,`tools-${width}.png`)});
          await page.locator('#tool-results').scrollIntoViewIfNeeded();
          await page.screenshot({path:resolve(evidence,`tool-table-${width}.png`)});
        }
      }
      if(section==='support'){
        assert.equal(await page.locator('.support-message-preview img').count(),0,'Stored markup must remain escaped text.');
        await page.locator('#support-filter').selectOption('resolved');assert.match(await page.locator('#dashboard-content').innerText(),/No Data Available/);await page.locator('#support-filter').selectOption('');
      }
      results.push({width,section,overflow:false,status:'passed'});
    }
    if(width<=768){
      await page.locator('#open-drawer').tap();
      await overflow(`${width}/drawer-open`);
      assert.equal(await page.evaluate(()=>document.querySelector('.app-column').inert),true);
      await page.locator('#admin-logout').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'close-drawer');
      await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'open-drawer');
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    }
  }
  await nav('tools');const countBefore=requests;await page.locator('#date-range').selectOption('3m');await ready();assert.equal(requests,countBefore+1);assert.match(await page.locator('#data-timestamp').innerText(),/UTC range/);
  failure=503;await page.locator('#date-range').selectOption('7d');await ready();assert.equal(await page.locator('#date-range').inputValue(),'3m');assert.match(await page.locator('#dashboard-status').innerText(),/Previous data/);
  failure=0;mode='no-data';await page.locator('#refresh-data').tap();await ready();await nav('analytics');assert.match(await page.locator('.kpi-value').first().innerText(),/No data/);
  mode='missing';await page.locator('#refresh-data').tap();await ready();await nav('adsense');assert.equal(await page.locator('#dashboard-content .kpi-card').count(),0);assert.match(await page.locator('#dashboard-content').innerText(),/Reporting not connected/);
  await nav('tools');assert.match(await page.locator('#tool-results tbody tr').first().innerText(),/Not available/);
  logoutFailure=true;await page.locator('#admin-logout').click();await page.waitForFunction(()=>document.getElementById('dashboard-status').textContent.includes('Logout failed'));assert.equal(await page.locator('#admin-app').isVisible(),true);assert.match(await page.locator('#dashboard-status').innerText(),/Logout failed/);
  failure=401;await page.locator('#refresh-data').click();await page.locator('#admin-login-form').waitFor({state:'visible'});assert.equal(await page.locator('#dashboard-content').innerText(),'');
  failure=0;mode='connected';await page.locator('#admin-password').fill('LocalTestOnly!');await page.locator('#admin-login-form button[type=submit]').click();await ready();
  let releaseData;holdData=new Promise(done=>{releaseData=done;});
  const heldRequest=page.waitForRequest('**/admin-data?*');await page.locator('#refresh-data').click();await heldRequest;
  logoutFailure=false;await page.locator('#admin-logout').click();await page.locator('#admin-login-form').waitFor({state:'visible'});
  const released=page.waitForResponse('**/admin-data?*');releaseData();holdData=null;await released;
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  assert.equal(await page.locator('#admin-app').isVisible(),false,'Late data response must not resurrect a logged-out dashboard.');
  assert.equal(await page.locator('#dashboard-content').innerText(),'');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(evidence,'results.json'),JSON.stringify({source:'Local response fixtures, not live integration data',results,errors},null,2));
  console.log(`Admin browser QA passed: ${results.length} section/viewport checks, ${fixture.toolAnalytics.rows.length} tools, filters, touch, focus, expiry, logout, unavailable states.`);
}finally{await context.close();await browser.close();await new Promise(done=>server.close(done));}
