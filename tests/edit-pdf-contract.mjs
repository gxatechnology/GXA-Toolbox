import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { canonicalToolUrl, loadToolContentRegistry, loadToolRegistry } from '../scripts/tool-registry.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, ui, core, template, analytics, tools, content] = await Promise.all([
  read('public_html/assets/app.js'),
  read('public_html/assets/pdf-edit.js'),
  read('public_html/assets/pdf-edit-core.js'),
  read('index.html'),
  read('public_html/assets/gxa-analytics.js'),
  loadToolRegistry(),
  loadToolContentRegistry()
]);

assert.equal(tools.length, 95, 'Edit PDF, Image Converter, and GPS Map Camera must remain in the preserved production registry.');
const entries = tools.filter(tool => tool.id === 'edit-pdf');
assert.equal(entries.length, 1, 'Edit PDF needs one canonical registry entry.');
assert.equal(entries[0].name, 'Edit PDF');
assert.equal(entries[0].category, 'pdf');
assert.equal(canonicalToolUrl(entries[0].id), 'https://gxatoolbox.in/edit-pdf/');
assert.equal(tools.filter(tool => tool.category === 'pdf').length, 23);
for (const id of content['edit-pdf'].relatedTools) assert(tools.some(tool => tool.id === id), `Unknown related route: ${id}`);
assert.match(content['edit-pdf'].faqs.map(faq => `${faq.question} ${faq.answer}`).join(' '), /existing text already printed[\s\S]*not directly editable/i);

const integrationStart = app.indexOf('async function renderEditPdfPage');
const integrationEnd = app.indexOf('// --- FAQs lookup', integrationStart);
assert(integrationStart >= 0 && integrationEnd > integrationStart, 'The dedicated editor must hydrate through the existing app route.');
const integration = app.slice(integrationStart, integrationEnd);
for (const module of ['pdf-edit-core.js', 'pdf-edit.js']) {
  assert.match(integration, new RegExp(`loadScriptOnce\\(\\s*['"]/assets/${module.replaceAll('.', '\\.')}['"]`));
  assert(!template.includes(`/assets/${module}`), `${module} must remain route-lazy.`);
}
assert.match(integration, /mount\.isConnected/);
assert.match(integration, /renderToolContentSections\(\s*tool\.id\s*\)/);
assert.match(integration, /recordToolAnalytics\(\s*event\s*,\s*\{\s*status\s*\}\s*\)/);
assert.match(integration, /logHistory\(\s*['"]edited-document\.pdf['"]\s*,\s*['"]Edit PDF['"]/);
assert.doesNotMatch(integration, /logHistory\([^\n]*(?:sourceName|fieldValues|file\.name)/, 'History must not receive document names or answers.');
assert.match(app, /previousPage\s*===\s*['"]tool-edit-pdf['"][^\n]*GxaPdfEditor\?\.dispose\(/);

// Exercise the real route helpers without a server or generated build.
const routeStart = app.indexOf('function normalizeRoutePath');
const routeEnd = app.indexOf('function disposeRouteEditors', routeStart);
const routing = vm.createContext({
  window: { location: { pathname: '/edit-pdf/', hash: '', search: '' } },
  toolsList: tools, contentPages: [], NOT_FOUND_PAGE: 'not-found', appState: {},
  history: { replaceState() {} }
});
vm.runInContext(app.slice(routeStart, routeEnd), routing);
for (const pathname of ['/edit-pdf/', '/edit-pdf', '/EDIT-PDF/']) {
  routing.window.location.pathname = pathname;
  assert.equal(routing.pageIdFromLocation(), 'tool-edit-pdf');
  assert.equal(routing.pathForPage('tool-edit-pdf'), '/edit-pdf/');
}
routing.window.location.pathname = '/edit-pdf/not-a-route/';
assert.equal(routing.pageIdFromLocation(), 'not-found');

assert.doesNotMatch(ui + core, /\b(?:localStorage|sessionStorage|indexedDB|XMLHttpRequest)\b|\b(?:fetch|sendBeacon)\s*\(/, 'Document editing must not store or upload sensitive contents.');
assert.deepEqual(new Set([...ui.matchAll(/\bevent\(\s*['"]([^'"]+)['"]/g)].map(match => match[1])), new Set(['tool_start', 'tool_complete', 'tool_fail', 'tool_download']));
const requests = [];
const analyticsWindow = {
  location: { pathname: '/edit-pdf/' }, dataLayer: [],
  fetch(url, options) { requests.push({ url, payload: JSON.parse(options.body) }); return Promise.resolve(); }
};
vm.runInNewContext(analytics, { window: analyticsWindow });
for (const event of ['tool_open', 'tool_start', 'tool_complete', 'tool_fail', 'tool_download']) {
  assert.equal(analyticsWindow.GxaAnalytics.track(event, entries[0], {
    status: 'verified', fieldValues: { answer: 'PRIVATE_FORM_VALUE' },
    filename: 'PRIVATE_DOCUMENT.pdf', signature: 'PRIVATE_SIGNATURE', text: 'PRIVATE_TEXT'
  }), true);
}
assert.equal(requests.length, 5);
assert.doesNotMatch(JSON.stringify([requests, analyticsWindow.dataLayer]), /PRIVATE_|fieldValues|filename|signature/);
for (const { payload } of requests) assert.deepEqual(Object.keys(payload).sort(), ['duration_bucket', 'event_type', 'page_path', 'status', 'tool_category', 'tool_id', 'tool_name']);

// Extract real private UI functions into small in-memory DOM stubs. These tests
// cover state transitions without copying the implementation or adding a DOM dependency.
function sourceFunction(name) {
  const declaration = new RegExp(`^([\\t ]*)(?:async\\s+)?function\\s+${name}\\s*\\(`, 'm').exec(ui);
  assert(declaration, `Missing editor function ${name}.`);
  const bodyStart = declaration.index + declaration[0].length;
  const closing = new RegExp(`^${declaration[1]}\\}`, 'm').exec(ui.slice(bodyStart));
  assert(closing, `Cannot locate the closing brace for ${name}.`);
  return ui.slice(declaration.index, bodyStart + closing.index + closing[0].length);
}
function runFunction(name, environment) {
  const context = vm.createContext(environment);
  vm.runInContext(sourceFunction(name), context);
  return context;
}
const status = () => {};
const documentPanel = { inert: false };
const progress = { hidden: true };
const actions = [{ disabled: false }, { disabled: false }, { disabled: false }];
const busyContext = runFunction('setBusy', {
  busy: false, status,
  $: selector => selector === '.pdf-edit-document' ? documentPanel : progress,
  root: { setAttribute() {}, querySelectorAll: () => actions }
});
busyContext.setBusy(true);
assert.equal(documentPanel.inert, true, 'Export must prevent edits and mode changes while preparing the result.');
assert(actions.every(action => action.disabled));
busyContext.setBusy(false);
assert.equal(documentPanel.inert, false, 'Busy completion must restore editor interaction.');
assert(actions.every(action => !action.disabled));

const fieldControlContext = runFunction('makeFieldControl', {
  busy: true, data: { fieldValues: {} },
  document: { createElement(tagName) { return { tagName, dataset: {}, children: [], append(child) { this.children.push(child); }, setAttribute() {} }; } }
});
assert.equal(fieldControlContext.makeFieldControl({ name: 'Answer', type: 'text', readOnly: false, value: '' }, {}, true).disabled, false, 'Loading must not permanently disable editable fields.');
assert.equal(fieldControlContext.makeFieldControl({ name: 'Locked', type: 'text', readOnly: true, value: '' }, {}, true).disabled, true, 'Read-only fields must stay protected.');

const fieldInput = { dataset: { field: 'Answer' }, type: 'text', value: 'First' };
const fieldPeer = { dataset: { field: 'Answer' }, type: 'text', value: '' };
let fieldSnapshots = 0;
const fieldContext = runFunction('updateField', {
  busy: false, preview: false, editingInput: null,
  info: { fields: [{ name: 'Answer', type: 'text', readOnly: false }] }, data: { fieldValues: { Answer: '' } },
  remember: () => { fieldSnapshots++; }, historyState() {}, status,
  root: { querySelectorAll: () => [fieldInput, fieldPeer] }
});
fieldContext.updateField({ target: fieldInput });
fieldInput.value = 'Typed before blur';
fieldContext.updateField({ target: fieldInput });
assert.equal(fieldContext.data.fieldValues.Answer, 'Typed before blur');
assert.equal(fieldPeer.value, 'Typed before blur');
assert.equal(fieldSnapshots, 1, 'One continuous typing interaction should produce one undo snapshot.');
assert.match(ui, /on\(\s*root\s*,\s*['"]input['"]\s*,\s*updateField\s*\)/);

const textInput = { dataset: { property: 'text' }, value: 'Answer before changing selection' };
const overlay = { id: 'selected', type: 'text', text: '' };
let propertySnapshots = 0;
const propertyContext = runFunction('updateProperty', {
  busy: false, preview: false, editingInput: null, selectedId: overlay.id,
  data: { overlays: [overlay] },
  remember: () => { propertySnapshots++; }, clampOverlay() {}, historyState() {}, renderLayers() {}, status,
  $: () => ({ querySelectorAll: () => [textInput] })
});
propertyContext.updateProperty({ target: textInput });
assert.equal(overlay.text, textInput.value, 'New overlay text must be saved on input, before blur or object selection.');
assert.equal(propertySnapshots, 1);
assert.match(ui, /on\([^\n]*['"]input['"]\s*,\s*updateProperty\s*\)/);

const layers = sourceFunction('renderLayers');
assert.match(layers, /core\.widgetViewport\(\s*page\s*,\s*widget\s*\)/, 'Native widgets must use the shared page/widget rotation mapping.');
assert.match(layers, /widgetView\.transform/, 'Native widgets must use the full original-page transform.');
assert.match(layers, /transform\s*:\s*`matrix\(/, 'Rotation must apply to the whole native control.');
assert.match(layers, /layerToken\s*!==\s*layerRevision/, 'An asynchronous stale layer render must not append old overlays.');
for (const action of ['preview', 'back', 'download', 'undo', 'redo', 'reset', 'previous', 'next', 'fit-width', 'fit-page', 'actual-size']) {
  assert.match(ui, new RegExp(`data-action=["']${action}["']`), `Missing usable editor action: ${action}`);
}
assert.match(ui, /Download Edited PDF/);
assert.match(ui, /value=["']editable["']/);
assert.match(ui, /value=["']flatten["']/);
assert.match(sourceFunction('clearOutput'), /URL\.revokeObjectURL\(/);

let signatureCleared = 0;
let layerCleared = 0;
const resetPanel = { hidden: false };
const retainedNode = () => ({
  children: [{ value: 'PRIVATE' }], textContent: 'PRIVATE', innerHTML: '<input value="PRIVATE">',
  replaceChildren() { this.children = []; this.textContent = ''; this.innerHTML = ''; }
});
const resetNodes = {
  '.pdf-edit-document': resetPanel,
  '.pdf-edit-selection': retainedNode(),
  '.pdf-edit-field-list': retainedNode(),
  '.pdf-edit-pages': retainedNode(),
  '#pdf-edit-filename': { textContent: 'PRIVATE.pdf' },
  '#pdf-edit-info': { textContent: 'PRIVATE document details' }
};
const resetContext = runFunction('action', {
  thumbnailObserver: null, thumbnailTask: null, thumbnailRevision: 0,
  busy: false, loadRevision: 1, revision: 1, renderTask: { cancel() {} },
  pdf: { destroy() {} }, source: new Uint8Array([1, 2]), info: { fields: [] },
  data: { fieldValues: { Answer: 'PRIVATE' }, overlays: [{ text: 'PRIVATE' }] },
  undo: [{ fieldValues: { Answer: 'PRIVATE' } }], redo: [{}], pendingImage: { imageBytes: new Uint8Array([1]) },
  editingInput: {}, sourceName: 'PRIVATE.pdf', selectedId: 'selected',
  signatureHasInk: true, signatureContext: { clearRect() { signatureCleared++; } },
  canvas: { width: 600, height: 200 }, layer: { replaceChildren() { layerCleared++; } },
  window: { confirm: () => true }, clearOutput() {}, status, fileInput: { focus() {} },
  $: selector => resetNodes[selector]
});
vm.runInContext(sourceFunction('renderProperties'), resetContext);
await resetContext.action('reset');
assert.equal(resetContext.source, null);
assert.equal(resetContext.info, null);
assert.equal(Object.keys(resetContext.data.fieldValues).length, 0);
assert.equal(resetContext.data.overlays.length, 0);
assert.equal(resetContext.undo.length + resetContext.redo.length, 0);
assert.equal(resetContext.pendingImage, null);
assert.equal(resetContext.editingInput, null);
assert.equal(resetContext.sourceName, '');
assert.equal(resetContext.signatureHasInk, false);
assert.equal(signatureCleared, 1, 'Reset must clear retained signature pixels.');
assert.equal(layerCleared, 1);
assert.equal(resetPanel.hidden, true);
assert.doesNotMatch(resetNodes['.pdf-edit-selection'].innerHTML, /PRIVATE/, 'Reset must remove sensitive text from the hidden properties panel.');
for (const selector of ['.pdf-edit-field-list', '.pdf-edit-pages']) {
  assert.equal(resetNodes[selector].children.length, 0, `Reset must empty ${selector}, not only hide it.`);
  assert.equal(resetNodes[selector].textContent, '');
}
for (const selector of ['#pdf-edit-filename', '#pdf-edit-info']) {
  assert.equal(resetNodes[selector].textContent, '', `Reset must clear retained document metadata in ${selector}.`);
}
assert.equal(resetContext.loadRevision, 2, 'Reset must invalidate in-flight document/image work.');

console.log('Edit PDF integration contract passed within the 95-tool registry: source routing/lazy modules, private-data filtering, typing synchronization, busy-state restoration, rotated-widget transform, and sensitive reset cleanup.');
