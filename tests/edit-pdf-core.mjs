import assert from 'node:assert/strict';
import * as PDFLib from 'pdf-lib';
import { createEditPdfFixtures } from './fixtures/edit-pdf-fixtures.mjs';
import '../public_html/assets/pdf-edit-core.js';

const core = globalThis.GxaPdfEditCore;
const { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } = PDFLib;
const fixtures = await createEditPdfFixtures();
const source = fixtures['fillable-form.pdf'];
const sourceBeforeExport = source.slice();
const info = await core.inspect(source, PDFLib);
assert.equal(info.pages.length, 5);
assert.deepEqual(info.pages.map(page => page.rotation), [0, 0, 90, 270, 180]);
assert.deepEqual(info.pages[2].viewBox, [24, 36, 588, 756]);
assert.deepEqual(info.pages.map(page => page.transform.map(value => value || 0)), [[1, 0, 0, -1, 0, 792], [1, 0, 0, -1, 0, 612], [0, 1, 1, 0, -36, -24], [0, -1, -1, 0, 792, 612], [-1, 0, 0, 1, 1100, 0]], 'Scale-one visual transforms match PDF page viewport conventions.');
assert.deepEqual(core.pdfToVisual(info.pages[2], 24, 36), [0, 0]);
assert.deepEqual(core.pdfToVisual(info.pages[2], 588, 756), [720, 564]);
assert.deepEqual(core.visualToPdf(info.pages[2], 100, 200), [224, 136]);
assert.deepEqual(info.fields.map(field => field.type), ['text', 'text', 'checkbox', 'radio', 'dropdown', 'text']);
assert.deepEqual(info.fields.find(field => field.name === 'fullName').widgets.map(widget => widget.pageIndex), [0, 2]);
assert.equal(info.fields.find(field => field.name === 'details').multiline, true);
assert.equal(info.fields.find(field => field.name === 'fullName').maxLength, 80);
assert.deepEqual(info.fields.find(field => field.name === 'contactMethod').widgets.map(widget => widget.option), ['Email', 'Post']);
assert.deepEqual(info.fields.find(field => field.name === 'region').options, ['North', 'South', 'East', 'West']);
assert.equal(info.canFlatten, true);

function sameGeometry(actual, expected) {
    assert.equal(actual.getPageCount(), expected.getPageCount());
    actual.getPages().forEach((page, index) => {
        const original = expected.getPage(index);
        assert.deepEqual(page.getMediaBox(), original.getMediaBox());
        assert.deepEqual(page.getCropBox(), original.getCropBox());
        assert.deepEqual(page.getRotation(), original.getRotation());
    });
}

function pageStreams(doc, pageIndex) {
    const contents = doc.getPage(pageIndex).node.Contents();
    const entries = contents?.asArray ? contents.asArray() : contents ? [contents] : [];
    return entries.map(ref => {
        const stream = doc.context.lookup(ref);
        if (stream instanceof PDFRawStream) return Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
        return stream.getContentsString();
    });
}

async function assertTextFieldAppearanceFits(doc, fieldName) {
    const field = doc.getForm().getTextField(fieldName);
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const results = [];
    for (const widget of field.acroField.getWidgets()) {
        const appearance = doc.context.lookup(widget.getNormalAppearance());
        const stream = Buffer.from(decodePDFRawStream(appearance).decode()).toString('latin1');
        const size = Number([...stream.matchAll(/\/Helvetica ([\d.]+) Tf/g)].at(-1)?.[1]);
        assert.ok(size >= 6 && size <= 24, 'Changed field text uses a readable fitted appearance size.');
        const rect = widget.getRectangle();
        const rotation = widget.getAppearanceCharacteristics()?.getRotation() || 0;
        const width = rotation % 180 ? rect.height : rect.width;
        const height = rotation % 180 ? rect.width : rect.height;
        const inset = (widget.getBorderStyle()?.getWidth() || 0) + (field.isCombed() ? 0 : 1);
        const lines = [...stream.matchAll(/1 0 0 1 ([-\d.]+) ([-\d.]+) Tm\s*<([0-9A-F]*)> Tj/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]), text: Buffer.from(match[3], 'hex').toString('latin1') }));
        assert.ok(lines.length > 0, 'The actual appearance stream contains visible text operations.');
        for (const line of lines) {
            const descent = font.heightAtSize(size) - font.heightAtSize(size, { descender: false });
            assert.ok(line.x >= inset - .01 && line.y - descent >= inset - .01, 'Actual text, including descenders, remains inside the original field.');
            assert.ok(line.x + font.widthOfTextAtSize(line.text, size) <= width - inset + .01, 'Actual glyph widths fit without horizontal clipping.');
            assert.ok(line.y + font.heightAtSize(size, { descender: false }) <= height - inset + .01, 'Actual glyph ascenders fit without vertical clipping.');
        }
        results.push({ fontSize: size, lines, stream });
    }
    return results;
}

const fieldValues = { fullName: 'Synthetic Test User', details: 'Line one\nLine two', consent: true, contactMethod: 'Post', region: 'South', rotatedNote: 'Rotated note' };
const edited = await core.exportPdf(source, { fieldValues, overlays: [], flatten: false }, PDFLib);
assert.equal(Buffer.from(edited.subarray(0, 5)).toString(), '%PDF-');
const editedDoc = await PDFDocument.load(edited);
const originalDoc = await PDFDocument.load(source);
sameGeometry(editedDoc, originalDoc);
const editedForm = editedDoc.getForm();
assert.equal(editedForm.getTextField('fullName').getText(), fieldValues.fullName);
assert.equal(editedForm.getTextField('details').getText(), fieldValues.details);
assert.equal(editedForm.getCheckBox('consent').isChecked(), true);
assert.equal(editedForm.getRadioGroup('contactMethod').getSelected(), 'Post');
assert.deepEqual(editedForm.getDropdown('region').getSelected(), ['South']);
assert.equal(editedForm.getTextField('rotatedNote').getText(), 'Rotated note');
assert.equal(editedForm.getTextField('fullName').acroField.getWidgets().length, 2);
await assertTextFieldAppearanceFits(editedDoc, 'fullName');
await assertTextFieldAppearanceFits(editedDoc, 'details');

// Regression: blank form /DA can contain a huge font. Values alone passing does not
// prove the exported appearance is readable; inspect real AP text/font coordinates.
const twoLines = 'First synthetic line\nSecond synthetic line';
const readableOutput = await PDFDocument.load(await core.exportPdf(source, { fieldValues: { details: twoLines } }, PDFLib));
const readableAppearances = await assertTextFieldAppearanceFits(readableOutput, 'details');
assert.deepEqual(readableAppearances[0].lines.map(line => line.text), twoLines.split('\n'));
assert.equal(readableAppearances[0].fontSize, 12, 'An oversized blank-field default must not produce giant clipped text.');
const twelveLines = Array.from({ length: 12 }, (_, index) => `Synthetic line ${index + 1}`).join('\n');
const reducedOutput = await PDFDocument.load(await core.exportPdf(source, { fieldValues: { details: twelveLines } }, PDFLib));
const reducedAppearance = (await assertTextFieldAppearanceFits(reducedOutput, 'details'))[0];
assert.equal(reducedAppearance.lines.length, 12);
assert.ok(reducedAppearance.fontSize < 12 && reducedAppearance.fontSize >= 6, 'Multiline overflow reduces size until all lines fit.');
const sensibleSource = await PDFDocument.load(source);
sensibleSource.getForm().getTextField('details').setFontSize(9);
const sensibleOutput = await PDFDocument.load(await core.exportPdf(await sensibleSource.save(), { fieldValues: { details: twoLines } }, PDFLib));
assert.equal((await assertTextFieldAppearanceFits(sensibleOutput, 'details'))[0].fontSize, 9, 'A sensible original font size is respected when it fits.');
const smallWidgetSource = await PDFDocument.load(source);
const secondaryWidget = smallWidgetSource.getForm().getTextField('fullName').acroField.getWidgets()[1];
secondaryWidget.setRectangle({ ...secondaryWidget.getRectangle(), width: 80, height: 14 });
const smallWidgetOutput = await PDFDocument.load(await core.exportPdf(await smallWidgetSource.save({ updateFieldAppearances: false }), { fieldValues: { fullName: 'Fits smaller widget' } }, PDFLib));
const widgetSizes = await assertTextFieldAppearanceFits(smallWidgetOutput, 'fullName');
assert.equal(widgetSizes.length, 2);
assert.ok(widgetSizes[1].fontSize < widgetSizes[0].fontSize, 'Every differently sized widget fits the same field value independently.');
await assert.rejects(core.exportPdf(source, { fieldValues: { details: 'PRIVATE-LONG-VALUE\n'.repeat(80) } }, PDFLib), error => /cannot fit at a readable size/.test(error.message) && !error.message.includes('PRIVATE-LONG-VALUE'));

const reInspected = await core.inspect(edited, PDFLib);
for (const field of info.fields) {
    const out = reInspected.fields.find(item => item.name === field.name);
    assert.deepEqual(out.widgets, field.widgets, `Original widget positions remain unchanged for ${field.name}.`);
}

// Turning controls off and clearing selection must export actual empty field values.
const cleared = await PDFDocument.load(await core.exportPdf(edited, { fieldValues: { consent: false, contactMethod: '', region: '' } }, PDFLib));
assert.equal(cleared.getForm().getCheckBox('consent').isChecked(), false);
assert.equal(cleared.getForm().getRadioGroup('contactMethod').getSelected(), undefined);
assert.deepEqual(cleared.getForm().getDropdown('region').getSelected(), []);
const codedInfo = await core.inspect(fixtures['coded-dropdown.pdf'], PDFLib);
assert.equal(codedInfo.fields.find(field => field.name === 'region').value, 'North');
const codedOutput = await core.exportPdf(fixtures['coded-dropdown.pdf'], { fieldValues: { region: 'South' } }, PDFLib);
const codedDocument = await PDFDocument.load(codedOutput);
assert.deepEqual(codedDocument.getForm().getDropdown('region').getSelected(), ['S'], 'The original export code is saved instead of replacing it with a display label.');
assert.equal((await core.inspect(codedOutput, PDFLib)).fields.find(field => field.name === 'region').value, 'South');

const widgetRotationInfo = await core.inspect(fixtures['rotated-widgets.pdf'], PDFLib);
const rotationWidgets = widgetRotationInfo.fields.find(field => field.name === 'widgetRotation').widgets;
assert.deepEqual(rotationWidgets.map(widget => widget.rotation), [90, 90, 180, 180, 270, 270]);
for (const widget of rotationWidgets) {
    const view = core.widgetViewport(widgetRotationInfo.pages[widget.pageIndex], widget);
    assert.equal(view.width, widget.rect[widget.rotation % 180 ? 3 : 2]);
    assert.equal(view.height, widget.rect[widget.rotation % 180 ? 2 : 3]);
    const [a, b, c, d, e, f] = view.transform;
    const corners = [[0, 0], [view.width, 0], [0, view.height], [view.width, view.height]].map(([x, y]) => core.visualToPdf(widgetRotationInfo.pages[widget.pageIndex], a * x + c * y + e, b * x + d * y + f));
    assert.equal(Math.min(...corners.map(point => point[0])), widget.rect[0]);
    assert.equal(Math.min(...corners.map(point => point[1])), widget.rect[1]);
    assert.equal(Math.max(...corners.map(point => point[0])), widget.rect[0] + widget.rect[2]);
    assert.equal(Math.max(...corners.map(point => point[1])), widget.rect[1] + widget.rect[3]);
}
assert.deepEqual(core.widgetViewport(info.pages[0], { rect: [100, 200, 20, 100], rotation: 90 }), { width: 100, height: 20, transform: [0, -1, 1, 0, 100, 592] });
const rotationOutput = await core.exportPdf(fixtures['rotated-widgets.pdf'], { fieldValues: { widgetRotation: 'Changed rotation' } }, PDFLib);
const rotationOutputInfo = await core.inspect(rotationOutput, PDFLib);
assert.deepEqual(rotationOutputInfo.fields.find(field => field.name === 'widgetRotation').widgets, rotationWidgets);
const rotationFlattened = await PDFDocument.load(await core.exportPdf(fixtures['rotated-widgets.pdf'], { fieldValues: { widgetRotation: 'Changed rotation' }, flatten: true }, PDFLib));
assert.equal(rotationFlattened.getForm().getFields().length, 0);
sameGeometry(rotationFlattened, await PDFDocument.load(fixtures['rotated-widgets.pdf']));
const unitOutput = await PDFDocument.load(await core.exportPdf(fixtures['user-unit.pdf'], { overlays: [{ type: 'text', pageIndex: 0, x: 60, y: 100, width: 200, height: 50, text: 'User unit preserved', fontSize: 16 }] }, PDFLib));
assert.equal(unitOutput.getPage(0).node.lookup(PDFName.of('UserUnit')).asNumber(), 2, 'Export preserves physical user-space scaling.');

const flattenedDoc = await PDFDocument.load(await core.exportPdf(source, { fieldValues, overlays: [], flatten: true }, PDFLib));
assert.equal(flattenedDoc.getForm().getFields().length, 0);
sameGeometry(flattenedDoc, originalDoc);
assert.match(pageStreams(flattenedDoc, 0).join('\n'), /FlatWidget/, 'Flattened field appearances are placed onto the original page.');
for (const page of flattenedDoc.getPages()) assert.equal(page.node.Annots()?.size() || 0, 0, 'Flatten removes widget annotation refs as well as the AcroForm fields.');
const transformedSource = fixtures['transformed-appearances.pdf'];
const transformedFlat = await PDFDocument.load(await core.exportPdf(transformedSource, { flatten: true }, PDFLib));
const transformedOriginal = await PDFDocument.load(transformedSource);
const transformedWidgets = transformedOriginal.getForm().getTextField('fullName').acroField.getWidgets();
const [firstRect, secondRect] = transformedWidgets.map(widget => widget.getRectangle());
const flattenMatrices = pageIndex => [...pageStreams(transformedFlat, pageIndex).join('\n').matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)].map(match => match.slice(1).map(Number));
const firstExpected = [firstRect.width / 54, 0, 0, firstRect.height / 502, firstRect.x, firstRect.y];
const secondExpected = [1, 0, 0, 1, secondRect.x - 17, secondRect.y - 29];
assert.ok(flattenMatrices(0).some(matrix => matrix.every((value, index) => Math.abs(value - firstExpected[index]) < 1e-8)), 'Flatten correctly maps a rotated/scaled appearance BBox to the widget Rect.');
assert.ok(flattenMatrices(2).some(matrix => matrix.every((value, index) => Math.abs(value - secondExpected[index]) < 1e-8)), 'Flatten correctly maps non-zero appearance origins.');

const flatSource = fixtures['flat-multipage.pdf'];
const flatInfo = await core.inspect(flatSource, PDFLib);
assert.equal(flatInfo.fields.length, 0);
const flatDoc = await PDFDocument.load(flatSource);
const overlays = flatInfo.pages.map((page, pageIndex) => ({ id: `text-${pageIndex}`, type: 'text', pageIndex, x: 68, y: 95, width: 240, height: 70, font: 'Helvetica', fontSize: 16, text: `Overlay page ${pageIndex + 1}`, color: '#224488', align: 'left' }));
overlays.push({ id: 'check', type: 'check', pageIndex: 0, x: 60, y: 200, width: 22, height: 22 });
overlays.push({ id: 'cross', type: 'cross', pageIndex: 1, x: 60, y: 220, width: 22, height: 22 });
overlays.push({ id: 'rect', type: 'rectangle', pageIndex: 2, x: 60, y: 240, width: 100, height: 32 });
overlays.push({ id: 'image', type: 'image', pageIndex: 3, x: 100, y: 250, width: 120, height: 80, imageBytes: fixtures['image.png'], imageType: 'image/png' });
const overlayDoc = await PDFDocument.load(await core.exportPdf(flatSource, { overlays }, PDFLib));
sameGeometry(overlayDoc, flatDoc);
for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    const streams = pageStreams(overlayDoc, pageIndex);
    for (const originalStream of pageStreams(flatDoc, pageIndex)) assert.ok(streams.includes(originalStream), 'Original artwork streams are unchanged.');
    const added = streams.filter(stream => !pageStreams(flatDoc, pageIndex).includes(stream)).join('\n');
    assert.ok(added.includes(Buffer.from(`Overlay page ${pageIndex + 1}`).toString('hex').toUpperCase()), 'Each page keeps its own text overlay.');
    const overlay = overlays[pageIndex];
    const view = flatInfo.pages[pageIndex];
    const origin = core.visualToPdf(view, overlay.x, overlay.y + overlay.height);
    const nextX = core.visualToPdf(view, overlay.x + 1, overlay.y + overlay.height);
    const nextY = core.visualToPdf(view, overlay.x, overlay.y + overlay.height - 1);
    const expectedMatrix = [nextX[0] - origin[0], nextX[1] - origin[1], nextY[0] - origin[0], nextY[1] - origin[1], ...origin];
    const matrices = [...added.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)].map(match => match.slice(1).map(Number));
    assert.ok(matrices.some(matrix => matrix.every((value, index) => Math.abs(value - expectedMatrix[index]) < 1e-9)), 'Export uses the expected inverse visual transform, including CropBox and rotation.');
    for (const scale of [0.25, 0.48, 1, 1.75, 2.25]) {
        const screen = [overlay.x * scale, overlay.y * scale];
        const pdfPoint = core.visualToPdf(view, screen[0] / scale, screen[1] / scale);
        const roundTrip = core.pdfToVisual(view, ...pdfPoint);
        assert.ok(roundTrip.every((value, index) => Math.abs(value - [overlay.x, overlay.y][index]) < 1e-9));
    }
}
assert.match(pageStreams(overlayDoc, 0).join('\n'), /\bl\nS\b/, 'Checkmark uses real vector strokes.');
assert.match(pageStreams(overlayDoc, 1).join('\n'), /\bl\nS\b/, 'Cross uses real vector strokes.');
assert.ok(overlayDoc.getPage(3).node.Resources().lookup(PDFName.of('XObject')).keys().length > 0, 'Uploaded image is embedded as an image object.');

// Text updates, drag position, size, alignment and deletion are state changes exported by the same engine.
const moved = { ...overlays[0], text: 'Updated text', x: 140, y: 210, width: 280, height: 80, font: 'TimesRoman', fontSize: 22, align: 'right' };
const movedDoc = await PDFDocument.load(await core.exportPdf(flatSource, { overlays: [moved] }, PDFLib));
const movedStream = pageStreams(movedDoc, 0).join('\n');
assert.ok(movedStream.includes(Buffer.from('Updated text').toString('hex').toUpperCase()));
assert.ok(!movedStream.includes(Buffer.from('Overlay page 1').toString('hex').toUpperCase()));
assert.match(movedStream, /22 Tf/);
const deletedDoc = await PDFDocument.load(await core.exportPdf(flatSource, { overlays: [] }, PDFLib));
assert.ok(!pageStreams(deletedDoc, 0).join('\n').includes(Buffer.from('Updated text').toString('hex').toUpperCase()));

for (const font of ['Helvetica', 'TimesRoman', 'Courier', 'TimesRomanItalic']) {
    const layout = await core.layoutText('A long line that wraps predictably\nSecond paragraph', { font, fontSize: 12, width: 120, height: 150, align: 'center' }, PDFLib);
    assert.ok(layout.lines.length > 2);
    assert.equal(layout.overflow, false);
    for (const line of layout.lines) assert.ok(Math.abs(line.x - (120 - line.width) / 2) < 1e-9);
}
assert.equal((await core.layoutText('First\nSecond\nThird', { fontSize: 16, width: 120, height: 24 }, PDFLib)).overflow, true);

const restrictedInfo = await core.inspect(fixtures['restricted-fields.pdf'], PDFLib);
assert.equal(restrictedInfo.canFlatten, false);
assert.equal(restrictedInfo.fields.find(field => field.name === 'readOnly').readOnly, true);
assert.equal(restrictedInfo.fields.find(field => field.name === 'originalAction').type, 'unsupported');
const kept = await PDFDocument.load(await core.exportPdf(fixtures['restricted-fields.pdf'], { fieldValues: { fullName: 'Changed supported value' }, overlays: [] }, PDFLib));
assert.equal(kept.getForm().getTextField('readOnly').getText(), 'Original locked value');
assert.ok(kept.getForm().getButton('originalAction'));
await assert.rejects(core.exportPdf(fixtures['restricted-fields.pdf'], { flatten: true }, PDFLib), /unsupported or read-only/);
await assert.rejects(core.exportPdf(fixtures['restricted-fields.pdf'], { fieldValues: { readOnly: 'do not change' } }, PDFLib), /read-only/);

for (const [fixture, expected] of [['empty.pdf', /empty/], ['corrupt.pdf', /corrupt|read|structure/], ['encrypted.pdf', /encrypted|password/], ['xfa-form.pdf', /XFA/], ['duplicate-fields.pdf', /duplicate field/]]) {
    await assert.rejects(core.inspect(fixtures[fixture], PDFLib), expected, fixture);
    await assert.rejects(core.exportPdf(fixtures[fixture], { overlays: [] }, PDFLib), expected, fixture);
}
await assert.rejects(core.inspect(new TextEncoder().encode('not a pdf'), PDFLib), /header/);
await assert.rejects(core.inspect(new Uint8Array(core.MAX_BYTES + 1), PDFLib), /25 MB/);
await assert.rejects(core.exportPdf(source, { fieldValues: { missing: 'private value' } }, PDFLib), /no longer matches/);
await assert.rejects(core.exportPdf(source, { fieldValues: { region: 'unlisted private option' } }, PDFLib), /existing option/);
await assert.rejects(core.exportPdf(source, { fieldValues: { consent: 'yes' } }, PDFLib), /checked or unchecked/);
await assert.rejects(core.exportPdf(source, { fieldValues: { fullName: 'a'.repeat(81) } }, PDFLib), /length limit/);
await assert.rejects(core.exportPdf(source, { fieldValues: { fullName: 'Line\nLine' } }, PDFLib), /single-line/);
await assert.rejects(core.exportPdf(flatSource, { overlays: [{ ...overlays[0], x: 9000 }] }, PDFLib), /outside the page/);
await assert.rejects(core.exportPdf(flatSource, { overlays: [{ ...overlays[0], text: 'PRIVATE-SECRET-हिन्दी' }] }, PDFLib), error => /characters not supported/.test(error.message) && !error.message.includes('PRIVATE-SECRET'));
await assert.rejects(core.exportPdf(flatSource, { overlays: [{ ...overlays[0], text: 'Long text\n'.repeat(20), height: 20 }] }, PDFLib), /does not fit/);
await assert.rejects(core.exportPdf(flatSource, { overlays: [{ ...overlays[0], type: 'image', imageType: 'image/png', imageBytes: new Uint8Array([1, 2, 3]) }] }, PDFLib), /valid PNG or JPEG/);
assert.equal(Buffer.from(source).equals(Buffer.from(sourceBeforeExport)), true, 'Export must not mutate source bytes.');

console.log(`Edit PDF core passed: ${info.fields.length} fields, 5 original pages, 4 rotations, CropBox, five zoom scales, editable/flattened AcroForm values, overlay/image exports, validation and privacy-safe errors.`);
