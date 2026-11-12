import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadToolContentRegistry, loadToolRegistry } from '../scripts/tool-registry.mjs';
import '../public_html/assets/tool-guide-visuals.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const [tools, content, template, visualSource] = await Promise.all([
  loadToolRegistry(), loadToolContentRegistry(), readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'public_html/assets/tool-guide-visuals.js'), 'utf8')
]);
assert.equal(tools.length, 95);
assert.ok(template.indexOf('/assets/tool-icons.js') < template.indexOf('/assets/tool-guide-visuals.js'));
assert.ok(template.indexOf('/assets/tool-guide-visuals.js') < template.indexOf('/assets/app.js'));
assert.doesNotMatch(visualSource, /https?:\/\//, 'Visual guides must not load remote illustrations.');

for (const tool of tools) {
  const html = await readFile(join(root, 'dist', tool.id, 'index.html'), 'utf8');
  const guideStart = html.indexOf(`data-guide-tool="${tool.id}"`);
  const guideEnd = html.indexOf('</ol>', guideStart);
  assert.ok(guideStart > 0 && guideEnd > guideStart, `${tool.id}: missing initial-HTML visual guide`);
  const guide = html.slice(guideStart, guideEnd);
  assert.equal((guide.match(/class="tool-guide-step"/g) || []).length, content[tool.id].howToUse.length, `${tool.id}: guide step count differs from factual content`);
  assert.ok(guide.includes(`data-tool-illustration="${tool.id}"`), `${tool.id}: first step needs its unique tool-specific illustration`);
  assert.ok(guide.includes('aria-hidden="true"'), `${tool.id}: decorative illustration should not duplicate instructions`);
  for (const item of content[tool.id].howToUse) {
    const title = String(item.title).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    assert.ok(guide.includes(title), `${tool.id}: factual step title was lost`);
    const shortTitle = globalThis.GxaToolGuideVisuals.shortHeading(tool.id, item.description, item.title);
    assert.ok(shortTitle.length <= 54 && !/\b(?:and|a|an|the|to|with)$/i.test(shortTitle), `${tool.id}: visual step title should be concise and complete`);
    assert.ok(guide.includes(shortTitle.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')), `${tool.id}: action heading missing from initial HTML`);
  }
}
console.log('Visual guide contract passed: 95 initial-HTML tool guides, tool-specific illustrations, factual step parity and decorative accessibility.');
