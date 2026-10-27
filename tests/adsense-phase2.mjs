import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import * as PDFLib from 'pdf-lib';
import { loadToolRegistry, loadToolQuality } from '../scripts/tool-registry.mjs';

const asset = name => readFile(new URL(`../public_html/assets/${name}`, import.meta.url), 'utf8');
const dom = new JSDOM('<main id="generator-preview-mount"></main><div id="comparison-metric-mount"></div><div id="toast-container"></div>', { runScripts: 'outside-only', url: 'https://gxatoolbox.in/' });
const context = dom.getInternalVMContext();
Object.assign(context, { TextEncoder, TextDecoder, Blob, PDFLib });
vm.runInContext(await asset('tool-safety.js'), context);
vm.runInContext(await asset('html-to-pdf.js'), context);
vm.runInContext(await asset('barcode-reader.js'), context);
const safety = context.GxaToolSafety;
const ids = new Set(Array.from({ length: 5000 }, () => safety.uuidV4({ getRandomValues: bytes => webcrypto.getRandomValues(bytes) })));
assert.equal(ids.size, 5000, 'Secure fallback must not repeat a fixed identifier.');
for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
let nativeCalled = false;
assert.equal(safety.uuidV4({ randomUUID() { nativeCalled = true; return 'native-result'; } }), 'native-result');
assert.ok(nativeCalled);
assert.throws(() => safety.uuidV4({}), /Secure random generation is unavailable/);

const app = await asset('app.js');
function sourceFunction(name) {
  const start = app.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  const tail = app.slice(start);
  const next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  return next < 0 ? tail : tail.slice(0, next + 1);
}
context.appState = { activeToolOptions: { mode: 'decode' } };
// Exercise the real asynchronous parser engines while retaining DOM/XSS assertions.
const prettier = await import('prettier');
const { format: formatSql } = await import('sql-formatter');
context.formatCodePreview = async (kind, inputId, outputId, title) => {
  const mount = context.document.getElementById('generator-preview-mount');
  try {
    const input = context.document.getElementById(inputId).value;
    const result = kind === 'sql' ? formatSql(input) : await prettier.format(input, { parser: { javascript: 'babel', css: 'css', html: 'html' }[kind] });
    safety.textResult(mount, title, result, outputId, true);
  } catch (error) { safety.textResult(mount, 'Parse error', error.message); }
};
vm.runInContext(sourceFunction('convertBase64Text'), context);
const payload = '</textarea><img src=x onerror="globalThis.injected=1"><svg onload="globalThis.injected=1"></svg>';
function input(id, value) {
  let element = context.document.getElementById(id);
  if (!element) { element = context.document.createElement('textarea'); element.id = id; context.document.body.append(element); }
  element.value = value;
}
const cases = [
  ['generateBase64TextLive', 'opt-b64-raw', Buffer.from(payload).toString('base64')],
  ['generateUrlConvert', 'opt-url-text', encodeURIComponent(payload)],
  ['generateCaseConvert', 'opt-case-text', payload],
  ['generateCssBeautify', 'opt-css-raw', payload],
  ['generateJsBeautify', 'opt-js-raw', payload],
  ['generateHtmlBeautify', 'opt-html-beaut-raw', payload],
  ['generateSqlBeautify', 'opt-sql-raw', payload],
  ['generateXmlToJson', 'opt-xml-raw', '<root>&lt;/textarea&gt;&lt;img src=x onerror="globalThis.injected=1"&gt;</root>'],
  ['generateCronExplanation', 'opt-cron-exp', '<svg/onload=globalThis.injected=1> * * * *'],
  ['generateUserAgent', null, null]
];
input('opt-case-type', 'lower');
for (const [name, id, value] of cases) {
  if (id) input(id, value);
  vm.runInContext(sourceFunction(name), context);
  await context[name]();
  const mount = context.document.getElementById('generator-preview-mount');
  assert.equal(mount.querySelectorAll('img,svg,script,[onerror],[onload]').length, 0, `${name} parsed user content as markup`);
  assert.ok(mount.textContent || mount.querySelector('textarea')?.value, `${name} lost output`);
}
const metric = context.document.getElementById('comparison-metric-mount');
for (const title of ['Extracted QR text', 'Extracted barcode text', 'Base64 Output']) {
  safety.textResult(metric, title, payload, '', true);
  assert.equal(metric.querySelector('textarea').value, payload);
  assert.equal(metric.querySelectorAll('img,svg,script,[onclick]').length, 0);
}
safety.pairs(metric, 'EXIF', [[payload, payload]]);
assert.ok(metric.textContent.includes(payload));
assert.equal(metric.querySelectorAll('img,svg,script').length, 0);
assert.equal(context.injected, undefined);
for (const expression of ['${dataStr}</p>', '${resStr}</textarea>', '${formatted}</textarea>', '${jsonResult}</textarea>', '${result}</textarea>']) assert.ok(!app.includes(expression), `Unsafe dispatcher sink remains: ${expression}`);

// Reopen actual PDF bytes and decode page content streams independently of the
// HTML parser. End markers prove text was not silently discarded at a boundary.
async function pdfText(blob) {
  const pdf = await PDFLib.PDFDocument.load(await blob.arrayBuffer());
  let operators = '';
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFLib.PDFArray ? contents.asArray() : [contents];
    for (const entry of streams) {
      const stream = pdf.context.lookup(entry);
      operators += Buffer.from(PDFLib.decodePDFRawStream(stream).decode()).toString('latin1');
    }
  }
  const text = [...operators.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map(match => Buffer.from(match[1], 'hex').toString('latin1')).join('');
  return { pdf, text, operators };
}
const html = context.GxaHtmlToPdf;
const longInput = '<h1>Start</h1>' + Array.from({ length: 150 }, (_, i) => `<p>Paragraph ${i}: ${'Long readable content. '.repeat(12)}END${i}</p>`).join('') + '<p>FINAL_SENTINEL</p>';
const long = await pdfText(await html.convert(longInput));
assert.ok(long.pdf.getPageCount() > 1);
assert.ok(long.text.includes('FINAL_SENTINEL'));
for (let i = 0; i < 150; i++) assert.ok(long.text.includes(`END${i}`), `paragraph ${i} missing`);
const table = await pdfText(await html.convert('<table>' + Array.from({ length: 200 }, (_, i) => `<tr><td>ROW${i}</td><td>VALUE${i}</td></tr>`).join('') + '</table>'));
assert.ok(table.pdf.getPageCount() > 1);
for (let i = 0; i < 200; i++) assert.ok(table.text.includes(`ROW${i}`) && table.text.includes(`VALUE${i}`));
const unbroken = 'a'.repeat(6000) + 'LONG_WORD_END';
assert.ok((await pdfText(await html.convert(`<p>${unbroken}</p>`))).text.includes(unbroken));
const latin = await pdfText(await html.convert('<p>Español café <strong>bold</strong> and <em>italic</em> <b><i>both</i></b></p>'));
assert.ok(latin.text.includes('Español café bold and italic both'));
assert.ok(html.parse('<p><b>bold</b><i>italic</i></p>').some(run => run.bold));
assert.ok(html.parse('<p><b>bold</b><i>italic</i></p>').some(run => run.italic));
for (const value of ['<p>हिन्दी</p>', '<p>中文</p>', '<p>🙂</p>']) await assert.rejects(() => html.convert(value), /Unicode/);
for (const value of ['<img src=x>', '<script>alert(1)</script>', '<iframe src=x></iframe>', '<input value=test>']) await assert.rejects(() => html.convert(value), /Unsupported HTML/);
await assert.rejects(() => html.convert('x'.repeat(html.MAX_BYTES + 1)), /2 MB/);
await assert.rejects(() => html.convert(''), /Enter HTML/);

let revoked = 0, fallbackLoaded = 0;
const env = {
  Image: class { naturalWidth = 10; naturalHeight = 10; async decode() {} },
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => revoked++ },
  BarcodeDetector: class { static async getSupportedFormats() { return ['qr_code']; } async detect() { return [{ rawValue: 'native QR' }]; } },
  GxaWorkspace: { loadScriptOnce: async () => { fallbackLoaded++; throw new Error('offline'); } }
};
assert.equal((await context.GxaBarcodeReader.decode({}, ['qr_code'], { env })).rawValue, 'native QR');
assert.equal(fallbackLoaded, 0);
delete env.BarcodeDetector;
await assert.rejects(() => context.GxaBarcodeReader.decode({}, ['qr_code'], { env }), /could not load/);
assert.equal(revoked, 2);
const library = { DecodeHintType: { POSSIBLE_FORMATS: 1, TRY_HARDER: 2 }, BarcodeFormat: { QR_CODE: 0, 0: 'QR_CODE' }, BrowserMultiFormatReader: class { async decodeFromImageElement() { return { getText: () => 'fallback QR', getBarcodeFormat: () => 0 }; } reset() {} } };
assert.equal((await context.GxaBarcodeReader.decode({}, ['qr_code'], { env, library })).rawValue, 'fallback QR');
library.BrowserMultiFormatReader = class { async decodeFromImageElement() { throw new Error('not found'); } reset() {} };
await assert.rejects(() => context.GxaBarcodeReader.decode({}, ['qr_code'], { env, library }), /No readable code/);
assert.equal(revoked, 4);

const [tools, quality] = await Promise.all([loadToolRegistry(), loadToolQuality()]);
assert.equal(tools.length, 95);
assert.equal(Object.values(quality).filter(item => item.indexable).length, 81);
assert.equal(Object.values(quality).filter(item => item.adsEligible).length, 81);
assert.equal(Object.values(quality).filter(item => !item.productionReady).length, 14);
for (const state of Object.values(quality)) if (!state.indexable) assert.equal(state.adsEligible, false);
dom.window.close();
console.log('Phase 2 passed: secure UUID native/fallback/error, ten hostile-input previews, QR/EXIF text rendering, long multi-page HTML/tables/words, inline formatting, supported/unsupported Unicode, barcode native/fallback/failure and 81/14 quality policy.');
