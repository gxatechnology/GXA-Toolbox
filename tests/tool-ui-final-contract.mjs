import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL(`../${path}`,import.meta.url),'utf8');
const app = await read('public_html/assets/app.js');
assert.match(app,/function renderEditorToolHeader\(/);
assert.equal((app.match(/\$\{renderEditorToolHeader\(/g)||[]).length,3);
assert.doesNotMatch(app,/Select an image to begin\./);
for(const file of ['pdf-edit.js','image-converter.js','gps-map-camera.js']) {
 const source = await read(`public_html/assets/${file}`);
 assert.doesNotMatch(source,/Choose (?:a PDF|an image|or capture a photo) to begin\./);
 assert.match(source,/role="status" aria-live="polite"/);
}
const css = await read('public_html/assets/style.css');
for(const token of ['--tool-section-gap','--tool-heading-gap','--tool-card-padding','--tool-card-radius','--tool-empty-width','--tool-empty-height','--tool-control-height']) assert.ok(css.includes(token));
assert.match(css,/#crop-editor-status:empty/);
assert.match(await read('background-remover-app/src/components/UploadScreen.tsx'),/aria-label="Breadcrumb"/);
assert.ok((await read('background-remover-app/src/components/ToolContentGuide.tsx')).includes("item.description.trim().replace(/[.!?]+$/, '') !== item.title.trim().replace(/[.!?]+$/, '')"));
for (const file of ['public_html/assets/app.js','scripts/generate-seo-site.mjs']) {
  assert.ok((await read(file)).includes("item.description.trim().replace(/[.!?]+$/, '') === item.title.trim().replace(/[.!?]+$/, '')"), 'Static and client guides omit only identical repeated step descriptions');
}
console.log('Final UI source contract passed: shared editor identity, four redundant prompts removed, live status retained, shared tokens and React breadcrumb.');
