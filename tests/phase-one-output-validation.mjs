import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = name => readFile(join(fixtures, name));

function pngDimensions(buffer) {
  assert(buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'PNG signature is invalid.');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function validatePdf(buffer, expectedPages) {
  const text = buffer.toString('latin1');
  assert(text.startsWith('%PDF-'), 'PDF signature is invalid.');
  assert(text.includes('%%EOF'), 'PDF trailer is missing.');
  const pages = (text.match(/\/Type \/Page\b/g) || []).length;
  assert.equal(pages, expectedPages, `Expected ${expectedPages} PDF pages, received ${pages}.`);
}

assert.deepEqual(pngDimensions(await load('landscape.png')), { width: 1200, height: 800 });
assert.deepEqual(pngDimensions(await load('portrait.png')), { width: 800, height: 1200 });
assert.deepEqual(pngDimensions(await load('transparent.png')), { width: 512, height: 512 });
assert.deepEqual(pngDimensions(await load('large-resolution.png')), { width: 2600, height: 1800 });
assert.deepEqual(pngDimensions(await load('small.png')), { width: 16, height: 16 });

const jpeg = await load('sample.jpg');
assert.equal(jpeg[0], 0xff);
assert.equal(jpeg[1], 0xd8);
assert.equal(jpeg.at(-2), 0xff);
assert.equal(jpeg.at(-1), 0xd9);

const webp = await load('sample.webp');
assert.equal(webp.subarray(0, 4).toString(), 'RIFF');
assert.equal(webp.subarray(8, 12).toString(), 'WEBP');

validatePdf(await load('one-page.pdf'), 1);
validatePdf(await load('multi-page.pdf'), 5);
validatePdf(await load('text.pdf'), 2);
validatePdf(await load('scanned.pdf'), 2);
validatePdf(await load('mixed-content.pdf'), 3);
validatePdf(await load('rotated-page.pdf'), 2);
validatePdf(await load('large.pdf'), 80);

assert.rejects(async () => validatePdf(await load('corrupt.pdf'), 1));
assert.throws(() => pngDimensions(Buffer.from('not a png')));

console.log('Phase 1 output fixtures passed signature, MIME-family, dimension, and page-count validation.');
