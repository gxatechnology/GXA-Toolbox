import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadToolContentRegistry, loadToolRegistry, loadToolQuality } from '../scripts/tool-registry.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const quality = await loadToolQuality();
const [tools, content, app, template, inventory] = await Promise.all([
  loadToolRegistry(),
  loadToolContentRegistry(),
  readFile(join(root, 'public_html', 'assets', 'app.js'), 'utf8'),
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'docs', 'TOOL_CONTENT_INVENTORY.md'), 'utf8')
]);
const pdfExpected = tools.filter(tool => tool.category === 'pdf' || (tool.category === 'convert' && tool.id.includes('pdf')));
const imageExpectedIds = new Set(['compress-image', 'resize-image', 'image-converter', 'gps-map-camera', 'crop-image', 'image-ocr', 'background-remover', 'color-extractor', 'qr-reader', 'barcode-reader', 'exif-viewer']);
const imageExpected = tools.filter(tool => imageExpectedIds.has(tool.id));
const conversionExpected = tools.filter(tool => tool.category === 'convert');
const expected = tools;
const serializedContent = JSON.stringify(content);
for (const filler of [
  'Adjust the controls shown for this tool.',
  'Run the operation and inspect the displayed result.',
  'Enter the requested values.',
  'Create a practical intermediate file for permitted editing, sharing, or archiving.',
  'Keep a copy of important source data.',
  'Should this replace professional advice?'
]) assert.ok(!serializedContent.includes(filler), `Interchangeable filler copy remains: ${filler}`);
assert.equal(pdfExpected.length, 39, 'The audited PDF-related scope includes Edit PDF; review the content inventory.');
assert.equal(imageExpected.length, 11, 'The audited image-focused scope changed; review the content inventory.');
assert.equal(conversionExpected.length, 21, 'The audited conversion scope changed; review the content inventory.');
assert.equal(expected.length, 95, 'The audited production tool scope includes Edit PDF, Image Converter, and GPS Map Camera; review the content inventory.');
assert.deepEqual(new Set(Object.keys(content)), new Set(expected.map(tool => tool.id)), 'Content entries must exactly cover every registered production tool route.');
assert.equal(new Set(Object.values(content).map(item => item.about.join('\n'))).size, expected.length, 'Every expanded page needs a unique About section.');
assert.equal(new Set(Object.values(content).map(item => item.privacy.description)).size, expected.length, 'Every tool needs a route-specific processing/privacy explanation.');
assert.ok(template.indexOf('/assets/tool-content.js') < template.indexOf('/assets/app.js'), 'Tool content must load before the app controller.');
assert.match(app, /function renderToolContentSections/);
assert.match(app, /function renderToolPreworkspaceIntro/);
assert.ok(app.indexOf('renderToolContentSections(toolId)') < app.indexOf('renderToolAdPlacementPlaceholder()', app.indexOf('renderToolContentSections(toolId)')), 'Informational content must precede the post-tool ad mount.');

const normalizedWords = value => new Set(String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(word => word.length > 2));
const similarity = (left, right) => {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  const intersection = [...a].filter(word => b.has(word)).length;
  return intersection / Math.max(1, new Set([...a, ...b]).size);
};
for (let left = 0; left < expected.length; left += 1) {
  for (let right = left + 1; right < expected.length; right += 1) {
    const leftEntry = content[expected[left].id];
    const rightEntry = content[expected[right].id];
    assert.ok(similarity(leftEntry.about.join(' '), rightEntry.about.join(' ')) < 0.78, `${expected[left].id} and ${expected[right].id} have highly similar intros.`);
    assert.ok(similarity(leftEntry.howToUse.map(item => item.description).join(' '), rightEntry.howToUse.map(item => item.description).join(' ')) < 0.78, `${expected[left].id} and ${expected[right].id} have highly similar How-to content.`);
  }
}

for (const tool of expected) {
  const entry = content[tool.id];
  assert.ok(entry.features.length >= 3, `${tool.id} needs at least three specific features.`);
  assert.ok(entry.howToUse.length >= 4, `${tool.id} needs at least four real steps.`);
  assert.ok(entry.useCases.length >= 2, `${tool.id} needs practical use cases.`);
  assert.ok(entry.limitations.length >= 2, `${tool.id} needs honest limitations.`);
  assert.ok(entry.faqs.length >= 3, `${tool.id} needs specific FAQs in addition to shared FAQ items.`);
  assert.ok(entry.formula || entry.howItWorks || entry.quality, `${tool.id} needs a specific formula, method, or quality explanation.`);
  assert.equal(new Set(entry.faqs.map(item => item.question.trim().toLowerCase())).size, entry.faqs.length, `${tool.id} contains duplicate FAQ questions.`);
  for (const faq of entry.faqs) {
    assert.ok(faq.question.trim().length >= 12, `${tool.id} has a malformed FAQ question.`);
    assert.ok(faq.answer.trim().length >= 20, `${tool.id} has a thin FAQ answer.`);
  }
  assert.ok(entry.relatedTools.length >= 3, `${tool.id} needs contextual related tools.`);
  for (const related of entry.relatedTools) assert.ok(tools.some(item => item.id === related), `${tool.id} links to unknown tool ${related}.`);
  const html = await readFile(join(root, 'dist', tool.id, 'index.html'), 'utf8');
  assert.match(html, /class="tool-preworkspace-intro"/, `${tool.id} needs a useful static intro before its workspace hydrates.`);
  for (const heading of ['About, Features and Practical Uses', 'What You Can Do', 'How to Use', 'Practical Use Cases', 'Privacy, Formats and Limitations', 'Privacy and File Processing', 'Supported Inputs and Outputs', 'Limitations and Important Notes', 'Frequently Asked Questions', 'Related Tools and Guides']) assert.ok(html.includes(heading), `${tool.id} is missing ${heading}.`);
  assert.match(html, /"@type": "FAQPage"/, `${tool.id} needs visible FAQ schema.`);
  assert.match(html, new RegExp(`<link rel="canonical" href="https://gxatoolbox\\.in/${tool.id}/"\\s*/?>`));
  assert.match(html, new RegExp(`<meta name="robots" content="${quality[tool.id].indexable ? 'index' : 'noindex'}, follow"\\s*\\/?>`), `${tool.id} must follow the central indexing policy.`);
  if (imageExpectedIds.has(tool.id) || tool.category === 'convert') {
    assert.ok(entry.quality, `${tool.id} needs a truthful quality/fidelity statement.`);
    assert.ok(html.includes('Quality and Fidelity'), `${tool.id} is missing Quality and Fidelity.`);
  }
  if ((tool.category === 'utility' && !imageExpectedIds.has(tool.id)) || tool.category === 'zip') {
    assert.ok(entry.howItWorks, `${tool.id} needs a verified How It Works explanation.`);
    assert.ok(html.includes('How It Works'), `${tool.id} is missing How It Works.`);
  }
  if (tool.category === 'calculator') {
    for (const field of ['formula', 'inputExplanation', 'resultExplanation', 'assumptions']) assert.ok(entry[field]?.length, `${tool.id} needs ${field}.`);
    for (const heading of ['Formula / Method', 'Input Explanation', 'Understanding the Result', 'Assumptions']) assert.ok(html.includes(heading), `${tool.id} is missing ${heading}.`);
  }
}
assert.ok(content['organize-pdf'].features.length >= 3 && content['organize-pdf'].faqs.length >= 3, 'Organize PDF demonstration must be production-quality.');
assert.equal((inventory.match(/^\| [^|]+ \| `\/[a-z0-9-]+\/` \|/gm) || []).length, tools.length, 'Developer inventory must contain all registered tools exactly once.');
assert.match(app, /const emi = r === 0 \? p \/ n : p \* r \/ -Math\.expm1\(-n \* Math\.log1p\(r\)\)/, 'EMI implementation must retain the stable amortizing formula and zero-interest branch; numeric regression tests verify outputs.');
assert.match(app, /interest = \(p \* r \* t\) \/ 100/, 'Simple-interest implementation must retain I = PRT/100.');
assert.match(app, /futureValue = r === 0 \? totalInvested : p \* \(Math\.expm1\(m \* Math\.log1p\(r\)\) \/ r\) \* \(1 \+ r\)/, 'SIP implementation must retain beginning-of-period contributions and zero-return branch; numeric regression tests verify outputs.');
assert.match(app, /bmi = w \/ Math\.pow\(h \/ 100, 2\)/, 'Metric BMI implementation must retain kg/m².');
assert.match(app, /mi: 1609\.344.*in: 0\.0254/, 'Length conversion constants must retain exact mile and inch factors.');
console.log(`Tool content contract passed: ${tools.length} inventoried tools and ${expected.length} content-rich routes through Parts 2–7.`);
