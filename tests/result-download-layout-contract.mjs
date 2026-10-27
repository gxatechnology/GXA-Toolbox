import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [tools, app, styles, adNetwork, adConfig, imageConverter, gpsCamera, pdfEdit] = await Promise.all([
  loadToolRegistry(),
  read('public_html/assets/app.js'),
  read('public_html/assets/style.css'),
  read('public_html/assets/ad-network.js'),
  read('public_html/assets/ad-config.js'),
  read('public_html/assets/image-converter.js'),
  read('public_html/assets/gps-map-camera.js'),
  read('public_html/assets/pdf-edit.js')
]);

assert.equal(tools.length, 95, 'The result audit must cover the complete 95-tool registry.');
const generatorSource = app.match(/const generators = \[([\s\S]*?)\];\s*const routeNormallyNeedsFiles/);
assert.ok(generatorSource, 'Unable to locate the shared generator/file-workflow classification.');
const registered = new Set(tools.map(tool => tool.id));
const directUtilities = new Set([...generatorSource[1].matchAll(/'([^']+)'/g)].map(match => match[1]).filter(id => registered.has(id)));
const fileTools = tools.filter(tool => !directUtilities.has(tool.id));
const exclusions = new Set(['background-remover', 'ppt-to-pdf']);
const updatedTools = fileTools.filter(tool => !exclusions.has(tool.id));
assert.equal(directUtilities.size, 38);
assert.equal(fileTools.length, 57);
assert.equal(updatedTools.length, 55);
assert.equal(updatedTools.length + directUtilities.size + exclusions.size, tools.length);

const standard = app.slice(app.indexOf('<div id="tool-complete-mount"'), app.indexOf('<div id="tool-history-mount"'));
for (const token of ['premium-result-preview', 'premium-result-stats', "renderToolAdPlacementPlaceholder('ad-slot-after-tool')", 'result-download-section', 'btn-download-result']) {
  assert.ok(standard.includes(token), `Shared result flow is missing ${token}.`);
}
const ordered = ['premium-result-preview', 'premium-result-stats', "renderToolAdPlacementPlaceholder('ad-slot-after-tool')", 'result-download-section', 'btn-download-result'];
for (let index = 1; index < ordered.length; index++) {
  assert.ok(standard.indexOf(ordered[index - 1]) < standard.indexOf(ordered[index]), `${ordered[index - 1]} must precede ${ordered[index]}.`);
}

const crop = app.slice(app.indexOf('id="crop-result-panel"'), app.indexOf('function updateCropCanvasSize'));
assert.ok(crop.indexOf('crop-result-meta') < crop.indexOf("renderToolAdPlacementPlaceholder('ad-slot-after-tool')"));
assert.ok(crop.indexOf("renderToolAdPlacementPlaceholder('ad-slot-after-tool')") < crop.indexOf('result-download-section'));
assert.ok(crop.indexOf('result-download-section') < crop.indexOf('crop-download-button'));
assert.doesNotMatch(app, /id="(?:btn-mobile-download-result|crop-mobile-download-button)"/);
assert.doesNotMatch(styles, /\.(?:premium-mobile-result-action|crop-mobile-result-action)/);

for (const [name, source, downloadToken] of [
  ['Image Converter', imageConverter, 'image-converter__download'],
  ['GPS Map Camera', gpsCamera, 'gps-studio__download'],
  ['Edit PDF', pdfEdit, 'data-action="download"']
]) {
  assert.match(source, /GxaResultFlow\?\.renderAdPlacement/);
  assert.ok(source.indexOf('GxaResultFlow?.renderAdPlacement') < source.indexOf('result-download-section'), `${name}: ad must precede download section.`);
  assert.ok(source.indexOf('result-download-section') < source.indexOf(downloadToken), `${name}: download must belong to its labeled section.`);
}
assert.match(pdfEdit, /setAttribute\('data-result-ready', 'true'\)/);
assert.match(pdfEdit, /\.result-download-section'\)\.hidden = false/);

assert.match(app, /window\.GxaResultFlow = Object\.freeze/);
assert.match(adNetwork, /const resultReady = state/);
assert.match(adNetwork, /data-result-ready="true"/);
assert.match(adNetwork, /!resultReady\(state\)/);
assert.match(adConfig, /popunder:[\s\S]*enabled:\s*false/);
assert.match(adConfig, /socialBar:[\s\S]*enabled:\s*true/);
assert.doesNotMatch(adNetwork, /abscloud\.org/);
assert.match(app, /recordToolAnalytics\('tool_download'/);

console.log(`Result/download layout contract passed: ${tools.length} audited, ${updatedTools.length} result workflows updated, ${directUtilities.size + exclusions.size} intentionally excluded.`);
