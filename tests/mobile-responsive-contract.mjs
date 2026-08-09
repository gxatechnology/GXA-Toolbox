import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [app, styles, workspace, studios, reactApp, reactStyles, interactions] = await Promise.all([
  read('public_html/assets/app.js'),
  read('public_html/assets/style.css'),
  read('public_html/assets/tool-workspace.js'),
  read('public_html/assets/phase-one-studios.js'),
  read('background-remover-app/src/App.tsx'),
  read('background-remover-app/src/styles/global.css'),
  read('background-remover-app/src/hooks/useCanvasInteractions.ts'),
]);

for (const label of ['Home', 'All Tools', 'PDF Tools', 'Image Tools', 'Converters', 'ZIP Tools', 'Developer Tools', 'Calculators', 'Dashboard', 'Contact Support', 'Sign In', 'Sign up for free']) {
  assert.ok(app.includes(label), `Mobile navigation is missing ${label}`);
}

assert.match(app, /mobile-drawer-search/);
assert.match(app, /aria-hidden/);
assert.match(app, /\.inert\s*=/);
assert.match(app, /modal-open/);
assert.match(app, /file-card-order-controls/);
assert.match(app, /Move \$\{safeFileName\} up/);
assert.match(styles, /--z-header:\s*50/);
assert.match(styles, /--z-drawer:\s*100/);
assert.match(styles, /--z-modal:\s*120/);
assert.match(styles, /--z-toast:\s*140/);
assert.match(styles, /body\.mobile-menu-open[\s\S]*overflow:\s*hidden/);
assert.match(styles, /\.logo-text \.brand-suffix \{ display: inline !important; \}/);
assert.match(styles, /max-height:\s*min\(90dvh/);
assert.match(styles, /env\(safe-area-inset-bottom\)/);
assert.match(styles, /\.studio-mobile-settings-toggle[\s\S]*position:\s*static/);
assert.match(styles, /data-studio-mode="organize-pdf"[\s\S]*grid-template-columns:\s*repeat\(2/);
assert.match(styles, /\.filter-tabs[\s\S]*max-width:\s*100%/);
assert.match(styles, /\.premium-editor-workspace > \*[\s\S]*min-width:\s*0[\s\S]*max-width:\s*100%/);
assert.match(styles, /\.premium-editor-workspace \.tool-options-panel input\[type="file"\][\s\S]*max-width:\s*100%/);
assert.match(app, /Enter a valid HEX, RGB, or HSL color value\./);
assert.match(app, /<strong>CMYK:<\/strong>/);
assert.match(studios, /studio-drawer-open/);
assert.match(workspace, /'BarcodeDetector' in window && 'createImageBitmap' in window/);
assert.match(workspace, /addEventListener\('pointerdown'/);
assert.match(workspace, /addEventListener\('pointermove'/);
assert.match(reactApp, /mobile-properties-backdrop/);
assert.match(reactApp, /mobilePropertiesOpen/);
assert.match(reactStyles, /\.bottom-toolbar[\s\S]*position:\s*fixed/);
assert.match(reactStyles, /max-height:\s*min\(62dvh/);
assert.match(reactStyles, /env\(safe-area-inset-bottom\)/);
assert.match(interactions, /pointerType === 'touch'/);
assert.match(interactions, /32/);

console.log('Mobile responsive contract passed: navigation, sheets, safe areas, touch controls, feature detection, and Background Remover layout.');
