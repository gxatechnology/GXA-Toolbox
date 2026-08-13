import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import JSZip from 'jszip';
import createQpdf from '@neslinesli93/qpdf-wasm';
import gifenc from 'gifenc';

const { GIFEncoder, applyPalette, quantize } = gifenc;

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

function createRasterTextPdf() {
  const glyphs = {
    A: ['01110','10001','10001','11111','10001','10001','10001'], C: ['01111','10000','10000','10000','10000','10000','01111'],
    E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
    G: ['01111','10000','10000','10111','10001','10001','01111'], I: ['11111','00100','00100','00100','00100','00100','11111'],
    O: ['01110','10001','10001','10001','10001','10001','01110'], R: ['11110','10001','10001','11110','10100','10010','10001'],
    T: ['11111','00100','00100','00100','00100','00100','00100'], U: ['10001','10001','10001','10001','10001','10001','01110'],
    X: ['10001','10001','01010','00100','01010','10001','10001'], 2: ['01110','10001','00001','00010','00100','01000','11111'],
    0: ['01110','10001','10011','10101','11001','10001','01110'], 6: ['00110','01000','10000','11110','10001','10001','01110']
  };
  const phrase = 'GXA OCR FIXTURE 2026';
  const scale = 6;
  const width = phrase.length * 6 * scale + 40;
  const height = 7 * scale + 40;
  const pixels = Buffer.alloc(width * height * 3, 255);
  phrase.split('').forEach((character, characterIndex) => {
    const rows = glyphs[character];
    if (!rows) return;
    rows.forEach((row, y) => row.split('').forEach((value, x) => {
      if (value !== '1') return;
      for (let sy = 0; sy < scale; sy += 1) for (let sx = 0; sx < scale; sx += 1) {
        const px = 20 + characterIndex * 6 * scale + x * scale + sx;
        const py = 20 + y * scale + sy;
        pixels.fill(0, (py * width + px) * 3, (py * width + px) * 3 + 3);
      }
    }));
  });
  const image = deflateSync(pixels);
  const content = 'q 520 0 0 100 38 370 cm /Im0 Do Q';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.length} >>\nstream\n`, 'latin1'), image, Buffer.from('\nendstream', 'latin1')])
  ];
  const chunks = [Buffer.from('%PDF-1.7\n%GXA\n', 'latin1')];
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'), Buffer.from('\nendobj\n', 'latin1'));
  });
  const xref = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(position => { trailer += `${String(position).padStart(10, '0')} 00000 n \n`; });
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  chunks.push(Buffer.from(trailer, 'latin1'));
  return Buffer.concat(chunks);
}

async function writeZipFixture(name, entries, options = {}) {
  const archive = new JSZip();
  for (const [path, contents, entryOptions] of entries) archive.file(path, contents, entryOptions || {});
  const bytes = await archive.generateAsync({ type: 'nodebuffer', compression: options.compression || 'DEFLATE' });
  writeFileSync(join(fixtureDirectory, name), bytes);
}

const jpeg1x1 = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKgA/9k=', 'base64');
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
writeFileSync(join(fixtureDirectory, 'scanned.pdf'), createRasterTextPdf());
writeFileSync(join(fixtureDirectory, 'embedded-image.pdf'), createRasterTextPdf());
writeFileSync(join(fixtureDirectory, 'mixed-content.pdf'), createPdf([{ mixed: true }, { scanned: true }, {}]));
writeFileSync(join(fixtureDirectory, 'rotated-page.pdf'), createPdf([{ rotate: 90 }, {}]));
writeFileSync(join(fixtureDirectory, 'large.pdf'), createPdf(Array.from({ length: 80 }, () => ({}))));
writeFileSync(join(fixtureDirectory, 'corrupt.pdf'), Buffer.from('%PDF-1.7\ncorrupt fixture without objects or trailer'));
writeFileSync(join(fixtureDirectory, 'sample.txt'), Buffer.from('GXA Toolbox synthetic text fixture.\n'));
writeFileSync(join(fixtureDirectory, 'sample.json'), Buffer.from('{"product":"GXA Toolbox","fixture":true}\n'));
writeFileSync(join(fixtureDirectory, 'sample.csv'), Buffer.from('name,category,value\nAlpha,fixture,42\nBeta,fixture,84\n'));

const gif = GIFEncoder();
for (let frame = 0; frame < 2; frame += 1) {
  const rgba = new Uint8Array(16 * 16 * 4);
  for (let pixel = 0; pixel < 16 * 16; pixel += 1) rgba.set(frame ? [245, 158, 11, 255] : [37, 99, 235, 255], pixel * 4);
  const palette = quantize(rgba, 256);
  gif.writeFrame(applyPalette(rgba, palette), 16, 16, { palette, delay: 120, repeat: 0 });
}
gif.finish();
writeFileSync(join(fixtureDirectory, 'sample.gif'), Buffer.from(gif.bytes()));

await writeZipFixture('sample.zip', [['hello.txt', 'Synthetic ZIP fixture'], ['nested/data.json', '{"ok":true}']]);
await writeZipFixture('sample.docx', [
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
  ['_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
  ['word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>GXA Toolbox DOCX fixture</w:t></w:r></w:p><w:sectPr/></w:body></w:document>']
]);
await writeZipFixture('sample.xlsx', [
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
  ['_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Fixture" sheetId="1" r:id="rId1"/></sheets></workbook>'],
  ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>GXA Toolbox</t></is></c><c r="B1"><v>91</v></c></row></sheetData></worksheet>']
]);
await writeZipFixture('sample.pptx', [
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>'],
  ['_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>'],
  ['ppt/presentation.xml', '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>'],
  ['ppt/_rels/presentation.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>'],
  ['ppt/slides/slide1.xml', '<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="GXA Toolbox fixture"><p:spTree/></p:cSld></p:sld>']
]);
await writeZipFixture('sample.epub', [
  ['mimetype', 'application/epub+zip', { compression: 'STORE' }],
  ['META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
  ['EPUB/package.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">gxa-fixture</dc:identifier><dc:title>GXA Toolbox EPUB fixture</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-08-13T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>'],
  ['EPUB/nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">Fixture</a></li></ol></nav></body></html>'],
  ['EPUB/chapter.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>GXA Toolbox</h1><p>Synthetic EPUB fixture chapter.</p></body></html>']
]);

const qpdf = await createQpdf({ locateFile: () => fileURLToPath(new URL('../../node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm', import.meta.url)), noInitialRun: true, print() {}, printErr() {} });
const sourcePdf = createPdf([{}]);
qpdf.FS.writeFile('/fixture.pdf', sourcePdf);
const qpdfExit = qpdf.callMain(['--encrypt', 'gxa-fixture', 'gxa-fixture-owner', '256', '--', '/fixture.pdf', '/encrypted.pdf']);
if (qpdfExit !== 0) throw new Error('Unable to generate encrypted PDF fixture.');
writeFileSync(join(fixtureDirectory, 'encrypted-password.pdf'), Buffer.from(qpdf.FS.readFile('/encrypted.pdf')));

writeFileSync(join(fixtureDirectory, 'manifest.json'), JSON.stringify({
  synthetic: true,
  encryptedPdfPassword: 'gxa-fixture',
  ocrPhrase: 'GXA OCR FIXTURE 2026',
  gifFrames: 2,
  required: ['one-page.pdf','multi-page.pdf','encrypted-password.pdf','scanned.pdf','embedded-image.pdf','landscape.png','sample.jpg','sample.webp','sample.svg','sample.gif','sample.docx','sample.xlsx','sample.pptx','sample.epub','sample.zip','sample.txt','sample.json','sample.csv']
}, null, 2));

console.log(`Generated safe Phase 1 fixtures in ${fixtureDirectory}`);
