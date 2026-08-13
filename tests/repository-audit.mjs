import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const appPath = new URL('../public_html/assets/app.js', import.meta.url);
const workspacePath = new URL('../public_html/assets/tool-workspace.js', import.meta.url);
const app = await readFile(appPath, 'utf8');
const workspace = await readFile(workspacePath, 'utf8');
const annotations = await readFile(new URL('../public_html/assets/image-annotations.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const productionIndex = await readFile(new URL('../public_html/index.php', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public_html/assets/style.css', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../public_html/dashboard/index.php', import.meta.url), 'utf8');

const registrySource = app.slice(app.indexOf('const toolsList'), app.indexOf('// --- Main Application Controller'));
const tools = [...registrySource.matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*category:\s*'([^']+)'/g)]
  .map(([, id, name, category]) => ({ id, name, category }));
assert.equal(tools.length, 91, `Expected 91 registered tools, found ${tools.length}.`);
assert.equal(new Set(tools.map(tool => tool.id)).size, tools.length, 'Tool IDs must be unique.');
tools.forEach(tool => {
  const referenceCount = app.split(`'${tool.id}'`).length - 1;
  assert(referenceCount >= 2, `${tool.id} is registered but has no route/configuration implementation.`);
});

const requiredTools = ['merge-pdf', 'compress-image', 'pdf-to-jpg', 'qr-reader', 'hash-tool', 'currency-converter', 'time-calculator'];
requiredTools.forEach(id => assert(tools.some(tool => tool.id === id), `Missing registered tool: ${id}`));

const blockerSource = workspace.slice(workspace.indexOf('const blockers'), workspace.indexOf('const serverTools'));
const blockerIds = [...blockerSource.matchAll(/^\s*'([^']+)':\s*'[^']+'/gm)].map(match => match[1]);
blockerIds.forEach(id => assert(tools.some(tool => tool.id === id), `Dependency blocker references unknown tool: ${id}`));
assert(workspace.includes('validateFiles'), 'Shared file validation is missing.');
assert(workspace.includes('renderFilePreview'), 'Shared preview rendering is missing.');
assert(workspace.includes('pdfToImagesZip'), 'Real PDF-to-image renderer is missing.');
assert(workspace.includes('extractPdfText'), 'Real PDF text extraction is missing.');

const validationContext = {
  window: {},
  document: { querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {} },
  URL,
  console,
  setTimeout,
  clearTimeout
};
vm.createContext(validationContext);
vm.runInContext(workspace, validationContext);
const validateFiles = validationContext.window.GxaWorkspace.validateFiles;
const file = (name, size, type, lastModified = 1) => ({ name, size, type, lastModified });
assert.equal(validateFiles([file('ok.pdf', 10, 'application/pdf')], { accept: '.pdf' }).accepted.length, 1);
assert.equal(validateFiles([file('empty.pdf', 0, 'application/pdf')], { accept: '.pdf' }).errors.length, 1);
assert.equal(validateFiles([file('large.pdf', 101 * 1024 * 1024, 'application/pdf')], { accept: '.pdf' }).errors.length, 1);
assert.equal(validateFiles([file('wrong.jpg', 10, 'image/jpeg')], { accept: '.pdf' }).errors.length, 1);
assert.equal(validateFiles([file('same.pdf', 10, 'application/pdf'), file('same.pdf', 10, 'application/pdf')], { accept: '.pdf' }).errors.length, 1);

assert(index.includes('/assets/tool-workspace.js'), 'Static entry does not load the shared workspace through the clean asset route.');
assert(productionIndex.includes('/assets/tool-workspace.js'), 'Production entry does not load the shared workspace.');
assert(index.includes('/assets/phase-one-studios.js'), 'Static entry does not load the Phase 1 studio shell through the clean asset route.');
assert(productionIndex.includes('/assets/phase-one-studios.js'), 'Production entry does not load the Phase 1 studio shell.');
assert(index.includes('/assets/image-annotations.js'), 'Static entry does not load Image Studio annotations through the clean asset route.');
assert(productionIndex.includes('/assets/image-annotations.js'), 'Production entry does not load Image Studio annotations.');
assert(app.includes('function openCommandPalette'), 'Global command palette is missing.');
assert(app.includes('function toggleFavorite'), 'Favorites support is missing.');
assert(app.includes('function updateProcessingStage'), 'Workspace processing stages are missing.');
assert(app.includes('Your Complete <span>Digital Toolbox</span>'), 'Premium homepage hero is missing.');
assert(styles.includes('PREMIUM PRODUCT EXPERIENCE'), 'Premium shared design layer is missing.');
assert(styles.includes('@media (max-width: 380px)'), 'Small-screen responsive coverage is missing.');
assert(app.includes("const CROP_IMAGE_LIBRARY_VERSION = '1.6.2'"), 'Crop Image must pin its route-only crop engine.');
assert(app.includes('function applyCropNumericFields'), 'Crop Image pixel controls are missing.');
assert(app.includes('getCroppedCanvas'), 'Crop Image must create a real cropped canvas output.');
assert(app.includes("URL.revokeObjectURL(cropEditorState.sourceUrl)"), 'Crop Image source URL cleanup is missing.');
assert(app.includes("<option value=\"9:16\">9:16 Story</option>"), 'Crop Image aspect ratio presets are incomplete.');
assert(styles.includes('.crop-editor-grid'), 'Crop Image desktop editor layout is missing.');
assert(styles.includes('.crop-image-page .cropper-point'), 'Crop Image resize handle styling is missing.');
assert(app.includes('function initializePremiumToolEditor'), 'Shared premium tool editor initialization is missing.');
assert(app.includes('initializePremiumToolEditor(toolId, needsFiles)'), 'Premium editor must initialize for every generic tool route.');
assert(app.includes('function registerToolResult'), 'Real processed-output registration is missing.');
assert(app.includes('function exportPremiumPreview'), 'Live generator result export is missing.');
assert(app.includes('function renderCalculatorFormulaReference'), 'Calculator formula references are missing.');
assert(workspace.includes("panSurface.addEventListener('pointerdown'"), 'Image preview pan and touch interaction is missing.');
assert(workspace.includes("const thumbLimit = Math.min(pdf.numPages, 60)"), 'Lazy PDF thumbnail workspace is missing.');
assert(styles.includes('UNIVERSAL PREMIUM TOOL EDITOR'), 'Shared premium tool editor design layer is missing.');
assert(styles.includes('@media (max-width: 1050px)'), 'Tablet editor breakpoint is missing.');
assert(app.includes('function validateGeneratedOutputBlob'), 'Generated output validation is missing.');
assert(app.includes('function renderImageStudioCanvas'), 'Image Studio original-resolution renderer is missing.');
assert(app.includes('GxaImageAnnotations?.render'), 'Image annotations are not flattened into exported output.');
['pen', 'brush', 'highlighter', 'eraser', 'rectangle', 'ellipse', 'line', 'arrow'].forEach(tool => {
  assert(annotations.includes(`data-annotation-tool="${tool}"`), `Image annotation tool is missing: ${tool}`);
});
['undo', 'redo', 'duplicate', 'delete', 'forward', 'backward', 'clear'].forEach(action => {
  assert(annotations.includes(`data-annotation-action="${action}"`), `Image annotation action is missing: ${action}`);
});
assert(app.includes('createImageBatchOutput'), 'Validated Image Studio batch output is missing.');
assert(app.includes('Cancel after current file'), 'Image Studio batch cancellation is missing.');
assert(app.includes('opt-organize-blank-count'), 'Organize PDF blank-page insertion is missing.');
assert(app.includes('function resolveOptionalPdfPageSelection'), 'PDF Studio page targeting is missing.');
assert(app.includes('page.setCropBox'), 'PDF Studio must update real PDF crop boxes.');
assert(workspace.includes("toolId === 'organize-pdf'"), 'PDF thumbnail organization is missing.');
assert(workspace.includes('pdf-crop-overlay'), 'Manual PDF crop overlay is missing.');
assert(styles.includes('PHASE 1 IMAGE STUDIO + PDF STUDIO SHELL'), 'Phase 1 studio design layer is missing.');
assert(!dashboard.includes('$totalFiles * 2.3'), 'Dashboard must not fabricate storage metrics.');
assert(!dashboard.includes('AI Operations Run'), 'Dashboard must not show unverified AI usage claims.');

const forbiddenPatterns = [
  /Mock AI Engine/i,
  /triggerMock(?:Image|PDF)/,
  /098f6bcd4621d373cade4e832627b4f6/,
  /example\.com\/app-utility-platform-scan-success/,
  /Sample extracted text lines/i,
  /mt_rand\s*\(/,
  /copy original file and output it/i
];
const criticalSources = [
  app,
  workspace,
  await readFile(new URL('../public_html/api/ai-tools.php', import.meta.url), 'utf8'),
  await readFile(new URL('../public_html/api/text-tools.php', import.meta.url), 'utf8'),
  await readFile(new URL('../public_html/api/background-remover.php', import.meta.url), 'utf8')
];
for (const pattern of forbiddenPatterns) {
  assert(!criticalSources.some(source => pattern.test(source)), `Forbidden simulated-success pattern remains: ${pattern}`);
}

const ignoredDirectories = new Set(['node_modules', '.git', 'dist']);
const textExtensions = new Set(['.js', '.mjs', '.html', '.php', '.css', '.json', '.md', '.txt', '.xml', '.svg', '.webmanifest']);
const oldBrandOccurrences = [];
async function scanDirectory(directoryUrl) {
  for (const entry of await readdir(directoryUrl, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl);
    if (entry.isDirectory()) {
      await scanDirectory(entryUrl);
    } else if (textExtensions.has(extname(entry.name).toLowerCase())) {
      const contents = await readFile(entryUrl, 'utf8');
      const legacyBrandPattern = new RegExp(['util', 'ora'].join(''), 'i');
      const relativePath = relative(root.pathname, entryUrl.pathname);
      const legacyKeyPattern = new RegExp(`'${['util', 'ora'].join('')}_(?:history|theme)'`, 'gi');
      const legacyDatabasePattern = new RegExp('`' + ['util', 'ora'].join('') + '_db`', 'gi');
      const allowedLegacyStorageKeys = relativePath.endsWith('public_html\\assets\\app.js')
        ? contents.replace(legacyKeyPattern, '')
        : relativePath.endsWith('database.sql')
          ? contents.replace(legacyDatabasePattern, '')
        : contents;
      if (legacyBrandPattern.test(allowedLegacyStorageKeys)) oldBrandOccurrences.push(relativePath);
    }
  }
}
await scanDirectory(root);
assert.deepEqual(oldBrandOccurrences, [], `Old-brand references remain: ${oldBrandOccurrences.join(', ')}`);

const modes = tools.reduce((summary, tool) => {
  const mode = blockerIds.includes(tool.id)
    ? 'dependency-required'
    : tool.id === 'background-remover'
      ? 'local-wasm'
      : ['qr-reader', 'barcode-reader'].includes(tool.id)
        ? 'browser-capability'
        : 'local';
  summary[mode] = (summary[mode] || 0) + 1;
  return summary;
}, {});

console.log(`Repository audit passed for ${tools.length} registered tools.`);
console.log(`Processing modes: ${Object.entries(modes).map(([mode, count]) => `${mode}=${count}`).join(', ')}`);
console.log('Unapproved old-brand references: 0');
