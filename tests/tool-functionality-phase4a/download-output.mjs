import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

// Run after ux-phase3-browser.mjs. These are actual browser downloads, not input fixtures.
const root = resolve('test-results/ux-phase3');
const results = [];
for (const [id, filename, format] of [
  ['crop-image', 'crop-image-cropped-ux-test.png', 'png'],
  ['resize-image', 'resize-image-resized_ux-test.png', 'png'],
  ['compress-image', 'compress-image-compressed_ux-test.jpg', 'jpeg'],
  ['image-converter', 'image-converter-ux-test.jpg', 'jpeg']
]) {
  const bytes = await readFile(resolve(root, filename));
  const image = sharp(bytes); const metadata = await image.metadata();
  assert.equal(metadata.format, format); assert.ok(metadata.width > 0 && metadata.height > 0);
  const decoded = await image.raw().toBuffer(); assert.ok(decoded.length > 0);
  if (id === 'compress-image' || id === 'image-converter') assert.deepEqual([metadata.width, metadata.height], [800, 400]);
  if (id === 'resize-image') assert.deepEqual([metadata.width, metadata.height], [400, 200]);
  results.push({ id, filename, format, width: metadata.width, height: metadata.height, bytes: bytes.length, decoded: true });
}
for (const [id, filename] of [['merge-pdf', 'merge-pdf-merged_output.pdf'], ['jpg-to-pdf', 'jpg-to-pdf-images_converted.pdf'], ['image-to-pdf', 'image-to-pdf-images_converted.pdf']]) {
  const bytes = await readFile(resolve(root, filename)); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const doc = await PDFDocument.load(bytes); assert.equal(doc.getPageCount(), 1);
  assert.ok(doc.getPage(0).node.Contents(), 'PDF page must contain drawing operators');
  results.push({ id, filename, bytes: bytes.length, pages: doc.getPageCount(), parsed: true });
}
const archive = await JSZip.loadAsync(await readFile(resolve(root, 'pdf-to-jpg-extracted_images_ux-test.pdf.zip')), { checkCRC32: true });
const images = Object.values(archive.files).filter(entry => /\.jpe?g$/i.test(entry.name)); assert.equal(images.length, 1);
const rendered = sharp(await images[0].async('nodebuffer')); assert.equal((await rendered.metadata()).format, 'jpeg'); await rendered.raw().toBuffer();
results.push({ id: 'pdf-to-jpg', parsed: true, images: images.length });
const text = await readFile(resolve(root, 'image-ocr-ux-test_ocr.txt'), 'utf8'); assert.match(text, /GXA FILE TEST/i);
results.push({ id: 'image-ocr', outputTextVerified: true });
await writeFile(resolve(root, 'output-validation.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`Validated ${results.length} actual browser downloads: image decoding/dimensions, PDF reopening, ZIP CRC/image content, OCR text.`);
