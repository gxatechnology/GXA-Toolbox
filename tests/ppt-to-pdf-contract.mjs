import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import * as PDFLib from 'pdf-lib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = await readFile(join(root, 'public_html', 'assets', 'pptx-to-pdf.js'), 'utf8');
globalThis.window = { JSZip, PDFLib };
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const engine = globalThis.window.GxaPptxToPdf;
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WQAAAABJRU5ErkJggg==', 'base64'));
async function presentation(slides, portrait = false) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldSz cx="${portrait ? 6858000 : 12192000}" cy="${portrait ? 12192000 : 6858000}"/><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', `<Relationships>${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`);
  slides.forEach((slide, index) => {
    const image = slide.image ? `<p:pic><p:spPr><a:xfrm><a:off x="1000000" y="2500000"/><a:ext cx="2000000" cy="1000000"/></a:xfrm></p:spPr><a:blip r:embed="rId1"/></p:pic>` : '';
    zip.file(`ppt/slides/slide${index + 1}.xml`, `<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:bg><a:solidFill><a:srgbClr val="${slide.bg || 'FFFFFF'}"/></a:solidFill></p:bg><p:sp><p:spPr><a:xfrm><a:off x="600000" y="600000"/><a:ext cx="8000000" cy="900000"/></a:xfrm><a:solidFill><a:srgbClr val="DDEEFF"/></a:solidFill></p:spPr><p:txBody><a:p><a:r><a:rPr sz="2400" b="1"><a:solidFill><a:srgbClr val="102040"/></a:solidFill></a:rPr><a:t>${slide.text}</a:t></a:r></a:p></p:txBody></p:sp>${image}</p:sld>`);
    if (slide.image) zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, '<Relationships><Relationship Id="rId1" Target="../media/image1.png"/></Relationships>');
  });
  if (slides.some(slide => slide.image)) zip.file('ppt/media/image1.png', png);
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return { name: 'presentation.pptx', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}
const multi = await engine.convert(await presentation([{ text: 'First slide' }, { text: 'Second slide', image: true, bg: 'FFF7E6' }]));
assert.equal(multi.slideCount, 2);
assert.equal(multi.warnings.length, 0, `Basic text/image slides should not need a rendering warning: ${multi.warnings.join(', ')}`);
assert.equal((await PDFLib.PDFDocument.load(await multi.blob.arrayBuffer())).getPageCount(), 2, 'PDF must contain one page for every slide.');
assert.ok(multi.blob.size > 800, 'Generated PDF must contain actual rendered content.');
const portrait = await engine.convert(await presentation([{ text: 'Portrait slide' }], true));
await assert.rejects(() => presentation([{ text: 'हिन्दी' }]).then(file => engine.convert(file)), /unsupported.*font/i);
await assert.rejects(() => presentation([{ text: 'Overflow '.repeat(200) }]).then(file => engine.convert(file)), /text exceeds/i);
const colored = await engine.convert(await presentation([{ text: 'Red background', bg: 'FF0000' }]));
const coloredDoc = await PDFLib.PDFDocument.load(await colored.blob.arrayBuffer());
const streams = coloredDoc.getPage(0).node.Contents().asArray();
const operators = streams.map(ref => Buffer.from(PDFLib.decodePDFRawStream(coloredDoc.context.lookup(ref)).decode()).toString('latin1')).join('');
assert.match(operators, /1 0 0 rg/, 'PPTX background color must not silently become white.');
const portraitPage = (await PDFLib.PDFDocument.load(await portrait.blob.arrayBuffer())).getPage(0).getSize();
assert.ok(portraitPage.height > portraitPage.width, 'Portrait PPTX dimensions must produce a portrait PDF page.');
for (const file of [{ name: 'legacy.ppt', size: 1, arrayBuffer: async () => new ArrayBuffer(1) }, { name: 'wrong.txt', size: 1, arrayBuffer: async () => new ArrayBuffer(1) }, { name: 'mime-mismatch.pptx', type: 'text/plain', size: 1, arrayBuffer: async () => new ArrayBuffer(1) }, { name: 'empty.pptx', size: 0, arrayBuffer: async () => new ArrayBuffer(0) }, { name: 'broken.pptx', size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }, { name: 'large.pptx', size: engine.MAX_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(1) }]) await assert.rejects(() => engine.convert(file));
console.log('PPTX to PDF contract passed: simple, multi-slide, text/image, portrait, invalid, legacy, empty, corrupt, and oversized inputs.');
