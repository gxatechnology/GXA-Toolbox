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

function jpegDimensions(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, 'JPEG signature is invalid.');
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = buffer.readUInt16BE(offset + 2);
    assert(length >= 2 && offset + 2 + length <= buffer.length, 'JPEG segment is truncated.');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG has no supported frame dimensions.');
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
assert.deepEqual(jpegDimensions(jpeg), { width: 1, height: 1 });
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
validatePdf(await load('scanned.pdf'), 1);
validatePdf(await load('embedded-image.pdf'), 1);
validatePdf(await load('mixed-content.pdf'), 3);
validatePdf(await load('rotated-page.pdf'), 2);
validatePdf(await load('large.pdf'), 80);

assert.rejects(async () => validatePdf(await load('corrupt.pdf'), 1));
assert.throws(() => pngDimensions(Buffer.from('not a png')));

const gif = await load('sample.gif');
assert.equal(gif.subarray(0, 6).toString(), 'GIF89a');
assert.equal(gif.at(-1), 0x3b);

const encryptedPdf = await load('encrypted-password.pdf');
assert(encryptedPdf.toString('latin1').includes('/Encrypt'), 'Encrypted PDF fixture must contain an encryption dictionary.');

for (const archiveName of ['sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.epub', 'sample.zip']) {
  const archive = await load(archiveName);
  assert.equal(archive.subarray(0, 2).toString(), 'PK', `${archiveName} must be a ZIP package.`);
}

const jsonFixture = await load('sample.json');
assert.doesNotThrow(() => JSON.parse(jsonFixture.toString('utf8')));
assert((await load('sample.csv')).toString('utf8').includes('name,category,value'));

console.log('Phase 1 output fixtures passed signature, MIME-family, dimension, and page-count validation.');
