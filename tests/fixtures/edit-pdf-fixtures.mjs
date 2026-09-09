import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as PDFLib from 'pdf-lib';

const { PDFDocument, StandardFonts, degrees, rgb, PDFName, PDFString } = PDFLib;

async function baseDocument() {
    const doc = await PDFDocument.create();
    doc.setTitle('Synthetic Edit PDF QA fixture');
    doc.setAuthor('GXA Toolbox automated tests');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const sizes = [[612, 792], [792, 612], [612, 792], [612, 792], [1100, 360]];
    sizes.forEach((size, index) => {
        const page = doc.addPage(size);
        page.drawText(`SYNTHETIC FORM - PAGE ${index + 1}`, { x: 60, y: size[1] - 80, size: 18, font, color: rgb(0.05, 0.18, 0.5) });
        page.drawRectangle({ x: 48, y: 48, width: size[0] - 96, height: size[1] - 96, borderWidth: 1, borderColor: rgb(0.4, 0.5, 0.6) });
        page.drawText('Name: ____________________  Date: ______________', { x: 65, y: size[1] - 130, size: 12, font });
        page.drawText('These are generated fixtures. No real personal records are used.', { x: 65, y: 72, size: 9, font });
    });
    doc.getPage(2).setCropBox(24, 36, 564, 720);
    doc.getPage(2).setRotation(degrees(90));
    doc.getPage(3).setRotation(degrees(270));
    doc.getPage(4).setRotation(degrees(180));
    return doc;
}

export async function createEditPdfFixtures() {
    const flat = await baseDocument();
    const flatBytes = await flat.save({ useObjectStreams: false });
    const fillable = await PDFDocument.load(flatBytes);
    const form = fillable.getForm();
    const name = form.createTextField('fullName');
    name.setMaxLength(80);
    name.addToPage(fillable.getPage(0), { x: 110, y: 610, width: 250, height: 26, borderWidth: 1 });
    name.addToPage(fillable.getPage(2), { x: 110, y: 610, width: 250, height: 26, borderWidth: 1 });
    const details = form.createTextField('details');
    details.enableMultiline();
    details.addToPage(fillable.getPage(0), { x: 110, y: 460, width: 300, height: 100 });
    const consent = form.createCheckBox('consent');
    consent.addToPage(fillable.getPage(0), { x: 110, y: 420, width: 20, height: 20 });
    const contact = form.createRadioGroup('contactMethod');
    contact.addOptionToPage('Email', fillable.getPage(0), { x: 110, y: 380, width: 18, height: 18 });
    contact.addOptionToPage('Post', fillable.getPage(0), { x: 220, y: 380, width: 18, height: 18 });
    const region = form.createDropdown('region');
    region.addOptions(['North', 'South', 'East', 'West']);
    region.select('North');
    region.addToPage(fillable.getPage(1), { x: 150, y: 370, width: 220, height: 28 });
    const rotated = form.createTextField('rotatedNote');
    rotated.addToPage(fillable.getPage(3), { x: 120, y: 420, width: 230, height: 24 });
    const fillableBytes = await fillable.save({ useObjectStreams: false });

    const restricted = await PDFDocument.load(fillableBytes);
    const restrictedForm = restricted.getForm();
    const locked = restrictedForm.createTextField('readOnly');
    locked.setText('Original locked value');
    locked.enableReadOnly();
    locked.addToPage(restricted.getPage(1), { x: 140, y: 300, width: 240, height: 24 });
    const button = restrictedForm.createButton('originalAction');
    button.addToPage('Original button', restricted.getPage(1), { x: 140, y: 250, width: 180, height: 24 });

    const xfa = await PDFDocument.load(fillableBytes);
    xfa.catalog.lookup(PDFName.of('AcroForm')).set(PDFName.of('XFA'), PDFString.of('<synthetic-xfa/>'));

    const duplicates = await PDFDocument.load(fillableBytes);
    duplicates.getForm().getTextField('details').acroField.setPartialName('fullName');

    const transformed = await PDFDocument.load(fillableBytes);
    const transformedWidgets = transformed.getForm().getTextField('fullName').acroField.getWidgets();
    const firstAppearance = transformed.context.lookup(transformedWidgets[0].getNormalAppearance());
    firstAppearance.dict.set(PDFName.of('BBox'), transformed.context.obj([0, 0, 502, 54]));
    firstAppearance.dict.set(PDFName.of('Matrix'), transformed.context.obj([0, 1, -1, 0, 54, 0]));
    // The second widget exercises translated non-zero appearance origins.
    const secondAppearance = transformed.context.lookup(transformedWidgets[1].getNormalAppearance());
    secondAppearance.dict.set(PDFName.of('BBox'), transformed.context.obj([10, 20, 261, 47]));
    secondAppearance.dict.set(PDFName.of('Matrix'), transformed.context.obj([1, 0, 0, 1, 7, 9]));

    const coded = await PDFDocument.load(fillableBytes);
    const codedRegion = coded.getForm().getDropdown('region');
    codedRegion.acroField.setOptions([{ value: PDFString.of('N'), display: PDFString.of('North') }, { value: PDFString.of('S'), display: PDFString.of('South') }]);
    codedRegion.acroField.dict.set(PDFName.of('V'), PDFString.of('N'));

    const widgetRotated = await PDFDocument.load(fillableBytes);
    const rotationField = widgetRotated.getForm().createTextField('widgetRotation');
    rotationField.setText('Rotated widget');
    for (const rotation of [90, 180, 270]) {
        rotationField.addToPage(widgetRotated.getPage(0), { x: 420, y: 260 + rotation / 3, width: 100, height: 20, rotate: degrees(rotation) });
        rotationField.addToPage(widgetRotated.getPage(2), { x: 420, y: 260 + rotation / 3, width: 100, height: 20, rotate: degrees(rotation) });
    }
    const userUnit = await PDFDocument.load(flatBytes);
    userUnit.getPage(0).node.set(PDFName.of('UserUnit'), userUnit.context.obj(2));

    return {
        'flat-multipage.pdf': flatBytes,
        'fillable-form.pdf': fillableBytes,
        'restricted-fields.pdf': await restricted.save({ useObjectStreams: false }),
        'xfa-form.pdf': await xfa.save({ useObjectStreams: false, updateFieldAppearances: false }),
        'duplicate-fields.pdf': await duplicates.save({ useObjectStreams: false, updateFieldAppearances: false }),
        'transformed-appearances.pdf': await transformed.save({ useObjectStreams: false, updateFieldAppearances: false }),
        'coded-dropdown.pdf': await coded.save({ useObjectStreams: false, updateFieldAppearances: false }),
        'rotated-widgets.pdf': await widgetRotated.save({ useObjectStreams: false }),
        'user-unit.pdf': await userUnit.save({ useObjectStreams: false }),
        'corrupt.pdf': new TextEncoder().encode('%PDF-1.7\nInvalid synthetic PDF bytes'),
        'empty.pdf': new Uint8Array(),
        'encrypted.pdf': new Uint8Array(await readFile(new URL('encrypted-password.pdf', import.meta.url))),
        'image.png': new Uint8Array(await readFile(new URL('landscape.png', import.meta.url)))
    };
}

// Optional explicit fixture generation for local browser QA. Normal tests stay in memory.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href && process.argv.includes('--write')) {
    const directory = fileURLToPath(new URL('../../test-results/edit-pdf-fixtures/', import.meta.url));
    await mkdir(directory, { recursive: true });
    const fixtures = await createEditPdfFixtures();
    for (const [name, bytes] of Object.entries(fixtures)) await writeFile(resolve(directory, name), bytes);
    console.log(`Wrote ${Object.keys(fixtures).length} synthetic Edit PDF fixtures to ${directory}`);
}
