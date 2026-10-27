import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import JSZip from 'jszip';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import { inspectZipDirectory } from '../public_html/assets/archive-safety.mjs';

const workerSource = await readFile('public_html/assets/engine-worker.js', 'utf8');
const files = {
  'prettier/standalone.js': 'prettier/standalone.js',
  ...Object.fromEntries(['babel', 'estree', 'postcss', 'html'].map(name => [`prettier/${name}.js`, `prettier/plugins/${name}.js`])),
  'sql-formatter/sql-formatter.min.js': 'sql-formatter/dist/sql-formatter.min.js',
  'imagetracer/imagetracer.js': 'imagetracerjs/imagetracer_v1.2.6.js'
};
async function invoke(kind, input, options = {}) {
  let result;
  const context = vm.createContext({ console, TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray, setTimeout, clearTimeout });
  context.self = context;
  context.importScripts = (...urls) => urls.forEach(url => {
    const file = files[url.replace('/assets/vendor/', '')];
    assert.ok(file, `Unexpected dependency request: ${url}`);
    vm.runInContext(readFileSync(`node_modules/${file}`, 'utf8'), context);
  });
  context.postMessage = value => { result = value; };
  vm.runInContext(workerSource, context);
  await context.onmessage({ data: { kind, input, options } });
  if (result.error) throw new Error(result.error);
  return result.result;
}
const evidence = [];
async function check(id, name, fn) {
  const start = performance.now();
  await fn();
  evidence.push({ id, name, passed: true, ms: performance.now() - start, scope: 'real engine in isolated VM; browser UI separate' });
  console.log(`PASS ${id}: ${name}`);
}
await check('js-beautifier', 'strings/comments/templates/nesting and known-fixture semantic equality', async () => {
  const source = 'const literal="a;b{c}";const nested={a:[1,{b:2}]};const tpl=`hello ${nested.a[1].b};{}`; // ;{}\nglobalThis.answer=[literal,tpl,nested.a[1].b];';
  const formatted = await invoke('javascript', source);
  const before = {}, after = {};
  vm.runInNewContext(source, before); vm.runInNewContext(formatted, after);
  assert.equal(JSON.stringify(before.answer), JSON.stringify(after.answer));
  assert.equal(formatted, await invoke('javascript', formatted));
  await assert.rejects(invoke('javascript', 'function {'), /Unexpected|Syntax/);
});
await check('css-beautifier', 'literal semicolon/braces and custom properties preserved', async () => {
  const result = await invoke('css', '.x::after{content:"a;b{c}";--size:calc(100% - 2px)}@media(width>10px){.x{color:red}}');
  assert.ok(result.includes('"a;b{c}"')); assert.ok(result.includes('calc(100% - 2px)'));
  await assert.rejects(invoke('css', '.x { color: '));
});
await check('html-beautifier', 'preformatted whitespace and embedded source preserved', async () => {
  const result = await invoke('html', '<div><pre>one  two\n  three</pre><script>const value="a;b{}";</script></div>');
  assert.ok(result.includes('one  two\n  three')); assert.ok(result.includes('"a;b{}"'));
});
await check('sql-formatter', 'quoted keywords and comments preserved', async () => {
  const result = await invoke('sql', "select 'from  where' as value /* select */ from t where x in(select x from u)");
  assert.ok(result.includes("'from  where'")); assert.ok(result.includes('/* select */'));
  assert.equal(result, await invoke('sql', result));
});
for (const kind of ['javascript', 'css', 'html', 'sql']) {
  await check({ javascript: 'js-beautifier', css: 'css-beautifier', html: 'html-beautifier', sql: 'sql-formatter' }[kind], 'empty and oversized inputs', async () => {
    assert.equal((await invoke(kind, '')).trim(), '');
    await assert.rejects(invoke(kind, ' '.repeat(500001)), /500,000/);
  });
}
await check('regex-tester', 'Unicode empty matches terminate and invalid expressions reject', async () => {
  const result = await invoke('regex', { pattern: '(?:)', flags: 'gu', subject: '😀' });
  assert.deepEqual(Array.from(result, x => x.index), [0, 2]);
  await assert.rejects(invoke('regex', { pattern: '[', flags: '', subject: '' }));
});
await check('png-to-svg', 'real deterministic paths, independent SVG raster reopen, and simple shape pixel agreement', async () => {
  const app = await readFile('public_html/assets/app.js', 'utf8');
  assert.doesNotMatch(app, /Raster image embedded in an SVG file|No vector tracing is performed/);
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) { const i = (y * 64 + x) * 4; pixels[i] = 255; pixels[i + 3] = 255; }
  const trace = () => invoke('trace', { width: 64, height: 64, data: new Uint8ClampedArray(pixels) }, { mode: 'color', smoothing: 0.1, noise: 0 });
  const svg = await trace();
  assert.match(svg, /<path\b/); assert.doesNotMatch(svg, /<(?:image|script|foreignObject)\b/i);
  assert.equal(svg, await trace());
  const { data, info } = await sharp(Buffer.from(svg)).resize(64, 64).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 64);
  let wrong = 0;
  for (let i = 3; i < pixels.length; i += 4) if ((pixels[i] > 127) !== (data[i] > 127)) wrong++;
  assert.ok(wrong / 4096 < 0.06, `Shape disagreement ${wrong / 4096}`);
  evidence.push({ id: 'png-to-svg', metric: 'binary alpha disagreement on 64x64 synthetic square', value: wrong / 4096, scope: 'one shape; not photo fidelity' });
  const bw = await invoke('trace', { width: 64, height: 64, data: new Uint8ClampedArray(pixels) }, { mode: 'bw', background: 'white' });
  await sharp(Buffer.from(bw)).png().toBuffer();
});
await check('zip-extractor', 'valid archive reopens; unsafe paths and high expansion rejected before inflation', async () => {
  const zip = new JSZip(); zip.file('hello.txt', 'Hello'); zip.file('हिन्दी.txt', 'नमस्ते');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  assert.equal(inspectZipDirectory(bytes).entries, 2);
  const reopened = await JSZip.loadAsync(bytes, { checkCRC32: true });
  assert.equal(await reopened.file('hello.txt').async('string'), 'Hello');
  const unsafe = new JSZip(); unsafe.file('../bad.txt', 'bad');
  const unsafeBytes = await unsafe.generateAsync({ type: 'uint8array' });
  assert.throws(() => inspectZipDirectory(unsafeBytes), /unsafe/);
  const bomb = new JSZip(); bomb.file('large.txt', 'a'.repeat(2000000));
  const compressed = await bomb.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  assert.throws(() => inspectZipDirectory(compressed), /expansion/);
  assert.throws(() => inspectZipDirectory(new Uint8Array(22)), /directory/);
});
await check('xml-to-json', 'attributes, mixed content, CDATA, repeated elements and unsafe input', async () => {
  const app = await readFile('public_html/assets/app.js', 'utf8');
  const start = app.indexOf('function generateXmlToJson(');
  const end = app.indexOf('\nfunction ', start + 1);
  const dom = new JSDOM('<textarea id="opt-xml-raw"></textarea><div id="generator-preview-mount"></div>', { runScripts: 'outside-only' });
  const context = dom.getInternalVMContext();
  vm.runInContext(await readFile('public_html/assets/tool-safety.js', 'utf8'), context);
  vm.runInContext(app.slice(start, end), context);
  const run = text => {
    context.document.getElementById('opt-xml-raw').value = text;
    context.generateXmlToJson();
    return context.document.querySelector('#generator-preview-mount textarea').value;
  };
  const result = JSON.parse(run('<root id="1">before <b>bold</b> after<![CDATA[<literal>]]></root>'));
  assert.equal(result.root['@attributes'].id, '1');
  assert.deepEqual(result.root['#content'], ['before ', { b: 'bold' }, ' after', '<literal>']);
  assert.deepEqual(JSON.parse(run('<root><x>one</x><x>two</x><__proto__>safe</__proto__></root>')).root.x, ['one', 'two']);
  assert.match(run('<!DOCTYPE root [<!ENTITY a "x">]><root>&a;</root>'), /not supported/);
  assert.match(run('<root>'), /Error parsing/);
  assert.match(run('<x>'.repeat(102) + '</x>'.repeat(102)), /nesting limit/);
  dom.window.close();
});
for (const [id, name] of [['lorem-ipsum', 'generateLoremIpsum'], ['cron-generator', 'generateCronExplanation'], ['diff-checker', 'generateDiffCheck']]) {
  await check(id, 'bounded inputs and truthful validation', async () => {
    const app = await readFile('public_html/assets/app.js', 'utf8');
    const start = app.indexOf(`function ${name}(`), end = app.indexOf('\nfunction ', start + 1);
    const dom = new JSDOM('<input id="opt-lorem-count"><input id="opt-cron-exp"><textarea id="opt-diff-orig"></textarea><textarea id="opt-diff-mod"></textarea><div id="generator-preview-mount"></div>', { runScripts: 'outside-only' });
    const ctx = dom.getInternalVMContext();
    vm.runInContext(await readFile('public_html/assets/tool-safety.js', 'utf8'), ctx);
    vm.runInContext(app.slice(start, end), ctx);
    const field = (key, value) => { ctx.document.getElementById(key).value = value; };
    const result = () => { ctx[name](); const mount = ctx.document.getElementById('generator-preview-mount'); return mount.querySelector('textarea')?.value || mount.textContent; };
    if (id === 'lorem-ipsum') {
      for (const invalid of ['', '-1', '1.2', '100000000']) { field('opt-lorem-count', invalid); assert.match(result(), /whole number/); }
      field('opt-lorem-count', '2'); assert.equal(result().split('\n\n').length, 2);
    } else if (id === 'cron-generator') {
      for (const invalid of ['', '99 * * * *', '*/0 * * * *', '0 24 * * *', '0 9 * * 5-1', '0 9 * BAD *']) { field('opt-cron-exp', invalid); assert.match(result(), /Invalid/); }
      for (const valid of ['*/5 * * * *', '0 9 * JAN MON-FRI', '0 9 1 * 1', '0,30 8-18 * * *']) { field('opt-cron-exp', valid); assert.doesNotMatch(result(), /Invalid/); }
      field('opt-cron-exp', '0 9 1 * 1'); assert.match(result(), /OR/);
    } else {
      field('opt-diff-orig', 'a\nb'); field('opt-diff-mod', 'a\nc'); assert.match(result(), /1 changed line/);
      field('opt-diff-mod', 'a\n'.repeat(5001)); assert.match(result(), /5,000 lines/);
    }
    dom.window.close();
  });
}
await check('image-ocr', 'bounded deterministic contrast and adaptive preprocessing', async () => {
  const input = () => ({ width: 40, height: 40, data: Uint8ClampedArray.from({ length: 40 * 40 * 4 }, (_, i) => i % 4 === 3 ? 255 : (Math.floor(i / 4) % 40 < 20 ? 100 : 180)) });
  const contrast = await invoke('ocr-preprocess', input(), { mode: 'contrast' });
  assert.equal(contrast[0], 0); assert.equal(contrast[20 * 4], 255);
  const adaptive = await invoke('ocr-preprocess', input(), { mode: 'adaptive' });
  assert.ok(Array.from(adaptive).every(value => value === 0 || value === 255));
  assert.deepEqual(Array.from(adaptive), Array.from(await invoke('ocr-preprocess', input(), { mode: 'adaptive' })));
  await assert.rejects(invoke('ocr-preprocess', { width: 8000001, height: 1, data: [] }), /8 megapixels/);
});
// Explicit pre-upgrade algorithms copied from the inspected working source.
// Their timing is not an equivalent-quality benchmark: the old code corrupts literals.
const sample = 'const literal="a;b{c}";globalThis.answer=literal;';
const legacyFormat = text => text.replace(/{\s*/g, ' {\n  ').replace(/;\s*/g, ';\n  ').replace(/\n\s*}\s*/g, '\n}\n').trim();
const oldStart = performance.now(); const oldResult = legacyFormat(sample); const oldMs = performance.now() - oldStart;
let oldValid = true;
try { new vm.Script(oldResult); } catch { oldValid = false; }
const newStart = performance.now(); const newResult = await invoke('javascript', sample); const newMs = performance.now() - newStart;
new vm.Script(newResult);
evidence.push({ id: 'js-beautifier', benchmark: 'one small string-literal regression; cold VM + library parse included only in after', beforeMs: oldMs, afterMs: newMs, beforeParses: oldValid, afterParses: true, speedupClaim: false });
await mkdir('test-results/advanced-engine', { recursive: true });
await writeFile('test-results/advanced-engine/unit-results.json', JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2));
console.log(`${evidence.filter(row => row.passed).length} engine cases passed.`);
