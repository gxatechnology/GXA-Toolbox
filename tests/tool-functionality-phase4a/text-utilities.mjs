import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const app = await readFile(new URL('../../public_html/assets/app.js', import.meta.url), 'utf8');
const dom = new JSDOM('<main id="generator-preview-mount"></main><section id="inputs"></section>', { runScripts: 'outside-only', url: 'https://gxatoolbox.in/' });
const ctx = dom.getInternalVMContext();
Object.assign(ctx, { TextEncoder, TextDecoder, Blob, appState: { activeToolOptions: {} }, lucide: { createIcons() {} } });
Object.defineProperty(ctx, 'crypto', { value: webcrypto, configurable: true });
vm.runInContext(await readFile(new URL('../../public_html/assets/tool-safety.js', import.meta.url), 'utf8'), ctx);
function load(name, optional = false) {
  const start = app.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  if (optional && start < 0) return;
  assert.ok(start >= 0, name);
  const tail = app.slice(start), next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  vm.runInContext(next < 0 ? tail : tail.slice(0, next + 1), ctx);
}
for (const name of ['escapeHTML', 'generateBase64TextLive', 'runBase64Tool', 'generateUrlConvert', 'generateJsonModeLive', 'syntaxHighlightJson', 'createJsonTreeNode', 'generateUUIDs', 'secureRandomIndex', 'generatePassword', 'runHashTool', 'generateHashTextLive', 'generateDiffCheck', 'generateMarkdownPreview']) load(name);
load('convertBase64Text', true);
load('importBase64File');
const mount = ctx.document.getElementById('generator-preview-mount');
function fields(values, options = {}) {
  ctx.document.getElementById('inputs').replaceChildren(); mount.replaceChildren(); ctx.appState.activeToolOptions = options;
  for (const [id, value] of Object.entries(values)) {
    const input = ctx.document.createElement(typeof value === 'boolean' ? 'input' : 'textarea'); input.id = id;
    if (typeof value === 'boolean') { input.type = 'checkbox'; input.checked = value; } else input.value = String(value);
    ctx.document.getElementById('inputs').append(input);
  }
}
const checks = [];
async function check(name, test) {
  try { await test(); checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, passed: false }); console.error(`FAIL ${name}: ${error.message}`); }
}
const unicode = 'हिन्दी café 🙂 </textarea><script>not markup</script>';
await check('Base64 live and engine Unicode encode/decode agree with UTF-8 bytes', async () => {
  const encoded = Buffer.from(unicode).toString('base64');
  for (const [mode, input, expected] of [['encode', unicode, encoded], ['decode', encoded, unicode]]) {
    fields({ 'opt-b64-raw': input }, { mode }); ctx.generateBase64TextLive();
    assert.equal(mount.querySelector('textarea').value, expected);
    assert.equal(await ctx.runBase64Tool(null, input, mode), expected);
    assert.equal(mount.querySelectorAll('script,img').length, 0);
  }
});
await check('Base64 invalid syntax and non-UTF-8 bytes fail clearly', async () => {
  for (const input of ['%%%invalid', '/w==']) {
    fields({ 'opt-b64-raw': input }, { mode: 'decode' }); ctx.generateBase64TextLive();
    assert.match(mount.querySelector('textarea').value, /Invalid Base64|UTF-8/i);
    assert.ok(mount.querySelector('[role=alert]'));
    await assert.rejects(ctx.runBase64Tool(null, input, 'decode'), /Base64|UTF-8/i);
  }
});
await check('Base64 file engine preserves binary byte sequence and empty text', async () => {
  const bytes = Buffer.from([0, 255, 128, 1, 2, 3]);
  assert.equal(await ctx.runBase64Tool({ arrayBuffer: async () => bytes }, '', 'encode'), bytes.toString('base64'));
  for (const mode of ['encode', 'decode']) assert.equal(await ctx.runBase64Tool(null, '', mode), '');
});
await check('Base64 import encodes once and decodes uploaded Base64 text', async () => {
  fields({ 'opt-b64-raw': '' }, { mode: 'encode' });
  await ctx.importBase64File({ files: [{ arrayBuffer: async () => Buffer.from(unicode) }] });
  assert.equal(mount.querySelector('textarea').value, Buffer.from(unicode).toString('base64'));
  ctx.appState.activeToolOptions.mode = 'decode';
  await ctx.importBase64File({ files: [{ text: async () => Buffer.from(unicode).toString('base64') }] });
  assert.equal(mount.querySelector('textarea').value, unicode);
});
await check('Base64 late file result cannot overwrite newer text input', async () => {
  fields({ 'opt-b64-raw': '' }, { mode: 'encode' });
  let finish;
  const old = ctx.importBase64File({ files: [{ arrayBuffer: () => new Promise(resolve => { finish = resolve; }) }] });
  ctx.appState.activeToolOptions.base64File = null;
  ctx.document.getElementById('opt-b64-raw').value = 'new'; ctx.generateBase64TextLive();
  finish(Buffer.from('old')); await old;
  assert.equal(mount.querySelector('textarea').value, Buffer.from('new').toString('base64'));
});
await check('URL Unicode round trip, invalid percent encoding and inert output', () => {
  for (const [mode, input, expected] of [['encode', unicode, encodeURIComponent(unicode)], ['decode', encodeURIComponent(unicode), unicode], ['decode', '%E0%', 'Invalid encoded string.']]) {
    fields({ 'opt-url-text': input }, { mode }); ctx.generateUrlConvert(); assert.equal(mount.querySelector('textarea').value, expected); assert.equal(mount.querySelectorAll('script,img').length, 0);
  }
});
await check('JSON scalar/object/array Unicode round trips; invalid input cannot claim success', () => {
  for (const value of [null, 0, true, unicode, JSON.parse(JSON.stringify({ items: [unicode, 1, false] }))]) {
    for (const mode of ['beautify', 'minify']) {
      fields({ 'opt-json-raw': JSON.stringify(value) }, { mode }); ctx.generateJsonModeLive();
      assert.deepEqual(JSON.parse(ctx.document.getElementById('generated-json-display').value), value);
      assert.equal(mount.querySelectorAll('script,img').length, 0);
    }
  }
  fields({ 'opt-json-raw': '{bad json}' }); ctx.generateJsonModeLive(); assert.equal(mount.querySelector('.json-validation-badge').textContent, 'Invalid');
});
await check('JSON 100KB source retains the final Unicode value', () => {
  const value = { text: 'a'.repeat(100000) + unicode };
  fields({ 'opt-json-raw': JSON.stringify(value) }); ctx.generateJsonModeLive();
  assert.deepEqual(JSON.parse(ctx.document.getElementById('generated-json-display').value), value);
});
await check('UUID requested count, v4 bit structure, uniqueness and invalid count', () => {
  fields({ 'opt-uuid-count': 100 }); ctx.generateUUIDs();
  const values = mount.querySelector('textarea').value.split('\n'); assert.equal(values.length, 100); assert.equal(new Set(values).size, 100);
  values.forEach(value => assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  for (const count of [0, 101, 1.5, '']) { fields({ 'opt-uuid-count': count }); ctx.generateUUIDs(); assert.ok(mount.querySelector('[role=alert]')); assert.equal(mount.querySelector('textarea'), null); }
});
await check('Password length, required sets, regeneration and unchecked-set fallback', () => {
  for (const length of [8, 16, 64]) {
    fields({ 'pw-upper': true, 'pw-lower': true, 'pw-nums': true, 'pw-syms': true }, { length });
    const outputs = new Set();
    for (let i = 0; i < 30; i++) { ctx.generatePassword(); const output = ctx.document.getElementById('generated-password-value').textContent; outputs.add(output); assert.equal(output.length, length); for (const pattern of [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/]) assert.match(output, pattern); }
    assert.equal(outputs.size, 30);
  }
  fields({ 'pw-upper': false, 'pw-lower': false, 'pw-nums': false, 'pw-syms': false }, { length: 16 }); ctx.generatePassword(); assert.match(ctx.document.getElementById('generated-password-value').textContent, /^[a-z]{16}$/);
});
await check('Hash engine text/file bytes agree with independent Node digests', async () => {
  for (const algo of ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']) for (const text of ['', '   ', 'abc', unicode]) {
    const expected = createHash(algo.toLowerCase().replace('-', '')).update(text).digest('hex');
    assert.equal(await ctx.runHashTool(null, text, algo), expected);
    assert.equal(await ctx.runHashTool({ arrayBuffer: async () => Buffer.from(text) }, '', algo), expected);
  }
});
await check('Live hash preserves whitespace and empty-byte input', async () => {
  for (const text of ['', '   ', unicode]) {
    fields({ 'opt-hash-text': text, 'opt-hash-algo': 'SHA-256' }); await ctx.generateHashTextLive();
    assert.equal(ctx.document.getElementById('generated-hash-value').textContent.trim(), createHash('sha256').update(text).digest('hex'));
  }
});
await check('Live hash invalid algorithm is an accessible error, not a rejected event', async () => {
  fields({ 'opt-hash-text': 'hello', 'opt-hash-algo': 'UNSUPPORTED' }); await ctx.generateHashTextLive();
  assert.ok(mount.querySelector('[role=alert]')); assert.equal(ctx.document.getElementById('generated-hash-value'), null);
});
await check('Diff changed-line counts and hostile Unicode remain text', () => {
  fields({ 'opt-diff-orig': unicode + '\nunchanged', 'opt-diff-mod': unicode + '\nchanged' }); ctx.generateDiffCheck();
  assert.equal(ctx.document.getElementById('diff-summary').textContent, '1 changed line');
  assert.ok(mount.textContent.includes(unicode)); assert.equal(mount.querySelectorAll('script,img').length, 0);
});
await check('Markdown live heading/bold and literal HTML scope', () => {
  fields({ 'opt-mde-raw': '# Title\n**Bold**\n' + unicode }); ctx.generateMarkdownPreview();
  assert.equal(mount.querySelector('h1').textContent, 'Title'); assert.equal(mount.querySelector('strong').textContent, 'Bold');
  assert.equal(mount.querySelectorAll('script,img').length, 0); assert.ok(mount.textContent.includes(unicode));
});
dom.window.close();
console.log(`${checks.filter(item => item.passed).length}/${checks.length} Phase 4A text utility checks passed.`);
if (checks.some(item => !item.passed)) process.exitCode = 1;
