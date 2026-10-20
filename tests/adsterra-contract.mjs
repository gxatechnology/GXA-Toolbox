import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from '../public_html/assets/ad-config.js';
import layout from '../public_html/assets/ad-layout.js';
import { AD_NETWORK, applyAdNetwork } from '../config/ad-network.mjs';
import { loadToolRegistry, loadToolQuality, loadContentPageRegistry } from '../scripts/tool-registry.mjs';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
assert.ok(['adsterra', 'adsense', 'off'].includes(AD_NETWORK));
assert.equal(config.maxPlacements, 6);
assert.equal(config.providerSiteId, 6091425);
assert.equal(config.interstitial.enabled, false);
for (const tool of ['edit-pdf', 'crop-image', 'organize-pdf', 'background-remover', 'gps-map-camera']) assert.ok(!config.railTools.includes(tool));
for (const viewport of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1600, 1920]) {
  for (const tool of ['compress-pdf', 'edit-pdf', 'future-unknown-editor']) {
    const plan = layout.plan(config, { tool, viewport, inlineWidth: viewport - 48, leftSpace: 360, rightSpace: 360 });
    assert.ok(plan.length <= (viewport < 768 ? 2 : tool === 'compress-pdf' ? 6 : 3));
    assert.equal(new Set(plan.map(item => item.unit.key || item.unit.containerId)).size, plan.length);
    assert.ok(plan.filter(item => item.unit.key).every(item => item.unit.width <= viewport - 48));
    if (viewport < 1280 || tool !== 'compress-pdf') assert.ok(!plan.some(item => ['left', 'right'].includes(item.zone)));
    if (viewport < 1440) assert.ok(!plan.some(item => item.zone === 'left'));
    if (viewport >= 768 && viewport < 1280) { assert.ok(plan.length <= 3); assert.equal(plan.find(item => item.zone === 'top')?.unit.width, 468); }
    const right = plan.find(item => item.zone === 'right');
    if (right) assert.deepEqual([right.unit.width, right.unit.height], [300, 250]);
    assert.ok(plan.filter(item => item.unit.width === 160).length <= 1);
  }
}
const uploadRails = layout.plan(config, { tool: 'organize-pdf', viewport: 1440, inlineWidth: 1200, leftSpace: 200, rightSpace: 324, railEligible: true });
assert.deepEqual(uploadRails.map(item => item.zone), ['top', 'after-tool', 'right', 'left']);
assert.ok(!layout.plan(config, { tool: 'organize-pdf', viewport: 1280, inlineWidth: 1200, leftSpace: 100, rightSpace: 324, railEligible: true }).some(item => item.zone === 'left'));
assert.deepEqual(layout.plan({ ...config, network: 'off' }, { tool: 'compress-pdf', viewport: 1920, inlineWidth: 1200 }), []);
assert.ok(!layout.plan(config, { tool: 'compress-pdf', viewport: 1920, inlineWidth: 1200, leftSpace: 180, rightSpace: 180 }).some(item => ['left', 'right'].includes(item.zone)));
assert.equal(config.native.src, 'https://bauval.org/21/b1b26904317d94da1830e1f5dd69d6d9');
assert.equal(config.native.containerId, 'container-b1b26904317d94da1830e1f5dd69d6d9');
assert.equal(config.native.unitId, 31513079);
assert.equal(config.native.enabled, true);
assert.equal(config.banners.length, 6);
assert.deepEqual(config.banners.map(unit => [unit.key, unit.width, unit.height]), [
  ['82dc3dcdb859ef27455f631d49183d07', 728, 90],
  ['2cc9598f48bdcb102277c47352490483', 300, 250],
  ['eb9ac703bb90ff49c53631490a2933f5', 320, 50],
  ['a141cf44861510c02f8b814719a223bf', 468, 60],
  ['983c84b73f5901c5877413ab9680312e', 160, 600],
  ['900dabd0bb67d683bd5dbc7486b6d25a', 160, 300]
], 'Exact fixed-unit keys and dimensions from the approved reference');
assert.deepEqual(config.banners.map(unit => [unit.unitId, unit.key]), [
  [31513011, '82dc3dcdb859ef27455f631d49183d07'],
  [31513012, '2cc9598f48bdcb102277c47352490483'],
  [31513010, 'eb9ac703bb90ff49c53631490a2933f5'],
  [31513009, 'a141cf44861510c02f8b814719a223bf'],
  [31513008, '983c84b73f5901c5877413ab9680312e'],
  [31513013, '900dabd0bb67d683bd5dbc7486b6d25a']
], 'Exact provider unit IDs map to the approved keys');
for (const unit of config.banners) {
  assert.equal(unit.enabled, true); assert.equal(unit.src, `https://bauval.org/22/${unit.key}`);
  assert.ok(unit.width > 0 && unit.height > 0);
}
assert.equal(config.intrusive.popunder.enabled, true); assert.equal(config.intrusive.socialBar.enabled, true);
assert.equal(config.intrusive.smartlink.enabled, false);
assert.equal(config.intrusive.smartlink.unitId, 31822155);
assert.equal(config.intrusive.popunder.unitId, 31513006);
assert.equal(config.intrusive.socialBar.unitId, 31513007);
assert.equal(config.intrusive.popunder.src, 'https://abscloud.org/1/3a66eef4b20eb6bc449cee178926437d');
assert.equal(config.intrusive.socialBar.src, 'https://bauval.org/14/fcd69a971630acd0557b6a7e1c55ba85');
assert.deepEqual(config.intrusive.socialBar.approvedRoutes, ['*']);
assert.deepEqual(config.intrusive.popunder.approvedRoutes, ['*']);
for (const unit of config.banners) {
  const disabled = { ...config, banners: config.banners.map(item => ({ ...item, enabled: item.key !== unit.key })) };
  for (const viewport of [390, 1024, 1600, 1800, 1920, 2400]) {
    assert.ok(!layout.plan(disabled, { tool: 'compress-image', viewport, inlineWidth: viewport - 48, leftSpace: 400, rightSpace: 400 }).some(item => item.unit.key === unit.key));
  }
}
assert.deepEqual(layout.plan({ ...config, native: { ...config.native, enabled: false }, banners: config.banners.map(item => ({ ...item, enabled: false })) }, { tool: 'compress-image', viewport: 1920, inlineWidth: 1280, leftSpace: 400, rightSpace: 400 }), []);
const runtime = await read('public_html/assets/ad-network.js');
assert.doesNotMatch(runtime, /innerHTML|document\.write|frame\.contentWindow\.atOptions|createElement\('iframe'\)|config\.intrusive|adsbygoogle\.push/);
assert.match(runtime, /options\.textContent = `atOptions =/);
assert.match(runtime, /state\.mount\.append\(options, script\)/);
assert.match(runtime, /state\.mount\.append\(script, container\)/);
assert.match(runtime, /30000/); assert.match(runtime, /5000/);
assert.match(runtime, /10000/); assert.match(runtime, /3000/);
assert.match(runtime, /native-no-fill/); assert.match(runtime, /dataAdFallbackReason|dataset\.adFallbackReason/);
assert.match(runtime, /Geometry alone is not a creative/);
assert.match(runtime, /contentDocument/);
assert.match(runtime, /dataset\.adUnitId/);
assert.match(runtime, /dataset\.adFormat/); assert.match(runtime, /dataset\.adCollapseReason/);
assert.doesNotMatch(runtime, /addEventListener\('pointerdown'/);
assert.match(runtime, /used\.has\(key\)/);
assert.match(runtime, /setTimeout\(resize, 150\)/, 'Retire units only after transient viewport measurements settle');
assert.match(runtime, /IntersectionObserver/); assert.match(runtime, /if \(requested/);
const intrusiveRuntime = await read('public_html/assets/ad-intrusive.js');
assert.match(intrusiveRuntime, /publicRouteEligible/);
assert.match(intrusiveRuntime, /GxaAdNetwork\?\.eligible\(\) === true/);
assert.match(intrusiveRuntime, /document\.body\.append\(script\)/);
assert.match(intrusiveRuntime, /gxa-adsterra-/);
assert.doesNotMatch(intrusiveRuntime, /window\.open|location\s*=|addEventListener\(['"](?:click|pointerdown|mousedown|touchstart)/);
for (const viewport of [390, 768, 1440, 1920]) {
  const plan = layout.plan(config, { tool: 'compress-pdf', viewport, inlineWidth: viewport < 768 ? 342 : 1000, leftSpace: 400, rightSpace: 400 });
  const after = plan.find(item => item.zone === 'after-tool');
  assert.ok(after?.fallbackUnit, `${viewport}: Native placement has one fixed fallback`);
  assert.equal(after.fallbackUnit.width, viewport < 768 ? 300 : 320);
}
const expanded = layout.plan(config, { tool: 'compress-pdf', viewport: 1440, inlineWidth: 1020, leftSpace: 64, rightSpace: 324, guideSections: [500, 500, 300, 120] });
assert.deepEqual(expanded.map(item => item.zone), ['top', 'after-tool', 'right', 'content-middle']);
assert.equal(expanded.find(item => item.zone === 'content-middle').unit.width, 468);
const longPage = layout.plan(config, { tool: 'compress-pdf', viewport: 1920, inlineWidth: 1200, leftSpace: 400, rightSpace: 400, guideSections: [500, 1100, 800, 120] });
assert.deepEqual(longPage.map(item => item.zone), ['top', 'after-tool', 'right', 'left', 'content-middle', 'content-lower']);
assert.equal(longPage.find(item => item.zone === 'after-tool').fallbackUnit, null, 'Reserved fixed key is never requested twice');
assert.ok(!layout.plan(config, { tool: 'compress-pdf', viewport: 1920, inlineWidth: 1200, leftSpace: 400, rightSpace: 400, guideSections: [100, 200, 100, 10] }).some(item => item.zone.startsWith('content-')));
const tools = await loadToolRegistry(), quality = await loadToolQuality(), content = await loadContentPageRegistry();
for (const id of config.railTools) assert.ok(tools.some(tool => tool.id === id), `${id}: rail allowlist must reference real registered routes`);
let eligible = 0, denied = 0;
for (const tool of tools) {
  const html = await read(`dist/${tool.id}/index.html`);
  assert.doesNotMatch(html, /bauval\.org|abscloud\.org/, `${tool.id}: no eager Adsterra requests`);
  assert.equal((html.match(/pagead2\.googlesyndication\.com/g) || []).length, AD_NETWORK === 'adsense' && quality[tool.id].adsEligible ? 1 : 0);
  const scripts = (html.match(/src="\/assets\/ad-network.js"/g) || []).length;
  assert.equal((html.match(/src="\/assets\/ad-layout.js"/g) || []).length, AD_NETWORK === 'adsterra' && quality[tool.id].adsEligible ? 1 : 0, `${tool.id}: exactly one shared planner on eligible pages only`);
  assert.equal((html.match(/src="\/assets\/ad-intrusive.js"/g) || []).length, AD_NETWORK === 'adsterra' && quality[tool.id].adsEligible ? 1 : 0, `${tool.id}: exactly one shared provider bootstrap on eligible pages only`);
  if (quality[tool.id].adsEligible) { assert.equal(scripts, AD_NETWORK === 'adsterra' ? 1 : 0, tool.id); eligible++; }
  else { assert.equal(scripts, 0, tool.id); assert.match(html, /noindex/); denied++; }
}
assert.equal(eligible, 81); assert.equal(denied, 14);
for (const file of ['dist/dashboard/index.html', 'dist/admin/index.html', 'dist/404.html']) {
  assert.doesNotMatch(await read(file), /ad-network\.js|ad-intrusive\.js|bauval\.org|abscloud\.org|pagead2\.googlesyndication\.com/);
}
const template = await read('index.html');
for (const network of ['adsterra', 'adsense', 'off']) {
  const html = applyAdNetwork(template, network);
  assert.equal((html.match(/pagead2\.googlesyndication\.com/g) || []).length, network === 'adsense' ? 1 : 0);
  assert.equal((html.match(/src="\/assets\/ad-network.js"/g) || []).length, network === 'adsterra' ? 1 : 0);
  assert.equal((html.match(/src="\/assets\/ad-intrusive.js"/g) || []).length, network === 'adsterra' ? 1 : 0);
  assert.equal(applyAdNetwork(html, network), html, 'Generator selection must be idempotent');
}
assert.equal(await read('dist/ads.txt'), await read('ads.txt'));
const csp = (await read('_headers')).match(/Content-Security-Policy: (.+)/)?.[1];
assert.ok(csp); assert.doesNotMatch(csp, /script-src|connect-src|frame-src/);
console.log(`Adsterra contract passed: ${tools.length} tools, ${eligible} eligible/${denied} denied; seven display units plus once-per-document Popunder and Social Bar bootstraps; Smartlink disabled; three build switches; unchanged ads.txt/CSP. Editorial candidates: ${content.filter(p => ['guide', 'category'].includes(p.kind)).length}.`);
