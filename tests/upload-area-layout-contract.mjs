// Measures the generated application in real Chromium; no production requests or accounts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';
import { createQaServer } from './browser-qa-server.mjs';
import { CdpClient, waitForDebuggerUrl, evaluate, waitFor } from './helpers/chrome-cdp.mjs';

const tools = await loadToolRegistry();
const evidence = resolve('test-results/upload-area-layout');
await mkdir(evidence, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'gxa-input-layout-'));
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.GXA_BROWSER_EXECUTABLE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-background-networking', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const viewports = [[320,568],[360,800],[375,812],[390,844],[412,915],[430,932],[768,1024],[1024,768],[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080]];
const representatives = new Set(['merge-pdf','compress-image','image-converter','edit-pdf','compress-pdf','background-remover','gps-map-camera','base64-tool','password-generator','emi-calculator']);
const screenshotWidths = new Set([320,390,1280,1366,1920]);
const results = [];
let client;
const areaSelector = '.upload-zone, .crop-upload-state, .image-converter__drop, .pdf-edit-upload, .gps-studio__upload, .upload-page .drop-zone, .tool-options-panel';
// User Agent Parser displays detected information automatically, with no input.
const pageSelector = `(location.pathname === '/user-agent/' ? '#generator-preview-mount' : ${JSON.stringify(areaSelector)})`;
const measure = `(() => {
  const visible = el => !!el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden], .hidden');
  const candidates = Array.from(document.querySelectorAll(${pageSelector}));
  const area = candidates.find(visible);
  if (!area) return { issues: ['missing input area'] };
  const rect = area.getBoundingClientRect();
  const header = document.querySelector('.header-nav, .gxa-header')?.getBoundingClientRect();
  const issues = [];
  const exposedHidden = Array.from(document.querySelectorAll('.tool-container [hidden]:not([hidden="until-found"])')).filter(el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0);
  if (exposedHidden.length) issues.push('inactive hidden panel exposed');
  const clip = [];
  const checked = [area, ...area.querySelectorAll('input:not([type=file]):not([type=hidden]), textarea, select, button, h3, p, .upload-formats, .upload-limit')].filter(visible);
  for (const el of checked) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) issues.push('zero-size control');
    if (r.left < -1 || r.right > document.documentElement.clientWidth + 1) issues.push('horizontal control overflow');
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p), b = p.getBoundingClientRect();
      const x = /hidden|clip|auto|scroll/.test(s.overflowX) && (r.left < b.left-2 || r.right > b.right+2);
      const y = /hidden|clip|auto|scroll/.test(s.overflowY) && (r.top < b.top-2 || r.bottom > b.bottom+2);
      if (x || y) clip.push({ element: el.id || el.className, parent: p.id || p.className, x, y, overflow: s.overflow });
    }
  }
  if (clip.length) issues.push('ancestor clipping');
  if (rect.top < (header?.bottom || 0)-1) issues.push('header overlap');
  if (document.documentElement.scrollWidth > innerWidth+1) issues.push('page overflow');
  const inputType = location.pathname === '/user-agent/' ? 'automatic read-only information' : area.matches('.tool-options-panel') ? (area.querySelector('textarea') ? 'textarea' : document.querySelector('.tool-family-calculator') ? 'calculator' : 'form / generator') : 'upload';
  return { type: inputType, selector: area.className, family: document.querySelector('[data-workspace-family]')?.dataset.workspaceFamily || 'dedicated-image-editor', top: rect.top, areaWidth: rect.width, areaHeight: rect.height, exposedHidden:exposedHidden.map(el=>el.className), clip, issues: [...new Set(issues)] };
})()`;
try {
  const ws = await waitForDebuggerUrl(chrome);
  const target = await (await fetch(`http://127.0.0.1:${new URL(ws).port}/json/new?about:blank`, { method:'PUT' })).json();
  client = new CdpClient(target.webSocketDebuggerUrl); await client.connect();
  await client.send('Page.enable'); await client.send('Network.enable');
  await client.send('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value:'reduce'}] });
  await client.send('Network.setBlockedURLs', { urls:['*googletagmanager.com*','*google-analytics.com*','*googlesyndication.com*','*doubleclick.net*'] });
  for (const tool of tools) {
    await client.send('Emulation.setDeviceMetricsOverride', {width:320,height:568,deviceScaleFactor:1,mobile:true});
    const loaded = client.waitFor('Page.loadEventFired');
    await client.send('Page.navigate', { url:`${origin}/${tool.id}/` }); await loaded;
    await waitFor(client, `Boolean(document.querySelector(${JSON.stringify(areaSelector)}))`, tool.id);
    await evaluate(client, 'document.fonts.ready.then(() => true)');
    for (const [width,height] of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:width<=768});
      await evaluate(client, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      await evaluate(client, `(() => { const a=Array.from(document.querySelectorAll(${pageSelector})).find(e=>e.getBoundingClientRect().height>0&&!e.closest('[hidden], .hidden')); if(a) a.scrollIntoView({block:'start',behavior:'instant'}); })()`);
      const result = await evaluate(client, measure);
      const reachable = await evaluate(client, `(() => {
        const visible = e => e.getBoundingClientRect().height > 0 && !e.closest('[hidden], .hidden');
        const a = Array.from(document.querySelectorAll(${pageSelector})).find(visible);
        if (location.pathname === '/user-agent/') return a.textContent.includes(navigator.userAgent) ? 'not applicable: automatic information' : false;
        const c = a?.matches('[tabindex]') ? a : Array.from(a?.querySelectorAll('button:not(:disabled), input:not([type=hidden]):not(:disabled), textarea, select:not(:disabled)') || []).find(visible);
        if (!c) return false;
        c.scrollIntoView({block:'center',behavior:'instant'}); c.focus({preventScroll:true});
        const r=c.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(r.height/2,22));
        const okay = (hit===c || c.contains(hit)) && document.activeElement===c;
        c.blur(); a.scrollIntoView({block:'start',behavior:'instant'});
        return okay;
      })()`);
      result.primaryControlReachable = reachable;
      if (!reachable) result.issues.push('primary control unreachable');
      results.push({route:tool.id,width,height,...result});
      if (representatives.has(tool.id) && screenshotWidths.has(width)) {
        const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(join(evidence,`${tool.id}-${width}x${height}.png`),Buffer.from(shot.data,'base64'));
        // Tall forms use normal document scrolling. Preserve full-page evidence too.
        const metrics = await client.send('Page.getLayoutMetrics');
        const full = await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1}});
        await writeFile(join(evidence,`${tool.id}-${width}x${height}-full.png`),Buffer.from(full.data,'base64'));
      }
    }
    console.log(`${tool.id}: ${results.filter(r=>r.route===tool.id && r.issues.length).length} failing viewports`);
  }
  await writeFile(join(evidence,'measurements.json'),JSON.stringify(results,null,2));
  const rows=tools.map(tool=>{
    const entries=results.filter(r=>r.route===tool.id), failures=entries.filter(r=>r.issues.length);
    const status = widths => entries.filter(r=>widths(r.width)).every(r=>!r.issues.length)?'PASS':'NEEDS REVIEW';
    return `| ${tool.name} | /${tool.id}/ | ${entries[0].type} | ${entries[0].family} | ${failures.length?'No':'Yes'} | ${failures.some(r=>r.issues.includes('header overlap'))?'Yes':'No'} | ${failures.some(r=>r.clip?.some(c=>c.y))?'Yes':'No'} | ${failures.some(r=>r.issues.includes('horizontal control overflow'))?'Yes':'No'} | ${failures.some(r=>r.clip?.length)?'Yes':'No'} | ${status(w=>w<=768)} | ${status(w=>w>=1024&&w<=1366)} | ${status(w=>w>=1440)} | Shared natural-flow input rules | ${failures.length?'NEEDS REVIEW':'PASS'} |`;
  });
  const reportPath=resolve('docs/UPLOAD_AREA_LAYOUT_AUDIT.md');
  // Regenerate only the matrix; preserve the maintained methodology and limits.
  const introduction=(await readFile(reportPath,'utf8').catch(()=>'# Upload and input layout audit\n\n')).split('| Tool | Route |')[0];
  await writeFile(reportPath,`${introduction}| Tool | Route | Input type | Family | Visible | Top clipped | Bottom clipped | Horizontal clipped | Parent clips | Mobile | Laptop | Desktop | Fix | Status |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
  assert.equal(results.length,tools.length*viewports.length);
  const failures=results.filter(r=>r.issues.length);
  assert.equal(failures.length,0,JSON.stringify(failures.slice(0,8)));
  console.log(`PASS: ${tools.length} tools, ${results.length} layout/reachability checks, 50 viewport + 50 full-page screenshots.`);
} finally {
  client?.close(); const exited=new Promise(done=>chrome.once('exit',done)); chrome.kill();
  await Promise.race([exited,new Promise(done=>setTimeout(done,3000))]);
  await new Promise(done=>server.close(done));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});
}
