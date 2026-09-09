import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { canonicalToolUrl, loadToolContentRegistry, loadToolRegistry } from '../scripts/tool-registry.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, ui, core, css, template, phaseOne, tools, content, sitemap, routeHtml, documentation] = await Promise.all([
  read('public_html/assets/app.js'), read('public_html/assets/image-converter.js'), read('public_html/assets/image-converter-core.js'), read('public_html/assets/image-converter.css'), read('index.html'), read('public_html/assets/phase-one-studios.js'), loadToolRegistry(), loadToolContentRegistry(), read('dist/sitemap.xml'), read('dist/image-converter/index.html'), read('docs/IMAGE_CONVERTER.md')
]);

assert.equal(tools.length, 95, 'Image Converter must remain registered with the existing tools and GPS Map Camera.');
const entries = tools.filter(tool => tool.id === 'image-converter');
assert.equal(entries.length, 1);
assert.equal(entries[0].category, 'image');
assert.equal(canonicalToolUrl(entries[0].id), 'https://gxatoolbox.in/image-converter/');
assert.equal(tools.filter(tool => tool.category === 'pdf').length, 23, 'All 23 PDF routes must remain registered.');
assert.deepEqual(new Set(content['image-converter'].relatedTools).size, content['image-converter'].relatedTools.length);
for (const id of content['image-converter'].relatedTools) assert.ok(tools.some(tool => tool.id === id), `Unknown related tool: ${id}`);

const integrationStart = app.indexOf('async function renderImageConverterPage');
const integrationEnd = app.indexOf('// --- FAQs lookup', integrationStart);
assert.ok(integrationStart >= 0 && integrationEnd > integrationStart);
const integration = app.slice(integrationStart, integrationEnd);
for (const module of ['image-converter-core.js', 'image-converter.js']) {
  assert.match(integration, new RegExp(`loadScriptOnce\\(\\s*['"]/assets/${module.replaceAll('.', '\\.')}['"]`));
  assert.equal(template.includes(`/assets/${module}`), false, `${module} must stay route-lazy.`);
}
assert.match(integration, /image-converter\.css/);
assert.match(integration, /renderToolContentSections\(tool\.id\)/);
assert.match(integration, /recordToolAnalytics\(event, \{ status \}\)/);
assert.match(integration, /logHistory\('converted-image', 'Image Converter'/);
assert.doesNotMatch(integration, /logHistory\([^\n]*(?:file\.name|filename|sourceName)/);
assert.match(app, /previousPage === 'tool-image-converter'[^\n]*GxaImageConverter\?\.dispose/);
assert.match(phaseOne, /'image-converter': 'preview-heavy-image-converter'/);
assert.doesNotMatch(phaseOne, /createModeRail|studio-mode-button|window\.navigate/);

assert.doesNotMatch(ui + core, /\b(?:localStorage|sessionStorage|indexedDB|XMLHttpRequest)\b|\b(?:fetch|sendBeacon)\s*\(/, 'Image bytes and metadata must not be persisted or uploaded.');
for (const event of ['tool_start', 'tool_complete', 'tool_fail', 'tool_download']) assert.ok(ui.includes(`'${event}'`), `Missing lifecycle event ${event}.`);
assert.doesNotMatch(ui, /onEvent\?\.\([^\n]*(?:file\.name|filename|metadata|rgba)/i);
assert.match(ui, /imageOrientation: 'from-image'/);
assert.match(ui, /maximumTotalPixels: 24_000_000/);
assert.match(core, /MAX_PIXELS = 25_000_000/);
assert.match(core, /<!DOCTYPE\|<!ENTITY/);
assert.match(core, /SVG element <\$\{element\.localName\}> is not allowed/);

const advertisedInputs = content['image-converter'].supportedFormats.input.join(' ');
for (const format of ['JPEG', 'PNG', 'WebP', 'GIF', 'BMP', 'TIFF', 'ICO', 'SVG', 'AVIF']) assert.match(advertisedInputs, new RegExp(format, 'i'));
for (const format of ['HEIC', 'RAW', 'PSD', 'EXR', 'JPEG 2000', 'JPEG XL']) assert.doesNotMatch(advertisedInputs, new RegExp(format, 'i'), `${format} must not be advertised as a supported input.`);
const limitations = content['image-converter'].limitations.join(' ');
for (const boundary of ['HEIC/HEIF', 'Camera RAW', 'PSD/PSB', 'EXR/HDR', 'JPEG 2000', 'JPEG XL', 'first[- ]frame', 'EXIF']) assert.match(limitations, new RegExp(boundary, 'i'));
assert.match(content['image-converter'].privacy.description, /filename[\s\S]*not uploaded/i);

assert.equal((sitemap.match(/https:\/\/gxatoolbox\.in\/image-converter\//g) || []).length, 1);
assert.match(routeHtml, /<title>[^<]*Image Converter[^<]*<\/title>/);
assert.match(routeHtml, /<link rel="canonical" href="https:\/\/gxatoolbox\.in\/image-converter\/">/);
assert.match(routeHtml, /<h1[^>]*>Image Converter<\/h1>/);
assert.match(routeHtml, /"@type": "FAQPage"/);
assert.match(routeHtml, /Supported Inputs and Outputs/);
for (const asset of ['dist/assets/image-converter-core.js', 'dist/assets/image-converter.js', 'dist/assets/image-converter.css']) assert.ok((await stat(new URL(`../${asset}`, import.meta.url))).size > 500, `${asset} was not copied to the production build.`);
assert.match(css, /@media \(max-width: 600px\)/);
assert.match(css, /box-sizing: border-box/);
assert.match(documentation, /No HEIC\/HEIF, RAW, PSD\/PSB, HDR\/EXR, JP2, or JXL decoder is claimed/i);

const routeStart = app.indexOf('function normalizeRoutePath');
const routeEnd = app.indexOf('function disposeRouteEditors', routeStart);
const routing = vm.createContext({ window: { location: { pathname: '/image-converter/', hash: '', search: '' } }, toolsList: tools, contentPages: [], NOT_FOUND_PAGE: 'not-found', appState: {}, history: { replaceState() {} } });
vm.runInContext(app.slice(routeStart, routeEnd), routing);
for (const pathname of ['/image-converter/', '/image-converter', '/IMAGE-CONVERTER/']) { routing.window.location.pathname = pathname; assert.equal(routing.pageIdFromLocation(), 'tool-image-converter'); assert.equal(routing.pathForPage('tool-image-converter'), '/image-converter/'); }

console.log('Image Converter contract passed: 95 tools, route-lazy assets, honest format content, private lifecycle analytics, SEO route/sitemap, secure boundaries, navigation, and production asset generation.');
