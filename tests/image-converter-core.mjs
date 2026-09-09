import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createImageConverterFixtures } from './fixtures/image-converter-fixtures.mjs';

const source = await readFile(new URL('../public_html/assets/image-converter-core.js', import.meta.url), 'utf8');
const context = { Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, TextDecoder, TextEncoder, console };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'image-converter-core.js' });
const core = context.GxaImageConverterCore;
const fixtures = await createImageConverterFixtures();

assert.deepEqual(Array.from(core.SUPPORTED_INPUTS), ['jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'svg', 'avif']);
for (const [name, expected] of Object.entries({ 'fixture.jpg': 'jpeg', 'fixture.png': 'png', 'fixture.webp': 'webp', 'animated.gif': 'gif', 'fixture.bmp': 'bmp', 'fixture.tiff': 'tiff', 'fixture.ico': 'ico', 'fixture.svg': 'svg', 'fixture.avif': 'avif' })) {
  const result = core.detect(fixtures[name].bytes, { name, mime: fixtures[name].mime });
  assert.equal(result.format, expected, `${name} must be detected from its real signature.`);
  assert.notEqual(result.support, 'unsupported', `${name} must be in the published verified input set.`);
}

const mismatch = core.detect(fixtures['renamed.jpg'].bytes, { name: 'renamed.jpg', mime: 'image/jpeg' });
assert.equal(mismatch.format, 'png');
assert.equal(mismatch.mismatch, true);
assert.equal(mismatch.mimeMismatch, true);

const heic = core.detect(fixtures['unsupported.heic'].bytes, { name: 'unsupported.heic', mime: 'image/heic' });
assert.equal(heic.format, 'heic');
assert.equal(heic.support, 'unsupported');
assert.match(heic.reason, /no verified decoder/i);
const raw = core.detect(Buffer.from('not-a-raw-file'), { name: 'camera.nef' });
assert.equal(raw.format, 'raw');
assert.equal(raw.support, 'unsupported');
const apngMarker = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('000000086163544c000000020000000000000000', 'hex')]);
const animatedWebpMarker = Buffer.from('524946460800000057454250414e494d00000000', 'hex');
assert.equal(core.detectAnimation(apngMarker, 'png'), true);
assert.equal(core.detectAnimation(animatedWebpMarker, 'webp'), true);
assert.equal(core.detectAnimation(fixtures['fixture.png'].bytes, 'png'), false);

const bmp = core.decodeBmp(fixtures['fixture.bmp'].bytes);
assert.deepEqual([bmp.width, bmp.height, bmp.rgba.length], [16, 16, 1024]);
assert.ok(bmp.rgba.some(value => value > 0));
const bmpOutput = core.encodeBmp({ width: bmp.width, height: bmp.height, rgba: bmp.rgba, background: '#ffffff' });
assert.equal(core.verifyOutput(bmpOutput, 'bmp'), true);
assert.deepEqual([core.decodeBmp(bmpOutput).width, core.decodeBmp(bmpOutput).height], [16, 16]);

const tiff = core.decodeTiff(fixtures['fixture.tiff'].bytes);
assert.deepEqual([tiff.width, tiff.height, tiff.rgba.length, tiff.pages], [16, 16, 1024, 1]);
assert.equal(core.hasAlpha(tiff.rgba), true);
const tiffOutput = core.encodeTiff({ width: tiff.width, height: tiff.height, rgba: tiff.rgba });
assert.equal(core.verifyOutput(tiffOutput, 'tiff'), true);
const reopenedTiff = core.decodeTiff(tiffOutput);
assert.deepEqual([reopenedTiff.width, reopenedTiff.height, reopenedTiff.rgba.length], [16, 16, 1024]);

const icon = core.parseIco(fixtures['fixture.ico'].bytes);
assert.equal(icon.entries.length, 1);
assert.equal(icon.supported[0].png, true);
const iconOutput = core.encodeIco(icon.supported[0].bytes, 16);
assert.equal(core.verifyOutput(iconOutput, 'ico'), true);
assert.deepEqual([core.parseIco(iconOutput).supported[0].width, core.parseIco(iconOutput).supported[0].height], [16, 16]);
const cursor = core.detect(fixtures['fixture.cur'].bytes, { name: 'fixture.cur', mime: 'image/x-icon' });
assert.equal(cursor.format, 'ico');
assert.equal(core.parseIco(fixtures['fixture.cur'].bytes).supported[0].png, true);

const choices = core.outputOptions('png', { webp: true, gif: true });
assert.equal(choices.some(item => item.format === 'png'), false, 'The exact source format is excluded from the dropdown.');
for (const expected of ['jpeg', 'webp', 'gif', 'bmp', 'tiff', 'ico']) assert.ok(choices.some(item => item.format === expected), `${expected} output must be exposed.`);
assert.throws(() => core.assertDimensions(10_000, 1), /safe/i);
assert.throws(() => core.decodeBmp(Buffer.from('BM')), /valid|truncated/i);
assert.throws(() => core.detect(Buffer.alloc(0), { name: 'empty.png' }), /empty/i);

console.log('Image Converter core passed: signature detection, mismatch handling, unsupported recognition, bounded BMP/TIFF/ICO decode and encode/reopen, alpha inspection, output filtering, and size limits.');
