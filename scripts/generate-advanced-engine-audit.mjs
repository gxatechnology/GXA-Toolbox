import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { loadToolRegistry, loadToolContentRegistry } from './tool-registry.mjs';

// Run only after the listed suites. This collects evidence, not synthetic passes.
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const tools = await loadToolRegistry(), content = await loadToolContentRegistry();
assert.equal(tools.length, 95);
const oldAudit = await readFile('docs/TOOL_ENGINE_AUDIT.md', 'utf8');
const old = Object.fromEntries(oldAudit.split('\n').map(line => line.split('|').map(x => x.trim()))
  .filter(cells => cells.length > 15 && /^`[a-z0-9-]+`$/.test(cells[3]))
  .map(cells => [cells[3].replaceAll('`', ''), cells]));
const evidence = Object.fromEntries(tools.map(tool => [tool.id, []]));
const add = (id, path, scope) => { if (evidence[id]) evidence[id].push({ path, scope }); };
const unit = await json('test-results/advanced-engine/unit-results.json');
for (const r of unit.evidence.filter(x => x.passed)) add(r.id, 'test-results/advanced-engine/unit-results.json', r.name + ' (engine VM, not full UI)');
const browser = await json('test-results/advanced-engine/browser-results.json');
assert.equal(browser.failures.length, 0);
for (const r of browser.workflows.filter(x => x.passed)) add(r.id, 'test-results/advanced-engine/browser-results.json', r.evidence);
const ocr = await json('test-results/advanced-engine/ocr-results.json');
assert.equal(ocr.errors.length, 0);
for (const r of ocr.rows) add(r.id, 'test-results/advanced-engine/ocr-results.json', r.evidence || `${r.mode}: WER ${r.wordErrorRate} on one English synthetic fixture`);
const conversions = await json('test-results/tool-functionality-phase4a/conversions/results.json');
assert.ok(conversions.every(x => x.passed));
for (const r of conversions) add(r.id, 'test-results/tool-functionality-phase4a/conversions/results.json', 'Actual browser conversion + independent output parsing; not complete UI/fidelity QA');
const remaining = await json('test-results/advanced-engine/remaining-results.json');
assert.equal(remaining.errors.length, 0);
for (const r of remaining.rows.filter(x => x.passed)) add(r.id, 'test-results/advanced-engine/remaining-results.json', r.scope);
const routeSmoke = await json('test-results/tool-functionality-phase4a/browser-results.json');
const ux = await json('test-results/ux-phase3/results.json');
for (const r of ux.rows) add(r.id, 'test-results/ux-phase3/results.json', r.flow + '; downloads independently checked by download-output.mjs');
const calendar = await json('test-results/tool-functionality-phase4a/calendar-text/results.json');
assert.equal(calendar.failures.length, 0);
for (const r of calendar.results) add(r.route, 'test-results/tool-functionality-phase4a/calendar-text/results.json', `${r.timezoneId}: ${r.result}`);
for (const [id, path] of [
  ['edit-pdf', 'test-results/edit-pdf-advanced/results.json'],
  ['merge-pdf', 'test-results/merge-pdf-advanced/results.json'],
  ['split-pdf', 'test-results/pdf-page-tools-advanced/results.json'],
  ['organize-pdf', 'test-results/pdf-page-tools-advanced/results.json']
]) {
  const r = await json(path); assert.equal(r.failures.length, 0, path);
  add(id, path, 'Actual browser file processing/download/reopen and populated responsive checks; see individual checks');
}
const background = await json('test-results/tool-functionality-phase4a/background-results.json');
assert.equal(background.status, 'passed');
add('background-remover', 'test-results/tool-functionality-phase4a/background-results.json', 'Real existing local WASM inference, transparency and full-resolution PNG export; one photograph');

// These executed suites assert production functions and real output. They do not
// persist per-tool JSON, so the test source is the reproducible evidence pointer.
const groups = [
  ['tests/tool-functionality-phase4a/calculators-archives.mjs', 'Known-value arithmetic, invalid inputs and ZIP contents in Node/JSDOM; not all UI flows', 'calculator scientific-calculator percentage-calculator age-calculator date-calculator emi-calculator loan-calculator interest-calculator gst-calculator sip-calculator bmi-calculator discount-calculator unit-converter currency-converter time-calculator timestamp-converter zip-manager'],
  ['tests/tool-functionality-phase4a/text-utilities.mjs', 'Real production text functions against independent byte/value expectations in JSDOM', 'base64-tool url-tool json-tool uuid-generator password-generator hash-tool diff-checker markdown-editor'],
  ['tests/tool-functionality-phase4a/pdf-output.mjs', 'Actual PDF output reopened; page dimensions/operators/content checked; not full UI', 'merge-pdf organize-pdf split-pdf rotate-pdf crop-pdf remove-pdf-pages extract-pdf-pages pdf-metadata pagenumber-pdf header-footer-pdf watermark-pdf sign-pdf repair-pdf txt-to-pdf'],
  ['tests/compress-pdf-contract.mjs', 'Real qpdf WASM output, byte savings, corrupt and encrypted rejection', 'compress-pdf'],
  ['tests/ppt-to-pdf-contract.mjs', 'Actual limited PPTX rendering, color operators, overflow/unsupported Unicode rejection', 'ppt-to-pdf'],
  ['tests/adsense-phase2-browser.mjs', 'Real HTML export and QR/Code128 encode/decode fixtures; native BarcodeDetector unavailable, real ZXing fallback tested', 'html-to-pdf barcode-generator qr-reader barcode-reader'],
  ['tests/image-converter-browser.mjs', '16 actual conversions, signatures, independent decoder reopen, alpha, unsupported inputs, responsive widths', 'image-converter'],
  ['tests/gps-map-camera-browser.mjs', 'Client export and EXIF reopened; geolocation/camera/provider responses are test doubles, not live-service verification', 'gps-map-camera']
];
for (const [path, scope, ids] of groups) for (const id of ids.split(' ')) add(id, path, scope);
const upgrades = {
  'js-beautifier': ['Regex rewriting', 'Prettier 3.9.10 Babel/Estree in disposable worker', 'MIT'],
  'css-beautifier': ['Regex rewriting', 'Prettier 3.9.10 PostCSS in disposable worker', 'MIT'],
  'html-beautifier': ['Regex rewriting', 'Prettier 3.9.10 HTML + embedded-language parsers in worker', 'MIT'],
  'sql-formatter': ['Regex keyword/whitespace rewriting', 'sql-formatter 15.9.0 SQL dialect in worker', 'MIT'],
  'png-to-svg': ['PNG embedded inside SVG', 'ImageTracer.js 1.2.6; real BW/16-color paths in worker', 'Unlicense'],
  'regex-tester': ['Main-thread RegExp loop', 'Bounded worker RegExp, Unicode-safe empty matches, timeout and cancellation', 'Project code + browser API'],
  'xml-to-json': ['Text-centric recursive DOM conversion', 'Bounded DOMParser, attributes/CDATA/ordered mixed content, null-prototype objects', 'Project code + browser API'],
  'zip-extractor': ['JSZip CRC extraction', 'Central-directory preflight plus existing JSZip CRC extraction', 'JSZip MIT option + project code'],
  'image-ocr': ['Local English Tesseract OCR', 'Existing Tesseract LSTM/WASM + contrast/adaptive worker, manual rotation, five languages', 'Apache-2.0; language-package wrapper MIT'],
  'ocr-pdf': ['Local English OCR transcript only', 'Existing Tesseract + PDF.js + pdf-lib; optional rasterized searchable PDF, preprocessing and five languages', 'Apache-2.0 / MIT'],
  'color-extractor': ['RGB bucket rounding could overflow 255; no decode rejection', 'Alpha-weighted real-channel clusters, bounded aspect-preserving sample, decode errors and cleanup', 'Project code + browser API'],
  'cron-generator': ['Five-field count only', 'Bounded numeric/named-field validation, ranges/lists/steps and Unix day semantics notice', 'Project code'],
  'lorem-ipsum': ['Unbounded paragraph count', 'Validated 1–100 paragraph generation with safe failed-state download', 'Project code'],
  'diff-checker': ['Unbounded line-index comparison', 'Same line-index semantics, bounded 5,000 lines / 1M total characters', 'Project code'],
  'ppt-to-pdf': ['Existing limited JSZip/OOXML + pdf-lib renderer', 'Same limited renderer; corrected color matching and reject Unicode/overflow instead of loss', 'JSZip MIT option / pdf-lib MIT']
};
const sharedPdf = new Set('pdf-to-jpg pdf-to-image pdf-to-png pdf-to-text pdf-to-word pdf-to-html pdf-to-markdown pdf-to-epub pdf-to-excel pdf-to-ppt'.split(' '));
const engineOverrides = {
  'qr-reader': 'BarcodeDetector where available; local ZXing fallback',
  'barcode-reader': 'BarcodeDetector where available; local ZXing fallback',
  'image-converter': 'Existing byte-sniffed Canvas + bounded BMP/TIFF/ICO codecs',
  'gps-map-camera': 'Existing Canvas stamp + JPEG EXIF; optional Netlify/Geoapify location/map service',
  'edit-pdf': 'Existing PDF.js + pdf-lib, native text core and visual overlays'
};
const licenseFor = engine => [
  /pdf-lib/i.test(engine) && 'pdf-lib MIT', /PDF\.js/i.test(engine) && 'PDF.js Apache-2.0',
  /JSZip/i.test(engine) && 'JSZip MIT option', /qpdf/i.test(engine) && 'qpdf Apache-2.0; wrapper ISC',
  /Mammoth/i.test(engine) && 'Mammoth BSD-2-Clause', /SheetJS/i.test(engine) && 'SheetJS Apache-2.0',
  /Tesseract/i.test(engine) && 'Tesseract Apache-2.0', /ONNX/i.test(engine) && 'ONNX runtime MIT',
  /ZXing/i.test(engine) && 'ZXing Apache-2.0', /gifenc/i.test(engine) && 'gifenc MIT'
].filter(Boolean).join('; ') || 'Retained project/browser engine; dependency details in TOOL_ENGINE_AUDIT.md';
const axes = ['normalInput', 'edgeInput', 'invalidInput', 'emptyInput', 'largeInput', 'multipleFormats', 'outputCorrectness', 'visualFidelity', 'download', 'mobileInteraction', 'errorHandling', 'cancellationRetry', 'performanceMemory', 'privacySecurity', 'crossBrowser'];
const inventory = tools.map(tool => {
  assert.ok(old[tool.id], `Missing historical engine inventory: ${tool.id}`);
  const upgrade = upgrades[tool.id];
  const engine = upgrade?.[1] || engineOverrides[tool.id] || old[tool.id][6];
  const route = routeSmoke.rows?.find(row => row.id === tool.id);
  const limitations = [...content[tool.id].limitations];
  if (tool.id === 'zip-extractor') limitations.push('Metadata preflight cannot prove safety against falsified directory sizes; bounded streaming inflation still required.');
  if (tool.id === 'image-ocr' || tool.id === 'ocr-pdf') limitations.push('Multilingual accuracy, deskew, denoise, handwriting, complex layout and physical devices NOT TESTED; no automatic deskew or denoise added.');
  if (tool.id === 'diff-checker') limitations.push('Compares matching line indexes; not a Myers/LCS insertion-aligned diff.');
  if (tool.id === 'text-to-speech') limitations.push('Audible output NOT TESTED; OS/browser voices may use network services. No new service added, no absolute offline/privacy guarantee.');
  if (tool.id === 'case-converter') limitations.push('Camel/kebab modes remain ASCII-oriented and may lose non-Latin letters.');
  if (tool.id === 'word-counter') limitations.push('Whitespace word counts and punctuation sentence counts are heuristics; unpunctuated final sentences/complex scripts need improvement.');
  const status = evidence[tool.id].length ? 'VERIFIED WITH LIMITATIONS' : 'NOT TESTED';
  return {
    id: tool.id, name: tool.name, route: `/${tool.id}/`, category: tool.category,
    previousEngine: upgrade?.[0] || engineOverrides[tool.id] || old[tool.id][6],
    upgradedEngine: engine, engineChanged: !!upgrade, sharedPipelineChanged: sharedPdf.has(tool.id),
    license: upgrade?.[2] || licenseFor(engine), formats: content[tool.id].supportedFormats,
    evidence: evidence[tool.id], functionalScore: null, outputFidelityScore: null,
    scoringNote: 'No calibrated scoring rubric/reference corpus; not inventing /10 scores.',
    performance: remaining.rows.find(row => row.id === tool.id)?.ms ?? unit.evidence.find(row => row.id === tool.id && row.passed)?.ms ?? null,
    performanceScope: 'Fixture/suite elapsed time where supplied; not production throughput or peak-memory measurement.',
    mobile: route?.widths || 'See 95-route smoke artifact; populated workflow checks listed in evidence',
    security: 'Targeted regression evidence only; not a penetration-test certification. Ads/APIs blocked in local browser tests.',
    limitations, finalStatus: status,
    testMatrix: {
      ...Object.fromEntries(axes.map(axis => [axis, 'NOT FULLY VERIFIED — see scoped evidence; no blanket pass'])),
      normalInput: evidence[tool.id].length ? 'SCOPED PASS in the listed fixture/engine tests; not every workflow' : 'NOT TESTED',
      mobileRouteLayout: route?.widths?.length ? `PASS route-only overflow checks at ${route.widths.join(', ')}px; interaction QA separate` : 'NOT TESTED',
      crossBrowser: 'Firefox/WebKit and physical devices NOT TESTED'
    },
    crossBrowser: { chromium: evidence[tool.id].length ? 'Scoped evidence only' : 'Route only', firefox: 'NOT TESTED: no binary', webkit: 'NOT TESTED: no binary', physicalAndroidIos: 'NOT TESTED' }
  };
});
const counts = Object.fromEntries(['FULLY VERIFIED', 'VERIFIED WITH LIMITATIONS', 'FAILED', 'BLOCKED', 'NOT TESTED'].map(status => [status, inventory.filter(row => row.finalStatus === status).length]));
const bundle = [];
for (const folder of ['prettier', 'sql-formatter', 'imagetracer']) for (const file of await readdir(`dist/assets/vendor/${folder}`)) {
  const path = `dist/assets/vendor/${folder}/${file}`, bytes = await readFile(path);
  bundle.push({ path, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
}
const sourceChanges = [
  'package.json', 'package-lock.json', 'scripts/copy-engine-vendors.mjs', 'scripts/generate-seo-site.mjs', 'scripts/generate-advanced-engine-audit.mjs',
  'public_html/assets/app.js', 'public_html/assets/tool-workspace.js', 'public_html/assets/pptx-to-pdf.js', 'public_html/assets/engine-worker.js', 'public_html/assets/engine-jobs.js', 'public_html/assets/archive-safety.mjs', 'public_html/assets/ocr-tools.js', 'public_html/assets/tool-content.js', 'public_html/assets/editorial-pages.js',
  'tests/advanced-engine-upgrades.mjs', 'tests/advanced-engine-browser.mjs', 'tests/ocr-engine-browser.mjs', 'tests/remaining-engine-browser.mjs', 'tests/adsense-phase2.mjs', 'tests/ppt-to-pdf-contract.mjs', 'tests/tool-functionality-phase4a/conversion-browser.mjs', 'tests/edit-pdf-advanced-browser.mjs', 'tests/pdf-page-tools-advanced-browser.mjs',
  'docs/GXA_95_TOOL_ADVANCED_ENGINE_FINAL_AUDIT.md', 'docs/GXA_95_TOOL_ADVANCED_ENGINE_FINAL_AUDIT.json'
];
const validation = await json('test-results/advanced-engine/commands.json');
const report = { generatedAt: new Date().toISOString(), registeredTools: tools.length, counts, inventory, validation, sourceChanges, bundle, newWasmAssets: [],
  benchmarks: unit.evidence.filter(row => row.benchmark || row.metric), ocrMeasurements: ocr, backgroundMeasurement: background,
  scope: '95 explicit inventories/statuses, NOT 95 fully certified workflows. Synthetic samples; no universal fidelity guarantee. Existing dirty changes retained; no release or production writes.' };
const escape = value => String(value ?? 'Not measured').replaceAll('|', '\\|').replaceAll('\n', ' ');
const lines = [
  '# GXA Toolbox — 95-tool advanced engine audit', '', `Generated: ${report.generatedAt}`, '',
  '## Readiness and evidence limits', '',
  '**Local implementation and scoped regression evidence; NOT a 100% quality certification or production release approval.** All 95 routes have an explicit row. A passing unit/engine fixture is recorded as VERIFIED WITH LIMITATIONS, never FULLY VERIFIED. A route loading is not counted as output verification. Numeric /10 scores are intentionally unassigned without a calibrated reference corpus.', '',
  ...Object.entries(counts).map(([status, count]) => `- ${status}: ${count}`), '',
  'No production DB, auth provider, advertising account, deployment, Git commit or push was performed. The original tree already contains substantial unrelated changes. This report does not approve those changes for release.', '',
  '## Implemented changes', '',
  ...Object.entries(upgrades).map(([id, [before, after]]) => `- ${id}: ${before} → ${after}.`),
  '- Shared PDF render/text helpers: bounded output pages/pixels/text, deterministic row sort, page/canvas/document cleanup on success and rejection. Existing renderer/codec retained.',
  '- User-approved existing local OCR LSTM engine retained. No new hosted inference, cloud file conversion, paid API, or neural architecture was introduced. Optional language packs still require initial CDN asset access; document/image bytes remain browser-side in these workflows.',
  '- Formatter assets are served locally and loaded only in workers when needed. Cancellation terminates the worker; malformed input produces an error instead of corrupt output.', '',
  '- Corrected PNG-to-SVG visible success text and its short registry description because the previous raster-wrapper description no longer described the implemented engine. Route, title, canonical, sitemap policy and all unrelated metadata remain unchanged.', '',
  '## Validation actually executed', '',
  '| Command / suite | Result | Scope |', '|---|---|---|',
  ...validation.map(row => `| ${escape(row.command)} | ${escape(row.result)} | ${escape(row.scope)} |`), '',
  'Initial advanced-PDF browser failures were test lifecycle assumptions: Download now follows Preview, editing resumes through Back, and failed/resized ad slots are retained as no-fill tombstones. Tests were updated to operate the existing UI and distinguish visible ad density; no ad code or editor logic was changed in this engine pass.', '',
  '## Benchmark observations (not broad speed claims)', '',
  ...report.benchmarks.map(row => `- ${JSON.stringify(row)}`),
  ...ocr.rows.map(row => `- OCR: ${JSON.stringify(row)}`),
  `- Existing Background Remover: ${JSON.stringify(background.metrics)}. One photograph only, no before/after speed claim.`,
  '- OCR runs share dependency/cache state; their elapsed times are not controlled comparisons of preprocessing speed. Zero WER on one clear synthetic English fixture does not establish real-document or multilingual accuracy.', '',
  '## Dependency and payload review', '',
  '- Prettier 3.9.10: MIT, browser standalone plus explicit parsers. Commercial use permitted with license notice. [Official browser documentation](https://prettier.io/docs/browser).',
  '- sql-formatter 15.9.0: MIT, browser UMD, generic SQL dialect chosen; not SQL execution or semantic validation, no stored-procedure fidelity promise. [Official repository](https://github.com/sql-formatter-org/sql-formatter).',
  '- ImageTracer.js 1.2.6: Unlicense, real JS path tracing, older/sparsely maintained release (npm modification metadata 2022); bounded worker and deterministic simple-image tests mitigate but do not eliminate parser/performance risks. [Official repository](https://github.com/jankovicsandras/imagetracerjs).',
  '- All three licenses inspected locally and shipped beside browser assets. No new GPL/AGPL dependency. No server required. No new WASM binary. Local npm install used exact versions and disabled lifecycle scripts.',
  '- Existing Tesseract runtime Apache-2.0; pinned @tesseract.js-data language wrappers MIT, upstream tessdata Apache-2.0. Five language choices; multilingual accuracy not benchmarked. [Upstream language-data documentation](https://github.com/naptha/tessdata/blob/gh-pages/README.md).',
  '- npm audit reported 8 existing advisories (2 moderate, 6 high): @vitest/mocker, brace-expansion, js-yaml, source-map-js, undici, vite, vitest, zod. None identified in the three new dependencies at the check time. No automatic broad dependency upgrade performed; separate security review remains required.', '',
  '| Added deployed asset | Bytes | Gzip bytes |', '|---|---:|---:|', ...bundle.map(row => `| ${row.path} | ${row.bytes} | ${row.gzipBytes} |`), '',
  `Total additional vendor files: ${bundle.reduce((sum, row) => sum + row.bytes, 0)} bytes; gzip sum ${bundle.reduce((sum, row) => sum + row.gzipBytes, 0)} bytes. Not loaded on homepage. New shared modules are route-lazy; existing app.js remains a shared asset.`, '',
  '## Per-tool inventory', '',
  'Mobile column refers to route-overflow smoke unless workflow evidence explicitly says otherwise. Performance values are fixture/suite elapsed milliseconds, not standardized tool latency. Formats and detailed evidence/matrix are also recorded in the companion JSON. Earlier TOOL_ENGINE_AUDIT.md classifications are historical and are not reused as passed-test claims.', '',
  '| Tool ID | Tool Name | Route | Previous Engine | Upgraded/Retained Engine | License | Test Evidence | Functional /10 | Fidelity /10 | Performance | Mobile | Security | Remaining Limitations | Final Status |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...inventory.map(row => '| ' + [row.id, row.name, row.route, row.previousEngine, row.upgradedEngine, row.license, row.evidence.map(x => `${x.path}: ${x.scope}`).join('; ') || 'Route smoke only', 'Not scored', 'Not scored', row.performance == null ? 'Not profiled' : `${row.performance.toFixed(2)} ms (scoped)`, Array.isArray(row.mobile) ? row.mobile.join(', ') + 'px route smoke' : row.mobile, 'Targeted tests only; see evidence', row.limitations.join(' '), row.finalStatus].map(escape).join(' | ') + ' |'), '',
  '## Remaining improvement roadmap', '',
  '1. High — Office conversions remain bounded approximations. DOCX/EPUB/text conversions do not retain full pagination/layout; XLSX formulas/charts/print settings are not a spreadsheet calculation/layout engine. PPTX supports a limited subset and now rejects unsupported glyphs/overflow rather than silently damaging output. A compatible browser-only OOXML/layout engine and visual reference corpus are still needed for a full fidelity upgrade. No server LibreOffice added.',
  '2. High — ZIP expansion checks trust central-directory metadata. A cancellable, hard-bounded streaming inflater is needed before claiming hostile archive bomb immunity.',
  '3. High — OCR needs multilingual scan benchmarks, text-layer alignment visual measurements, skew/denoise algorithms and low-memory-device stress tests. Current manual rotation and contrast/threshold modes are real but are not automatic document restoration.',
  '4. Medium — Diff remains line-index comparison, not insertion-aligned Myers/LCS. Markdown remains a safe limited subset. Case camel/kebab modes are ASCII-oriented; word/sentence counting is heuristic. These are explicit remaining fidelity limitations, not fully upgraded engines.',
  '5. Medium — Speech output requires an audible test and voice/locality disclosure. OS voice implementations can use remote synthesis; no full offline claim is justified.',
  '6. Medium — Firefox/WebKit binaries and physical devices were unavailable. Maximum-size, cancellation/retry, memory profiles, every input format and multi-column/complex-document fidelity are not fully verified for all 95 tools.',
  '7. Medium — Existing dependency advisories need separate scoped remediation. Review analytics/ad/auth/database pending changes independently before any consolidated production release.', '',
  '## Files changed by this engine pass', '',
  ...sourceChanges.map(path => `- ${path}`), '',
  'Build-generated files also refreshed: dist/**, docs/SEO_ROUTE_AUDIT.md, docs/ADSENSE_CONTENT_AUDIT.md, docs/TOOL_CONTENT_INVENTORY.md, docs/TOOL_UI_ARCHITECTURE_AUDIT.md, docs/TOOL_UI_AUDIT.md, public_html/assets/identity-client.js, netlify/functions/_admin-product-snapshot.mjs, netlify/functions/_seo-build-counts.mjs and existing Background Remover build assets. Test outputs/screenshots are under test-results/. These are normal generator outputs, not hand-edited patches. Git status contains earlier unrelated changes and is not equivalent to this list.', '',
  '## Release decision', '',
  'Local engine changes are ready for review only after the validation table passes. NO-GO for a claim of all95 fully verified or perfect Office/OCR fidelity. No commit, push or deployment. Preserve all pending source and migrations 0001–0009, and review the consolidated diff before authorizing release.', ''
];
await writeFile('docs/GXA_95_TOOL_ADVANCED_ENGINE_FINAL_AUDIT.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('docs/GXA_95_TOOL_ADVANCED_ENGINE_FINAL_AUDIT.md', lines.join('\n'));
console.log(JSON.stringify({ tools: tools.length, counts, untested: inventory.filter(row => !row.evidence.length).map(row => row.id), sourceChanges: sourceChanges.length, vendorBytes: bundle.reduce((sum, row) => sum + row.bytes, 0) }));
