import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from '../public_html/assets/ad-config.js';
import layout from '../public_html/assets/ad-layout.js';
import { AD_NETWORK, applyAdNetwork } from '../config/ad-network.mjs';
import { loadToolRegistry, loadToolQuality, loadContentPageRegistry } from '../scripts/tool-registry.mjs';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
assert.ok(['adsterra', 'adsense', 'off'].includes(AD_NETWORK));
assert.equal(config.maxPlacements, 4);
assert.equal(config.interstitial.enabled, false);
for (const tool of ['edit-pdf', 'crop-image', 'organize-pdf', 'background-remover', 'gps-map-camera']) assert.ok(!config.railTools.includes(tool));
for (const viewport of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1600, 1920]) {
  for (const tool of ['compress-pdf', 'edit-pdf', 'future-unknown-editor']) {
    const plan = layout.plan(config, { tool, viewport, inlineWidth: viewport - 48, leftSpace: 360, rightSpace: 360 });
    assert.ok(plan.length <= (viewport < 768 ? 2 : tool === 'compress-pdf' ? 4 : 3));
    assert.equal(new Set(plan.map(item => item.unit.key || item.unit.containerId)).size, plan.length);
    assert.ok(plan.filter(item => item.unit.key).every(item => item.unit.width <= viewport - 48));
    if (viewport < 1280 || tool !== 'compress-pdf') assert.ok(!plan.some(item => ['left', 'right'].includes(item.zone)));
    if (viewport < 1600) assert.ok(!plan.some(item => item.zone === 'left'));
    if (viewport >= 768 && viewport < 1280) { assert.ok(plan.length <= 3); assert.equal(plan.find(item => item.zone === 'top')?.unit.width, 468); }
    const right = plan.find(item => item.zone === 'right');
    if (right) assert.deepEqual([right.unit.width, right.unit.height], [300, 250]);
    assert.ok(plan.filter(item => item.unit.width === 160).length <= 1);
  }
}
assert.deepEqual(layout.plan({ ...config, network: 'off' }, { tool: 'compress-pdf', viewport: 1920, inlineWidth: 1200 }), []);
assert.ok(!layout.plan(config, { tool: 'compress-pdf', viewport: 1920, inlineWidth: 1200, leftSpace: 180, rightSpace: 180 }).some(item => ['left', 'right'].includes(item.zone)));
assert.equal(config.native.src, 'https://bauval.org/21/b1b26904317d94da1830e1f5dd69d6d9');
assert.equal(config.native.containerId, 'container-b1b26904317d94da1830e1f5dd69d6d9');
assert.equal(config.native.enabled, true);
assert.equal(config.banners.length, 6);
for (const unit of config.banners) {
  assert.equal(unit.enabled, true); assert.equal(unit.src, `https://bauval.org/22/${unit.key}`);
  assert.ok(unit.width > 0 && unit.height > 0);
}
assert.equal(config.intrusive.popunder.enabled, false); assert.equal(config.intrusive.socialBar.enabled, false);
assert.equal(config.intrusive.popunder.maxPerSession, 1);
assert.equal(config.intrusive.popunder.minimumIntervalMinutes, 30);
assert.deepEqual(config.intrusive.socialBar.approvedRoutes, []);
assert.deepEqual(config.intrusive.popunder.approvedRoutes, []);
for (const unit of config.banners) {
  const disabled = { ...config, banners: config.banners.map(item => ({ ...item, enabled: item.key !== unit.key })) };
  for (const viewport of [390, 1024, 1600, 1800, 1920, 2400]) {
    assert.ok(!layout.plan(disabled, { tool: 'compress-image', viewport, inlineWidth: viewport - 48, leftSpace: 400, rightSpace: 400 }).some(item => item.unit.key === unit.key));
  }
}
assert.deepEqual(layout.plan({ ...config, native: { ...config.native, enabled: false }, banners: config.banners.map(item => ({ ...item, enabled: false })) }, { tool: 'compress-image', viewport: 1920, inlineWidth: 1280, leftSpace: 400, rightSpace: 400 }), []);
const runtime = await read('public_html/assets/ad-network.js');
assert.doesNotMatch(runtime, /innerHTML|document\.write|config\.intrusive|adsbygoogle\.push/);
assert.match(runtime, /frame\.contentWindow\.atOptions/);
assert.match(runtime, /used\.has\(key\)/);
assert.match(runtime, /setTimeout\(resize, 150\)/, 'Retire units only after transient viewport measurements settle');
assert.match(runtime, /IntersectionObserver/); assert.match(runtime, /if \(requested/);
const tools = await loadToolRegistry(), quality = await loadToolQuality(), content = await loadContentPageRegistry();
for (const id of config.railTools) assert.ok(tools.some(tool => tool.id === id), `${id}: rail allowlist must reference real registered routes`);
let eligible = 0, denied = 0;
for (const tool of tools) {
  const html = await read(`dist/${tool.id}/index.html`);
  assert.doesNotMatch(html, /bauval\.org|abscloud\.org/, `${tool.id}: no eager Adsterra requests`);
  assert.equal((html.match(/pagead2\.googlesyndication\.com/g) || []).length, AD_NETWORK === 'adsense' && quality[tool.id].adsEligible ? 1 : 0);
  const scripts = (html.match(/src="\/assets\/ad-network.js"/g) || []).length;
  assert.equal((html.match(/src="\/assets\/ad-layout.js"/g) || []).length, AD_NETWORK === 'adsterra' && quality[tool.id].adsEligible ? 1 : 0, `${tool.id}: exactly one shared planner on eligible pages only`);
  if (quality[tool.id].adsEligible) { assert.equal(scripts, AD_NETWORK === 'adsterra' ? 1 : 0, tool.id); eligible++; }
  else { assert.equal(scripts, 0, tool.id); assert.match(html, /noindex/); denied++; }
}
assert.equal(eligible, 81); assert.equal(denied, 14);
for (const file of ['dist/dashboard/index.html', 'dist/admin/index.html', 'dist/404.html']) {
  assert.doesNotMatch(await read(file), /ad-network\.js|bauval\.org|abscloud\.org|pagead2\.googlesyndication\.com/);
}
const template = await read('index.html');
for (const network of ['adsterra', 'adsense', 'off']) {
  const html = applyAdNetwork(template, network);
  assert.equal((html.match(/pagead2\.googlesyndication\.com/g) || []).length, network === 'adsense' ? 1 : 0);
  assert.equal((html.match(/src="\/assets\/ad-network.js"/g) || []).length, network === 'adsterra' ? 1 : 0);
  assert.equal(applyAdNetwork(html, network), html, 'Generator selection must be idempotent');
}
assert.equal(await read('dist/ads.txt'), await read('ads.txt'));
const csp = (await read('_headers')).match(/Content-Security-Policy: (.+)/)?.[1];
assert.ok(csp); assert.doesNotMatch(csp, /script-src|connect-src|frame-src/);
console.log(`Adsterra contract passed: ${tools.length} tools, ${eligible} eligible/${denied} denied; deterministic multi-zone density/width/exclusion contracts; one native ID; six approved banners; intrusive formats disabled; three build switches; unchanged ads.txt/CSP. Editorial candidates: ${content.filter(p => ['guide', 'category'].includes(p.kind)).length}.`);
