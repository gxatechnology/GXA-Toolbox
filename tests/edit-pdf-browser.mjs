// Optional real-browser QA; requires Playwright, but adds no production dependency.
// Run after generate:seo. All inputs are synthetic; Google tags are blocked in this test only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { createEditPdfFixtures } from './fixtures/edit-pdf-fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const output = resolve('test-results/edit-pdf-browser');
await mkdir(output, { recursive: true });
const fixtures = await createEditPdfFixtures();
const browser = await chromium.launch({ headless: true, ...(process.env.GXA_BROWSER_EXECUTABLE ? { executablePath: process.env.GXA_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, hasTouch: true });
// Prevent local QA from sending real analytics or ad impressions. Production sources are untouched.
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(15000);
const failures = [];
page.on('pageerror', error => failures.push(error.message));
page.on('dialog', dialog => dialog.accept());
const upload = async name => {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a PDF', exact: true }).click();
  await (await chooserPromise).setFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from(fixtures[name]) });
  await page.waitForFunction(() => document.querySelector('#edit-pdf-mount')?.getAttribute('aria-busy') === 'false');
  const message = await page.locator('#pdf-edit-status').innerText();
  assert.doesNotMatch(message, /could not|unavailable|failed/i);
};
const filledDownload = async filename => {
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Edited PDF', exact: true }).click();
  const download = await downloadWait;
  assert.equal(await download.failure(), null);
  const path = resolve(output, filename);
  await download.saveAs(path);
  return { path, doc: await PDFDocument.load(await readFile(path)) };
};
const pageContents = (doc, index) => doc.getPage(index).node.Contents().asArray().map(ref => {
  const stream = doc.context.lookup(ref);
  return stream instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1') : stream.getContentsString();
}).join('\n');
const assertText = (doc, index, text) => assert.ok(pageContents(doc, index).includes(Buffer.from(text).toString('hex').toUpperCase()), `Page ${index + 1} contains ${text}`);
const addText = async (text, x, y) => {
  await page.getByRole('button', { name: 'Add Text', exact: true }).click();
  await page.getByRole('button', { name: 'Add at page center', exact: true }).click();
  await page.locator('[data-property="text"]').fill(text);
  await page.locator('[data-property="x"]').fill(String(x));
  await page.locator('[data-property="y"]').fill(String(y));
};
try {
  assert.equal((await page.goto(`${origin}/edit-pdf/`)).status(), 200);
  await upload('fillable-form.pdf');
  console.log('Synthetic form loaded in Chromium.');
  await page.getByLabel('fullName', { exact: true }).fill('Synthetic Browser User');
  await page.getByLabel('details', { exact: true }).fill('First synthetic line\nSecond synthetic line');
  await page.getByLabel('consent', { exact: true }).check();
  await page.getByLabel('contactMethod', { exact: true }).selectOption('Post');
  assert.equal(await page.getByLabel('fullName on PDF page', { exact: true }).inputValue(), 'Synthetic Browser User');
  await page.getByRole('button', { name: 'Go to PDF page 2', exact: true }).click();
  await page.getByLabel('region', { exact: true }).selectOption('South');
  await page.getByRole('button', { name: 'Go to PDF page 4', exact: true }).click();
  await page.getByLabel('rotatedNote', { exact: true }).fill('Rotated browser field');
  await page.getByRole('button', { name: 'Go to PDF page 1', exact: true }).click();
  await page.locator('.pdf-edit-grid').screenshot({ path: resolve(output, 'desktop-form-edit.png') });
  await page.getByRole('button', { name: 'Preview Edited PDF', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.pdf-edit-grid')?.classList.contains('is-preview'));
  await page.locator('.pdf-edit-grid').screenshot({ path: resolve(output, 'desktop-form-output.png') });
  const editable = await filledDownload('editable-form.pdf');
  assert.equal(editable.doc.getPageCount(), 5);
  assert.equal(editable.doc.getForm().getTextField('fullName').getText(), 'Synthetic Browser User');
  assert.equal(editable.doc.getForm().getTextField('details').getText(), 'First synthetic line\nSecond synthetic line');
  assert.equal(editable.doc.getForm().getCheckBox('consent').isChecked(), true);
  assert.equal(editable.doc.getForm().getRadioGroup('contactMethod').getSelected(), 'Post');
  assert.deepEqual(editable.doc.getForm().getDropdown('region').getSelected(), ['South']);
  assert.equal(editable.doc.getForm().getTextField('rotatedNote').getText(), 'Rotated browser field');
  fixtures['reopened-form.pdf'] = await readFile(editable.path);
  await upload('reopened-form.pdf');
  assert.equal(await page.getByLabel('fullName', { exact: true }).inputValue(), 'Synthetic Browser User');
  await page.getByLabel('Filled form output').selectOption('flatten');
  const flattened = await filledDownload('flattened-form.pdf');
  assert.equal(flattened.doc.getForm().getFields().length, 0);
  assert.equal(flattened.doc.getPageCount(), 5);
  console.log('Browser form upload/fill/editable download/reopen/flatten passed.');

  await upload('flat-multipage.pdf');
  await addText('Synthetic overlay answer', 110, 118);
  await page.locator('[data-property="fontSize"]').fill('16');
  await page.locator('[data-property="font"]').selectOption('TimesRoman');
  await page.locator('[data-property="color"]').fill('#224488');
  await page.getByRole('button', { name: 'Date', exact: true }).click();
  await page.getByRole('button', { name: 'Add at page center', exact: true }).click();
  await page.locator('[data-property="text"]').fill('2026-09-06');
  await page.locator('[data-property="x"]').fill('360');
  await page.locator('[data-property="y"]').fill('118');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.getByRole('button', { name: 'Add at page center', exact: true }).click();
  await page.locator('[data-property="x"]').fill('70');
  await page.locator('[data-property="y"]').fill('190');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Go to PDF page 3', exact: true }).click();
  await addText('Separate page three answer', 100, 140);
  await page.getByRole('button', { name: 'Cross', exact: true }).click();
  await page.getByRole('button', { name: 'Add at page center', exact: true }).click();
  await page.getByRole('button', { name: 'Delete selected element', exact: true }).click();
  await page.getByRole('button', { name: 'Go to PDF page 1', exact: true }).click();
  await page.locator('[data-overlay]').first().click();
  assert.equal(await page.locator('[data-property="text"]').inputValue(), 'Synthetic overlay answer');
  const position = async () => Promise.all(['x','y','width','height'].map(key => page.locator(`[data-property="${key}"]`).inputValue()));
  const beforeZoom = await position();
  for (const name of ['100%', 'Zoom in', 'Zoom out', 'Fit Width', 'Fit Page']) {
    await page.getByRole('button', { name, exact: true }).click();
    assert.deepEqual(await position(), beforeZoom, `Zoom action ${name} does not move PDF coordinates`);
  }
  await page.getByRole('button', { name: 'Fit Width', exact: true }).click();
  for (const width of [320, 360, 375, 390, 412, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.waitForFunction(() => {
      const viewport = document.querySelector('.pdf-edit-viewport');
      const stage = document.querySelector('.pdf-edit-page');
      return Math.abs(stage.getBoundingClientRect().width - Math.min(1.5, (viewport.clientWidth - 24) / 612) * 612) < 1;
    });
    const layout = await page.evaluate(() => ({
      width: innerWidth, pageWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      toolbarOverflow: document.querySelector('.pdf-edit-toolbar').scrollWidth > document.querySelector('.pdf-edit-toolbar').clientWidth,
      fieldWidth: document.querySelector('[data-property="text"]').getBoundingClientRect().width
    }));
    assert.ok(layout.pageWidth <= width + 1, `No body overflow at ${width}: ${JSON.stringify(layout)}`);
    assert.equal(layout.toolbarOverflow, false);
    assert.ok(layout.fieldWidth >= 180);
    await page.locator('[data-property="text"]').fill('Synthetic overlay answer');
    await page.locator('.pdf-edit-page').evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: resolve(output, `editor-${width}.png`) });
    console.log(`Responsive editor ${width}px: no overflow, text properties usable.`);
  }
  // Real pointer drag with touch events on a phone-sized viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fit Width', exact: true }).click();
  await page.waitForFunction(() => Math.abs(document.querySelector('.pdf-edit-page').getBoundingClientRect().width - (document.querySelector('.pdf-edit-viewport').clientWidth - 24)) < 1);
  await page.locator('[data-overlay]').first().click();
  const objectBox = await page.locator('[data-overlay]').first().boundingBox();
  const session = await context.newCDPSession(page);
  const point = { x: objectBox.x + 8, y: objectBox.y + 8 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  await page.waitForTimeout(50);
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 8, y: point.y + 6, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  await page.waitForTimeout(50);
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 24, y: point.y + 18, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  await page.waitForTimeout(50);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => Number(document.querySelector('[data-property="x"]').value) > 110);
  const dragged = await position();
  assert.ok(Number(dragged[0]) > 110 && Number(dragged[1]) > 118);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('[data-overlay]').first().click();
  assert.equal(Number((await position())[0]), 110);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.locator('[data-overlay]').first().click();
  assert.deepEqual(await position(), dragged);
  // Upload an actual image through the visible button and native file picker.
  const imageChooserWait = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Image / signature image', exact: true }).click();
  await (await imageChooserWait).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(fixtures['image.png']) });
  await page.getByRole('button', { name: 'Add at page center', exact: true }).click();
  await page.locator('[data-property="width"]').fill('2000');
  await page.locator('[data-property="width"]').press('Tab');
  const imageSize = await position();
  assert.ok(Number(imageSize[2]) <= 612 && Number(imageSize[3]) <= 792, 'Image remains bounded');
  await page.locator('[data-property="width"]').fill('120');
  await page.locator('[data-property="y"]').fill('550');
  await page.getByRole('button', { name: 'Draw signature', exact: true }).click();
  const pad = await page.locator('#pdf-edit-signature-pad').boundingBox();
  await page.mouse.move(pad.x + 20, pad.y + 30);
  await page.mouse.down();
  await page.mouse.move(pad.x + 55, pad.y + 65, { steps: 8 });
  await page.mouse.move(pad.x + 95, pad.y + 20, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Use signature', exact: true }).click();
  await page.getByRole('button', { name: 'Add at page center', exact: true }).click();
  await page.locator('[data-property="y"]').fill('450');
  await page.getByRole('button', { name: 'Type signature', exact: true }).click();
  await page.getByRole('button', { name: 'Add at page center', exact: true }).click();
  await page.locator('[data-property="text"]').fill('Synthetic Signer');
  await page.locator('[data-property="y"]').fill('400');
  await page.getByRole('button', { name: 'Preview Edited PDF', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.pdf-edit-grid')?.classList.contains('is-preview'));
  await page.locator('.pdf-edit-grid').screenshot({ path: resolve(output, 'mobile-flat-output.png') });
  const flat = await filledDownload('flat-overlays.pdf');
  assertText(flat.doc, 0, 'Synthetic overlay answer');
  assertText(flat.doc, 0, '2026-09-06');
  assertText(flat.doc, 0, 'Synthetic Signer');
  assertText(flat.doc, 2, 'Separate page three answer');
  assert.equal(flat.doc.getPageCount(), 5);
  assert.match(pageContents(flat.doc, 0), /Image/);
  fixtures['reopened-flat.pdf'] = await readFile(flat.path);
  await upload('reopened-flat.pdf');
  assert.equal(await page.locator('[data-overlay]').count(), 0, 'Reopened export is actual page content');
  await page.getByRole('button', { name: 'Go to PDF page 3', exact: true }).click();
  await page.locator('.pdf-edit-grid').screenshot({ path: resolve(output, 'reopened-page-three.png') });
  await page.getByRole('button', { name: 'Reset document', exact: true }).click();
  assert.equal(await page.locator('.pdf-edit-document').isVisible(), false);
  assert.equal(await page.locator('[data-field], [data-property]').count(), 0, 'Reset also removes hidden sensitive input values');
  const geometry = await page.evaluate(async bytes => {
    const info = await window.GxaPdfEditCore.inspect(new Uint8Array(bytes), window.PDFLib);
    const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
    const viewport = (await doc.getPage(1)).getViewport({ scale: 1 });
    await doc.destroy();
    return { engine: info.pages[0].transform, preview: viewport.transform };
  }, Array.from(fixtures['user-unit.pdf']));
  assert.deepEqual(geometry.engine.map(n => n || 0), geometry.preview.map(n => n || 0), 'UserUnit source preview/export coordinate systems agree');
  await upload('rotated-widgets.pdf');
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByLabel('widgetRotation', { exact: true }).fill('Rotated text');
  await page.getByRole('button', { name: 'Preview Edited PDF', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.pdf-edit-grid')?.classList.contains('is-preview'));
  await page.locator('.pdf-edit-grid').screenshot({ path: resolve(output, 'rotated-widgets-output.png') });
  await page.getByRole('button', { name: 'Reset document', exact: true }).click();
  for (const [name, expression] of [['corrupt.pdf', /could not|corrupt/], ['empty.pdf', /empty/], ['encrypted.pdf', /encrypted|password/], ['xfa-form.pdf', /XFA/]]) {
    await page.locator('#pdf-edit-file').setInputFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from(fixtures[name]) });
    await page.waitForFunction(() => document.querySelector('#edit-pdf-mount')?.getAttribute('aria-busy') === 'false');
    assert.match(await page.locator('#pdf-edit-status').innerText(), expression);
    assert.equal(await page.locator('.pdf-edit-document').isVisible(), false);
  }
  console.log('Browser UserUnit coordinate comparison, widget rotation, error states, and reset privacy passed.');
  console.log('Browser flat/multi-page exports, text/date/check/signature, image constraints, touch drag, undo/redo, zoom and reset passed.');
  assert.deepEqual(failures, [], 'No uncaught page errors');
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
