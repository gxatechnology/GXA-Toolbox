import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import * as PDFLib from 'pdf-lib';

const dom = new JSDOM('', { runScripts: 'outside-only' });
const context = dom.getInternalVMContext();
Object.assign(context, { PDFLib, TextEncoder, Blob });
vm.runInContext(await readFile(new URL('../../public_html/assets/html-to-pdf.js', import.meta.url), 'utf8'), context);
// The actual renderer is loaded above; only the browser script-loader is bypassed.
context.GxaWorkspace = { loadScriptOnce: async () => assert.ok(context.GxaHtmlToPdf) };
const source = await readFile(new URL('../../public_html/assets/app.js', import.meta.url), 'utf8');
for (const name of ['escapeHTML', 'runMarkdownToPDF']) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm')); assert.ok(start >= 0, name);
  const tail = source.slice(start); const next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  vm.runInContext(tail.slice(0, next + 1), context);
}
const text = '# Heading\n' + Array.from({ length: 120 }, (_, index) => `Paragraph ${index} ${'word '.repeat(30)}`).join('\n') + '\n' + 'X'.repeat(800) + '\nFINAL_SENTINEL';
const blob = await context.runMarkdownToPDF(null, text);
assert.equal(blob.type, 'application/pdf');
const doc = await PDFLib.PDFDocument.load(await blob.arrayBuffer()); assert.ok(doc.getPageCount() >= 3);
let allOperators = '';
for (const page of doc.getPages()) {
  const contents = page.node.Contents();
  for (const ref of contents instanceof PDFLib.PDFArray ? contents.asArray() : [contents]) allOperators += Buffer.from(PDFLib.decodePDFRawStream(doc.context.lookup(ref)).decode()).toString('latin1');
}
assert.ok(allOperators.includes(Buffer.from('FINAL_SENTINEL').toString('hex').toUpperCase()));
const drawnStrings = [...allOperators.matchAll(/<([0-9A-F]+)>\s*Tj/g)].map(match => Buffer.from(match[1], 'hex').toString('latin1')).join('');
assert.ok(drawnStrings.includes('X'.repeat(800)), 'Unbroken long line must retain every character across wraps');
await assert.rejects(context.runMarkdownToPDF(null, ''), /non-empty/);
await assert.rejects(context.runMarkdownToPDF(null, 'हिन्दी'), /Unicode/);
await assert.rejects(context.runMarkdownToPDF(null, 'x'.repeat(2 * 1024 * 1024 + 1)), /2 MB/);
await context.runMarkdownToPDF(null, '<script>alert(1)</script>');
assert.equal(context.document.querySelectorAll('script').length, 0);
dom.window.close();
console.log(`Markdown output passed: ${doc.getPageCount()} reopened pages, final marker, 800-character word, empty/oversize/Unicode failures and inert embedded markup.`);
