import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
mkdirSync(fixtureDirectory, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function createPng(width, height, transparent = false) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x += 1) {
      const offset = 1 + x * 4;
      row[offset] = Math.round(20 + 210 * x / Math.max(1, width - 1));
      row[offset + 1] = Math.round(60 + 150 * y / Math.max(1, height - 1));
      row[offset + 2] = 180;
      row[offset + 3] = transparent && (x + y) % 7 < 3 ? 0 : 255;
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function createPdf(pageDefinitions) {
  const objects = [];
  const addObject = body => { objects.push(body); return objects.length; };
  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  pageDefinitions.forEach((definition, index) => {
    const content = definition.scanned
      ? 'q 0.93 g 40 80 515 680 re f 0.2 G 40 80 515 680 re S Q'
      : `BT /F1 18 Tf 54 760 Td (GXA Toolbox fixture page ${index + 1}) Tj ET ${definition.mixed ? '0.8 g 54 620 260 90 re f' : ''}`;
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    const rotate = definition.rotate ? ` /Rotate ${definition.rotate}` : '';
    pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842]${rotate} /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;
  let output = '%PDF-1.7\n%GXA\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { output += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, 'latin1');
}

const jpeg1x1 = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=', 'base64');
const webp1x1 = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');

writeFileSync(join(fixtureDirectory, 'landscape.png'), createPng(1200, 800));
writeFileSync(join(fixtureDirectory, 'portrait.png'), createPng(800, 1200));
writeFileSync(join(fixtureDirectory, 'transparent.png'), createPng(512, 512, true));
writeFileSync(join(fixtureDirectory, 'large-resolution.png'), createPng(2600, 1800));
writeFileSync(join(fixtureDirectory, 'small.png'), createPng(16, 16));
writeFileSync(join(fixtureDirectory, 'sample.jpg'), jpeg1x1);
writeFileSync(join(fixtureDirectory, 'sample.webp'), webp1x1);
writeFileSync(join(fixtureDirectory, 'sample-2.webp'), webp1x1);
writeFileSync(join(fixtureDirectory, 'sample.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" rx="24" fill="#2563eb"/><circle cx="90" cy="90" r="48" fill="#f59e0b"/><text x="160" y="102" font-family="sans-serif" font-size="34" font-weight="700" fill="white">GXA</text></svg>');
writeFileSync(join(fixtureDirectory, 'corrupt-image.png'), Buffer.from('not a png'));
writeFileSync(join(fixtureDirectory, 'corrupt.webp'), Buffer.from('not a webp'));
writeFileSync(join(fixtureDirectory, 'corrupt.svg'), '<svg><broken>');
writeFileSync(join(fixtureDirectory, 'unsupported-file.xyz'), Buffer.from('unsupported fixture'));

writeFileSync(join(fixtureDirectory, 'one-page.pdf'), createPdf([{}]));
writeFileSync(join(fixtureDirectory, 'multi-page.pdf'), createPdf([{}, {}, {}, {}, {}]));
writeFileSync(join(fixtureDirectory, 'text.pdf'), createPdf([{}, {}]));
writeFileSync(join(fixtureDirectory, 'scanned.pdf'), createPdf([{ scanned: true }, { scanned: true }]));
writeFileSync(join(fixtureDirectory, 'mixed-content.pdf'), createPdf([{ mixed: true }, { scanned: true }, {}]));
writeFileSync(join(fixtureDirectory, 'rotated-page.pdf'), createPdf([{ rotate: 90 }, {}]));
writeFileSync(join(fixtureDirectory, 'large.pdf'), createPdf(Array.from({ length: 80 }, () => ({}))));
writeFileSync(join(fixtureDirectory, 'corrupt.pdf'), Buffer.from('%PDF-1.7\ncorrupt fixture without objects or trailer'));
writeFileSync(join(fixtureDirectory, 'PASSWORD_FIXTURE_NOTE.txt'), Buffer.from('A genuine encrypted PDF is intentionally not fabricated. Protect and unlock remain dependency-required until secure encryption processing is configured.\n'));

console.log(`Generated safe Phase 1 fixtures in ${fixtureDirectory}`);
