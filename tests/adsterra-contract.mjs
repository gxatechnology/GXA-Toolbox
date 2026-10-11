import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from '../public_html/assets/ad-config.js';
import { AD_NETWORK, applyAdNetwork } from '../config/ad-network.mjs';
import { loadToolRegistry, loadToolQuality, loadContentPageRegistry } from '../scripts/tool-registry.mjs';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
assert.ok(['adsterra', 'adsense', 'off'].includes(AD_NETWORK));
assert.equal(config.maxPlacements, 1);
assert.equal(config.native.src, 'https://bauval.org/21/b1b26904317d94da1830e1f5dd69d6d9');
assert.equal(config.native.containerId, 'container-b1b26904317d94da1830e1f5dd69d6d9');
assert.equal(config.native.enabled, true);
assert.equal(config.banners.length, 6);
for (const unit of config.banners) {
  assert.equal(unit.enabled, false); assert.equal(unit.src, `https://bauval.org/22/${unit.key}`);
  assert.ok(unit.width > 0 && unit.height > 0);
}
assert.equal(config.intrusive.popunder.enabled, false); assert.equal(config.intrusive.socialBar.enabled, false);
const runtime = await read('public_html/assets/ad-network.js');
assert.doesNotMatch(runtime, /innerHTML|document\.write|atOptions|config\.intrusive|config\.banners|adsbygoogle\.push/);
assert.match(runtime, /IntersectionObserver/); assert.match(runtime, /if \(requested/);
const tools = await loadToolRegistry(), quality = await loadToolQuality(), content = await loadContentPageRegistry();
let eligible = 0, denied = 0;
for (const tool of tools) {
  const html = await read(`dist/${tool.id}/index.html`);
  assert.doesNotMatch(html, /bauval\.org|abscloud\.org/, `${tool.id}: no eager Adsterra requests`);
  assert.equal((html.match(/pagead2\.googlesyndication\.com/g) || []).length, AD_NETWORK === 'adsense' && quality[tool.id].adsEligible ? 1 : 0);
  const scripts = (html.match(/src="\/assets\/ad-network.js"/g) || []).length;
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
console.log(`Adsterra contract passed: ${tools.length} tools, ${eligible} eligible/${denied} denied; one lazy native configuration; six inactive banners; intrusive formats disabled; three build switches; unchanged ads.txt/CSP. Editorial candidates: ${content.filter(p => ['guide', 'category'].includes(p.kind)).length}.`);
