import assert from 'node:assert/strict';
import * as lib from 'pdf-lib';
import { createEditPdfFixtures } from './fixtures/edit-pdf-fixtures.mjs';
import '../public_html/assets/pdf-edit-core.js';
const core = globalThis.GxaPdfEditCore;
const fixtures = await createEditPdfFixtures();
assert.deepEqual(core.imageEditGeometry(80, 60, { left: 25, top: 25, width: 50, height: 50, rotation: 90 }), { x: 20, y: 15, cropWidth: 40, cropHeight: 30, rotation: 90, outputWidth: 30, outputHeight: 40 });
assert.equal(core.imageEditGeometry(3, 3, { left: 33.33, top: 0, width: 33.34, height: 100 }).cropWidth, 1);
for (const bad of [{ left: -1 }, { width: 0 }, { width: NaN }, { left: 50, width: 60 }, { top: 90, height: 11 }, { rotation: 45 }, { width: .01 }]) assert.throws(() => core.imageEditGeometry(80, 60, bad));
assert.throws(() => core.imageEditGeometry(8000, 8000));
assert.throws(() => core.imageEditGeometry(10.5, 60));
const source = fixtures['flat-multipage.pdf'];
const original = await lib.PDFDocument.load(source);
const streams = (doc, i) => (doc.getPage(i).node.Contents()?.asArray() || []).map(ref => {
  const stream = doc.context.lookup(ref);
  return stream instanceof lib.PDFRawStream ? Buffer.from(lib.decodePDFRawStream(stream).decode()).toString('latin1') : stream.getContentsString();
}).join('\n');
const plan = [
  { sourceIndex: 1, rotation: 90 }, { sourceIndex: 0, rotation: 0 },
  { sourceIndex: 1, rotation: 180 }, { sourceIndex: null, width: 400, height: 600, rotation: 0 }
];
const bytes = await core.exportPdf(source, { pagePlan: plan }, lib);
const doc = await lib.PDFDocument.load(bytes);
assert.equal(doc.getPageCount(), 4);
for (const [i, src] of [[0, 1], [1, 0], [2, 1]]) {
  assert.deepEqual(doc.getPage(i).getCropBox(), original.getPage(src).getCropBox());
  assert.deepEqual(doc.getPage(i).getMediaBox(), original.getPage(src).getMediaBox());
  assert.ok(streams(doc, i).includes(streams(original, src)), 'Original painting instructions remain');
  assert.equal(doc.getPage(i).getRotation().angle, (original.getPage(src).getRotation().angle + plan[i].rotation) % 360);
}
assert.deepEqual(doc.getPage(3).getSize(), { width: 400, height: 600 });
assert.equal(streams(doc, 3), '');
assert.deepEqual(source, fixtures['flat-multipage.pdf']);
assert.equal((await lib.PDFDocument.load(await core.exportPdf(source, { pagePlan: [{ sourceIndex: 0 }] }, lib))).getPageCount(), 1);
for (const bad of [[], [{ sourceIndex: 999 }], [{ sourceIndex: 0, rotation: 15 }], [{ sourceIndex: null, width: NaN, height: 100 }], Array.from({ length: 501 }, () => ({ sourceIndex: 0 }))]) {
  await assert.rejects(core.exportPdf(source, { pagePlan: bad }, lib));
}
const formBytes = fixtures['fillable-form.pdf'];
const formInfo = await core.inspect(formBytes, lib);
const reversed = formInfo.pages.map((_, sourceIndex) => ({ sourceIndex, rotation: 90 })).reverse();
const reordered = await lib.PDFDocument.load(await core.exportPdf(formBytes, { pagePlan: reversed, fieldValues: { fullName: 'Retained form value' } }, lib));
assert.equal(reordered.getForm().getTextField('fullName').getText(), 'Retained form value');
assert.deepEqual((await core.inspect(await reordered.save({ updateFieldAppearances: false }), lib)).fields.find(f => f.name === 'fullName').widgets.map(w => w.pageIndex), [4, 2]);
await assert.rejects(core.exportPdf(formBytes, { pagePlan: [{ sourceIndex: 0 }] }, lib), /form fields or annotations/);
await assert.rejects(core.exportPdf(formBytes, { pagePlan: [...reversed, { sourceIndex: 0 }] }, lib), /form fields or annotations/);
const flatForm = await core.exportPdf(formBytes, { flatten: true }, lib);
assert.equal((await lib.PDFDocument.load(await core.exportPdf(flatForm, { pagePlan: [{ sourceIndex: 0 }, { sourceIndex: 0 }] }, lib))).getPageCount(), 2);
const base = { pageIndex: 0, x: 50, y: 100, width: 240, height: 100, color: '#224488' };
const styled = { ...base, type: 'text', text: 'Bold italic\nUnderlined', font: 'HelveticaBoldItalic', fontSize: 18, lineSpacing: 1.8, underline: true, opacity: .45 };
const layout = await core.layoutText(styled.text, styled, lib);
assert.equal(layout.lineHeight, 32.4);
assert.ok(Math.abs(layout.lines[1].y - layout.lines[0].y - 32.4) < 1e-8);
const styledDoc = await lib.PDFDocument.load(await core.exportPdf(source, { overlays: [styled] }, lib));
const styledStream = streams(styledDoc, 0);
assert.match(styledStream, /Helvetica-BoldOblique/);
assert.match(styledStream, /\bS\b/, 'Underline draws a real line');
const resources = styledDoc.getPage(0).node.Resources();
const states = resources.lookup(lib.PDFName.of('ExtGState'), lib.PDFDict);
assert.ok(states.values().some(state => styledDoc.context.lookup(state).get(lib.PDFName.of('ca'))?.asNumber() === .45));
const imageDoc = await lib.PDFDocument.load(await core.exportPdf(source, { overlays: [{ ...base, type: 'image', imageType: 'image/png', imageBytes: fixtures['image.png'], opacity: .5 }] }, lib));
const imageStates = imageDoc.getPage(0).node.Resources().lookup(lib.PDFName.of('ExtGState'), lib.PDFDict);
assert.ok(imageStates.values().some(state => imageDoc.context.lookup(state).get(lib.PDFName.of('ca'))?.asNumber() === .5));
assert.match(streams(imageDoc,0), /\bDo\b/, 'Image remains a real XObject, not a placeholder');
for (const font of ['Helvetica','HelveticaBold','HelveticaItalic','HelveticaBoldItalic','TimesRoman','TimesRomanBold','TimesRomanItalic','TimesRomanBoldItalic','Courier','CourierBold','CourierItalic','CourierBoldItalic']) {
  const output = await core.exportPdf(source, { overlays: [{ ...styled, font }] }, lib);
  assert.equal((await lib.PDFDocument.load(output)).getPageCount(), original.getPageCount());
}
for (const type of ['rectangle','ellipse','line','arrow','highlight','underline','strike','check','cross']) {
  const output = await lib.PDFDocument.load(await core.exportPdf(source, { overlays: [{ ...base, type, fill: '#00ff00', strokeWidth: 3, opacity: .3 }] }, lib));
  const ops = streams(output, 0);
  assert.match(ops, /\/GS-[\d]+ gs/, `${type}: graphics state applied`);
  const stateDict = output.getPage(0).node.Resources().lookup(lib.PDFName.of('ExtGState'), lib.PDFDict);
  const opacityKey = ['line','arrow','underline','strike','check','cross'].includes(type) ? 'CA' : 'ca';
  assert.ok(stateDict.values().some(state => output.context.lookup(state).get(lib.PDFName.of(opacityKey))?.asNumber() === .3), `${type}: actual opacity encoded`);
  assert.ok(ops.length > streams(original, 0).length, `${type}: drawing operators added`);
  if (['rectangle','ellipse','line','arrow','underline','strike','check','cross'].includes(type)) assert.match(ops, /3 w/, `${type}: stroke width changes output`);
  if (['rectangle','ellipse'].includes(type)) assert.match(ops, /0 1 0 rg/, `${type}: fill changes output`);
  if (type === 'ellipse') assert.match(ops, /\bc\b/, 'Ellipse curves are real');
}
for (const bad of [{ opacity: -1 }, { opacity: NaN }, { strokeWidth: 0 }, { lineSpacing: 4 }, { fill: 'invalid' }]) await assert.rejects(core.exportPdf(source, { overlays: [{ ...styled, ...bad }] }, lib));
await assert.rejects(core.exportPdf(source, { overlays: [{ ...base, type: 'ellipse', width: 8, height: 8, strokeWidth: 20 }] }, lib), /outline stays inside/);
for (const type of ['arrow','check','cross']) {
  const bounded = await lib.PDFDocument.create(); bounded.addPage([100,100]);
  const output = await lib.PDFDocument.load(await core.exportPdf(await bounded.save(), { overlays: [{ ...base, type, x: 0, y: 0, width: 24, height: 24, strokeWidth: 20 }] }, lib));
  const points = [...streams(output,0).matchAll(/([\d.]+) ([\d.]+) [ml]\b/g)];
  assert.ok(points.length > 0);
  assert.ok(points.every(([,x,y]) => Number(x)>=10 && Number(x)<=14 && Number(y)>=10 && Number(y)<=14), `${type}: thick strokes stay inside their selectable box`);
}
const a = { ...styled, text: 'FIRST' }, b = { ...styled, text: 'SECOND' };
for (const list of [[a,b],[b,a]]) {
  const out = await lib.PDFDocument.load(await core.exportPdf(source, { overlays: list }, lib));
  const ops = streams(out, 0);
  assert.ok(ops.indexOf(Buffer.from(list[0].text).toString('hex').toUpperCase()) < ops.indexOf(Buffer.from(list[1].text).toString('hex').toUpperCase()), 'Overlay array order is actual PDF paint order');
}
console.log('Advanced PDF core passed: page planning/reorder/independent duplicate rotations/blank/delete, preserved original operators/CropBox/live field trees, unsafe annotation guards, 12 fonts, text line spacing/underline/opacity, 9 shapes/marks, stroke/fill/layer order and invalid controls.');
