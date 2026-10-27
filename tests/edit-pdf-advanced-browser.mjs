import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as lib from 'pdf-lib';
import { createQaServer } from './browser-qa-server.mjs';
import { createEditPdfFixtures } from './fixtures/edit-pdf-fixtures.mjs';
import { cachePublicDependencies } from './tool-functionality-phase4a/cache-public-dependencies.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true, executablePath: process.env.GXA_BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
await cachePublicDependencies(context);
await context.route(/googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net/, route => route.abort());
const page = await context.newPage(); page.setDefaultTimeout(30000);
const failures = [], checks = [], fixtures = await createEditPdfFixtures();
const out = resolve('test-results/edit-pdf-advanced'); await mkdir(out, { recursive: true });
page.on('pageerror', error => failures.push(error.message)); page.on('dialog', dialog => dialog.accept());
const settle = () => page.waitForFunction(() => document.querySelector('#edit-pdf-mount')?.getAttribute('aria-busy') === 'false');
const act = async name => {
  if (!['preview', 'download', 'back', 'reset'].includes(name) && await page.locator('[data-action="back"]').isVisible()) {
    await page.locator('[data-action="back"]').tap(); await settle();
  }
  await page.locator(`[data-action="${name}"]`).tap(); await settle();
};
const upload = async name => {
  await page.locator('#pdf-edit-file').setInputFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from(fixtures[name]) });
  await settle(); await page.waitForFunction(() => document.querySelector('.pdf-edit-document')?.hidden === false);
};
const advanced = async () => { const panel = page.locator('.pdf-edit-advanced').first(); if (!await panel.evaluate(el => el.open)) await panel.locator('summary').tap(); };
const property = (name, value) => page.locator(`[data-property="${name}"]`).fill(String(value));
const download = async name => {
  // The existing result workflow intentionally reveals Download after preview.
  await act('preview');
  await page.locator('.result-download-section').waitFor({ state: 'visible' });
  const event = page.waitForEvent('download'); await act('download'); const file = await event;
  assert.equal(await file.failure(), null); assert.match(file.suggestedFilename(), /\.pdf$/);
  const path = resolve(out, name); await file.saveAs(path);
  const bytes = await readFile(path); assert.equal(bytes.subarray(0,5).toString(), '%PDF-');
  await act('back');
  return lib.PDFDocument.load(bytes);
};
const streams = (doc, i) => (doc.getPage(i).node.Contents()?.asArray() || []).map(ref => Buffer.from(lib.decodePDFRawStream(doc.context.lookup(ref)).decode()).toString('latin1')).join('\n');
const imageOutput = doc => {
  const images = doc.getPage(0).node.Resources().lookup(lib.PDFName.of('XObject'), lib.PDFDict).values().map(ref => doc.context.lookup(ref)).filter(stream => stream.dict?.get(lib.PDFName.of('Subtype'))?.toString() === '/Image');
  assert.equal(images.length, 1, 'Only the current inserted image is exported');
  const image = images[0], width = image.dict.get(lib.PDFName.of('Width')).asNumber(), height = image.dict.get(lib.PDFName.of('Height')).asNumber();
  const pixels = lib.decodePDFRawStream(image).decode();
  const mask = image.dict.get(lib.PDFName.of('SMask')), alpha = mask ? lib.decodePDFRawStream(doc.context.lookup(mask)).decode() : null;
  return { width, height, pixels, alpha };
};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/edit-pdf/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pdf-edit-file'); await upload('flat-multipage.pdf');
  const original = await lib.PDFDocument.load(fixtures['flat-multipage.pdf']);
  await page.locator('.pdf-edit-page-management summary').tap();
  await act('page-rotate'); await act('page-down'); await act('page-duplicate'); await act('page-blank');
  assert.equal(await page.locator('.pdf-edit-pages button').count(), original.getPageCount() + 2);
  await act('page-delete'); await act('undo');
  assert.equal(await page.locator('.pdf-edit-pages button').count(), original.getPageCount() + 2);
  await act('redo');
  const rearranged = await download('rearranged.pdf');
  assert.equal(rearranged.getPageCount(), original.getPageCount() + 1);
  assert.ok(streams(rearranged,0).includes(streams(original,1)));
  assert.ok(streams(rearranged,1).includes(streams(original,0)));
  assert.equal(rearranged.getPage(1).getRotation().angle, 90);
  assert.equal(rearranged.getPage(2).getRotation().angle, 90);
  await act('page-up');
  await act('page-blank');
  const blank = await download('blank-inserted.pdf');
  assert.equal(blank.getPageCount(), original.getPageCount() + 2);
  checks.push('Page controls change reopened output; page undo/redo, original content, independent copies and blank dimensions retained');
  await act('reset'); assert.equal(await page.locator('.pdf-edit-pages button').count(), 0);
  await upload('fillable-form.pdf');
  await act('page-duplicate'); assert.match(await page.locator('#pdf-edit-status').innerText(), /form fields or annotations/);
  await page.getByLabel('fullName', { exact: true }).fill('Advanced QA field');
  await act('page-down');
  const form = await download('reordered-form.pdf');
  assert.equal(form.getForm().getTextField('fullName').getText(), 'Advanced QA field');
  checks.push('Unsafe form-page duplication rejected; reorder preserves real field values and widgets');
  await act('reset'); await upload('flat-multipage.pdf');
  await page.locator('[data-tool="text"]').tap(); await act('place-center');
  await property('text', 'Styled output\nSecond line'); await property('x', 60); await property('y', 150); await property('width', 260); await property('height', 100);
  await page.locator('[data-property="font"]').selectOption('HelveticaBoldItalic'); await property('fontSize', 18);
  await page.locator('[data-property="align"]').selectOption('right'); await property('color', '#2255aa');
  await advanced(); await property('lineSpacing', 1.8); await property('opacity', .6); await page.locator('[data-property="underline"]').check();
  await act('duplicate-element'); await property('text', 'Duplicated QA');
  await advanced(); await act('layer-back');
  const behind = streams(await download('layer-behind.pdf'),0);
  const copyText = Buffer.from('Duplicated QA').toString('hex').toUpperCase(), originalText = Buffer.from('Styled output').toString('hex').toUpperCase();
  assert.ok(behind.indexOf(copyText) < behind.indexOf(originalText), 'Send to back changes actual paint order');
  await advanced(); await act('layer-front');
  const front = streams(await download('layer-front.pdf'),0);
  assert.ok(front.indexOf(copyText) > front.indexOf(originalText), 'Bring to front changes actual paint order');
  await act('delete');
  await act('undo'); await act('redo');
  assert.equal(await page.locator('.pdf-edit-object').count(), 1);
  await act('page-rotate'); assert.match(await page.locator('#pdf-edit-status').innerText(), /Rotate this page before adding overlays/);
  await page.locator('.pdf-edit-more summary').tap();
  const types = ['ellipse','line','arrow','highlight','underline','strike'];
  for (let i = 0; i < types.length; i++) {
    await page.locator(`[data-tool="${types[i]}"]`).tap(); await act('place-center');
    await property('x', 60); await property('y', 280 + i * 50); await property('width', 180); await property('height', 32);
    await advanced(); await property('opacity', .4);
    if (types[i] !== 'highlight') await property('strokeWidth', 3);
    if (types[i] === 'ellipse') { await page.locator('[data-property="filled"]').check(); await property('fill', '#aaffcc'); }
  }
  await page.locator('#pdf-edit-image').setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(fixtures['image.png']) });
  await page.waitForSelector('.pdf-edit-placement:not([hidden])'); await act('place-center');
  await property('width', 100); await property('x', 360); await property('y', 300);
  await advanced(); await property('opacity', .5);
  const styled = await download('advanced-overlays.pdf');
  const ops = streams(styled,0); assert.match(ops, /Helvetica-BoldOblique/); assert.match(ops, /3 w/); assert.match(ops, /5374796C6564206F7574707574/);
  assert.match(ops, /\bc\b/);
  await act('preview'); await page.waitForSelector('.pdf-edit-grid.is-preview');
  const rendered = await page.locator('.pdf-edit-page > canvas').evaluate(canvas => canvas.toDataURL('image/png').split(',')[1]);
  await writeFile(resolve(out, 'export-rendered.png'), Buffer.from(rendered, 'base64'));
  await act('back');
  checks.push('Text/font/size/alignment/color/underline/spacing/opacity, 6 new marks, fill/stroke and element duplication/layering survive download/reopen');
  const colors = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    const ctx = canvas.getContext('2d');
    for (const [color,x,y] of [['#ff0000',0,0],['#00ff00',40,0],['#0000ff',0,30]]) { ctx.fillStyle = color; ctx.fillRect(x,y,40,30); }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const imageSettings = async () => { const panel = page.locator('.pdf-edit-image-settings'); if (!await panel.evaluate(el => el.open)) await panel.locator('summary').tap(); };
  const selectImage = async () => { await settle(); await page.locator('[aria-label^="image overlay"]').tap(); await page.locator('.pdf-edit-image-settings').waitFor(); };
  await imageSettings();
  const chooserPromise = page.waitForEvent('filechooser'); await act('replace-image');
  await (await chooserPromise).setFiles({ name: 'quadrants.png', mimeType: 'image/png', buffer: Buffer.from(colors,'base64') }); await settle();
  const replaced = imageOutput(await download('replaced-image.pdf'));
  assert.deepEqual([replaced.width,replaced.height], [80,60]);
  assert.equal(await page.locator('[data-property="width"]').inputValue(), '100');
  await advanced(); assert.equal(await page.locator('[data-property="opacity"]').inputValue(), '0.5');
  for (const [rotation,expected] of [[0,[255,0,0,255]],[90,[0,0,255,255]],[180,[0,0,0,0]],[270,[0,255,0,255]]]) {
    await imageSettings();
    for (const [key,value] of Object.entries({left:25,top:25,width:50,height:50})) await page.locator(`[data-image-property="${key}"]`).fill(String(value));
    await page.locator('[data-image-property="rotation"]').selectOption(String(rotation)); await act('apply-image-edit');
    assert.match(await page.locator('#pdf-edit-status').innerText(), /applied/);
    const img = page.locator('[aria-label^="image overlay"] img');
    await img.evaluate(el => el.decode());
    const previewPixel = await img.evaluate(el => { const c=document.createElement('canvas'); c.width=el.naturalWidth; c.height=el.naturalHeight; const ctx=c.getContext('2d'); ctx.drawImage(el,0,0); return Array.from(ctx.getImageData(2,2,1,1).data); });
    assert.deepEqual(previewPixel, expected, `Preview crop/rotation ${rotation}`);
    const result = imageOutput(await download(`image-crop-${rotation}.pdf`));
    assert.deepEqual([result.width,result.height], rotation % 180 ? [30,40] : [40,30]);
    const offset = 2 * result.width + 2;
    const exportPixel = [...result.pixels.slice(offset*3,offset*3+3), result.alpha ? result.alpha[offset] : 255];
    assert.deepEqual(exportPixel, expected, `Reopened PDF crop/rotation ${rotation} agrees with preview including alpha`);
  }
  await imageSettings(); await page.locator('[data-image-property="left"]').fill('90'); await act('apply-image-edit');
  assert.match(await page.locator('#pdf-edit-status').innerText(), /inside the original/);
  assert.equal(imageOutput(await download('invalid-image-crop-retained.pdf')).width, 30, 'Invalid crop preserves the previous valid export');
  await act('reset-image-edit');
  assert.equal(imageOutput(await download('restored-image.pdf')).width, 80);
  await act('undo'); assert.equal(imageOutput(await download('image-undo.pdf')).width, 30);
  await act('redo'); assert.equal(imageOutput(await download('image-redo.pdf')).width, 80);
  await selectImage(); await imageSettings();
  const invalidChooser = page.waitForEvent('filechooser'); await act('replace-image');
  await (await invalidChooser).setFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') }); await settle();
  assert.ok(await page.locator('#pdf-edit-status').evaluate(el => el.classList.contains('is-error')));
  assert.equal(imageOutput(await download('invalid-replacement-retained.pdf')).width, 80);
  checks.push('Inserted image replace via real picker, crop and four rotations verified pixel-for-pixel in reopened PDF and preview including transparency; restore/undo/redo and invalid edits retain valid output');
  for (const width of [320,360,375,390,412,430,768,1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.ok(await page.locator('[data-action="download"]').evaluate(el => el.getBoundingClientRect().height >= 44));
    assert.equal(await page.locator('.gxa-ad-network:not([hidden])').count(), 0, 'Blocked ads have no visible placeholder');
    checks.push(`Populated advanced editor, no body overflow, 44px download: ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.pdf-edit-page-management').screenshot({ path: resolve(out, 'mobile-page-controls.png'), animations: 'disabled' });
  await act('reset'); assert.equal(await page.locator('.pdf-edit-object').count(), 0);
  await page.locator('#pdf-edit-file').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('broken file') });
  await settle(); assert.match(await page.locator('#pdf-edit-status').innerText(), /valid PDF/);
  await upload('flat-multipage.pdf');
  await page.locator('[data-tool="ellipse"]').focus(); await page.keyboard.press('Enter');
  await page.locator('[data-action="place-center"]').focus(); await page.keyboard.press('Enter');
  await page.waitForSelector('.pdf-edit-object');
  await settle(); // Do not send undo while the just-added object's page is still rendering.
  await page.locator('.pdf-edit-object').focus(); await page.keyboard.press('Control+z'); await settle();
  assert.equal(await page.locator('.pdf-edit-object').count(), 0);
  checks.push('Keyboard add/undo, invalid input, reset and retry');
  assert.deepEqual(failures, []);
} catch (error) { failures.push(error.message); throw error; } finally {
  await writeFile(resolve(out,'results.json'), JSON.stringify({ checks, failures, realAdRequests: false, browser: 'Installed Chromium, emulated touch, not real devices' },null,2));
  await context.close(); await browser.close(); await new Promise(done => server.close(done));
}
console.log(`Advanced PDF browser passed: ${checks.length} groups, real downloads/reopen, rendered export, mobile/desktop, keyboard, forms, invalid input, reset and no live ads.`);
