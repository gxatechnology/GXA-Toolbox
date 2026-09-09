import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

const [tools, css, app, workspace, architecture, audit, contentPages, generator, generatedHelp] = await Promise.all([
  loadToolRegistry(),
  readFile(new URL('../public_html/assets/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../public_html/assets/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public_html/assets/tool-workspace.js', import.meta.url), 'utf8'),
  readFile(new URL('../public_html/assets/phase-one-studios.js', import.meta.url), 'utf8'),
  readFile(new URL('../docs/TOOL_UI_ARCHITECTURE_AUDIT.md', import.meta.url), 'utf8'),
  readFile(new URL('../public_html/assets/content-pages.js', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/generate-seo-site.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../dist/help/index.html', import.meta.url), 'utf8')
]);

assert.equal(tools.length, 95, 'architecture audit must cover all 95 registered tools');
for (const tool of tools) {
  assert.equal((audit.match(new RegExp(`\\| /${tool.id.replaceAll('-', '\\-')}/ \\|`, 'g')) || []).length, 1, `architecture audit must list /${tool.id}/ exactly once`);
}
assert.equal((audit.match(/Architecture complete; registry and route contract covered/g) || []).length, tools.length, 'every registry route needs a final architecture status');
for (const header of ['Family/type', 'Current workspace type', 'New/final workspace type', 'Cross-tool navigation present?', 'Pre-input experience', 'Settings placement', 'Result/preview type', 'Clipping status', 'Mobile status', 'Desktop status', 'Technical badge status', 'Primary action clarity', 'Final status']) {
  assert.ok(audit.includes(header), `architecture audit is missing the ${header} column`);
}

const architectureContext = { window: {} };
vm.createContext(architectureContext);
vm.runInContext(architecture, architectureContext);
for (const tool of tools) {
  assert.notEqual(architectureContext.window.GxaPhaseOneStudios.familyForRoute(tool.id), 'utility', `${tool.id} needs an explicit architecture family`);
}
assert.doesNotMatch(architecture, /createModeRail|studio-mode-button|window\.navigate/, 'shared architecture must not create cross-tool pseudo-mode navigation');
assert.doesNotMatch(architecture, /Image Studio adjustments|studio-image-brightness|studio-image-watermark/, 'shared architecture must not inject unrelated image editing controls');

assert(/\.premium-editor-workspace \.tool-interactive-area\s*\{[^}]*overflow:\s*visible/s.test(css), 'core workspace must not clip descendants');
assert(/\.premium-editor-workspace \.tool-options-panel\s*\{[^}]*max-height:\s*none[^}]*overflow:\s*visible/s.test(css), 'desktop settings must use page scrolling');
assert(css.includes('.tool-family-security-password #generator-preview-mount'), 'password generator needs its compact family layout');
assert(css.includes('.password-result-actions'), 'password result actions must stay with the generated value');
assert(css.includes('overflow-wrap: anywhere'), 'long unbroken values need a wrapping contract');
assert(/\.premium-result-preview\s*\{[^}]*max-height:\s*none[^}]*overflow:\s*visible/s.test(css), 'shared result previews must expand in normal page flow instead of clipping');
assert(/\.tool-workspace,[\s\S]*\.gps-studio__result\s*\{[^}]*scroll-margin-top:\s*var\(--input-scroll-gap\)/s.test(css), 'workspaces and result families need the shared scroll gap');
assert(/html\s*\{[^}]*scroll-padding-top:\s*var\(--header-clearance\)/s.test(css), 'root scrolling must reserve actual header clearance');
assert(css.includes('--header-clearance: 72px') && css.includes('--header-clearance: calc(66px + env(safe-area-inset-top))'), 'header clearance must cover desktop and safe-area mobile headers');
assert(css.includes('--input-scroll-gap: 16px'), 'input and result edges need breathing room beyond the header');
assert(css.includes('.tool-container [hidden]:not([hidden="until-found"]) { display: none !important; }'), 'author grid/flex rules must respect inactive tool panels');
assert(/\.crop-canvas-stage:has\(> \.crop-upload-state:not\(\.hidden\)\)\s*\{[^}]*height:\s*auto[^}]*min-height:\s*0[^}]*overflow:\s*visible/s.test(css), 'only the empty crop stage should expand naturally');
assert(workspace.includes("matchMedia?.('(prefers-reduced-motion: reduce)').matches"), 'result auto-scroll must respect reduced-motion preference');
assert(workspace.includes('function scrollToResult(element'), 'result auto-scroll needs one shared helper');
assert(app.includes('GxaWorkspace.scrollToResult'), 'shared result flows must use the protected scroll helper');

assert(app.includes('id="generated-password-value"'), 'password value must have a dedicated selectable output node');
assert(app.includes('${escapeHTML(pw)}</output>'), 'generated passwords must be escaped before entering the result DOM');
assert(app.includes('aria-label="Copy generated password"'), 'password Copy action needs an accessible name');
assert(app.includes('aria-label="Generate another password"'), 'password Regenerate action needs an accessible name');
assert(app.includes('[8, 16, 32, 64]'), 'password settings need all requested length presets');
assert(app.includes('secureRandomIndex'), 'password generation must use unbiased cryptographic selection');
assert(app.includes('id="generated-hash-value"'), 'hash output needs a dedicated complete value node');
assert(app.includes('copyGeneratedHash()'), 'hash Copy must read the complete rendered value');
assert(app.includes("toolId !== 'merge-pdf'"), 'Merge PDF result must avoid an unrelated before/after comparison');
assert(app.includes('data-result-type="${resultType}"'), 'workspaces must declare their result type');
assert(app.includes('toolbar.hidden = true'), 'generic mega-editor toolbar must not dominate focused tools');
assert.doesNotMatch(app, /processing-badge processing-\$\{processingProfile\.kind\}/, 'technical processing badge must be removed from the generic hero');
assert(contentPages.includes('toolDirectory: true'), 'Help Center must opt into the shared tool directory');
assert(generator.includes('helpToolDirectoryStaticContent(page, tools)'), 'Help tool links must be generated into crawlable static HTML');
assert.equal((generatedHelp.match(/class="help-tool-card"/g) || []).length, tools.length, 'generated Help Center must document all registered tools');
for (const tool of tools) {
  assert.equal((generatedHelp.match(new RegExp(`href="/${tool.id.replaceAll('-', '\\-')}/"`, 'g')) || []).length, 1, `Help Center must link /${tool.id}/ exactly once`);
}

console.log(`Tool UI architecture contract passed for ${tools.length} focused routes.`);
