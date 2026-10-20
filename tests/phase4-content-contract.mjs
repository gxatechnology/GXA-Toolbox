import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadContentPageRegistry, loadToolRegistry, loadToolContentRegistry, loadToolQuality, PRODUCTION_ORIGIN } from '../scripts/tool-registry.mjs';
const [pages, tools, content, quality] = await Promise.all([loadContentPageRegistry(), loadToolRegistry(), loadToolContentRegistry(), loadToolQuality()]);
const editorial = pages.filter(page => page.kind);
assert.equal(tools.length, 95);
assert.equal(tools.filter(tool => quality[tool.id].indexable).length, 81);
assert.equal(editorial.length, 20);
assert.equal(editorial.filter(page => page.kind === 'guide').length, 13);
assert.equal(editorial.filter(page => page.kind === 'category').length, 5);
const known = new Set(['', ...tools.map(tool => tool.id), ...pages.map(page => page.id)]);
for (const page of editorial) {
  assert.ok(page.sections.length >= 4, `${page.id}: substantive sections missing`);
  assert.equal(page.draftDate, '2026-10-02');
  assert.match(page.editorialStatus, /human editorial review pending/);
  assert.equal(page.updated, undefined, 'Do not invent a human-review date');
  for (const section of page.sections) for (const link of section.links || []) {
    assert.match(link.href, /^(https:\/\/|\/)/);
    if (page.kind === 'category') {
      const id = link.href.replace(/^\/|\/$/g, '');
      if (tools.some(tool => tool.id === id)) assert.ok(quality[id].productionReady && quality[id].indexable, `Category promotes review tool: ${id}`);
    }
  }
}
const titles = new Set(), descriptions = new Set();
let checkedLinks = 0, checkedTools = 0;
for (const id of known) {
  const html = await readFile(new URL(`../dist/${id ? `${id}/` : ''}index.html`, import.meta.url), 'utf8');
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${id}: exactly one static H1 required`);
  assert.ok(html.includes(`rel="canonical" href="${PRODUCTION_ORIGIN}/${id ? `${id}/` : ''}"`), `${id}: wrong canonical`);
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(title && !titles.has(title), `${id}: duplicate/missing title`); titles.add(title);
  assert.ok(description && !descriptions.has(description), `${id}: duplicate/missing description`); descriptions.add(description);
  assert.ok(!description.includes('Use it with GXA Toolbox.'), `${id}: legacy meta suffix`);
  if (quality[id]?.indexable) {
    checkedTools++;
    for (const phrase of ['How to Use', 'About, Features and Practical Uses', 'Privacy, Formats and Limitations', 'Frequently Asked Questions', 'Related Tools and Guides']) assert.ok(html.includes(`<h2>${phrase}</h2>`), `${id}: missing static ${phrase}`);
    for (const phrase of ['Practical Use Cases', 'Supported Inputs and Outputs', 'Limitations and Important Notes', 'Worked Example']) assert.ok(html.includes(`<h3>${phrase}</h3>`), `${id}: missing specific ${phrase}`);
    assert.ok(content[id].relatedGuides.length > 0);
  }
  // Check actual returned page links, including fragments, not just the source registry.
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    const href = match[1].replaceAll('&amp;', '&');
    if (!href.startsWith('/') && !href.startsWith('#')) continue;
    const url = new URL(href, `${PRODUCTION_ORIGIN}/${id ? `${id}/` : ''}`);
    const target = url.pathname.replace(/^\/|\/$/g, '');
    assert.ok(known.has(target), `${id}: dead internal link ${href}`);
    if (href.startsWith('#') && href.length > 1) assert.ok(html.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${id}: missing anchor ${href}`);
    checkedLinks++;
  }
}
assert.equal(checkedTools, 81);
console.log(`Phase 4 content contract passed: ${known.size} public pages, 81 indexable tool guides, ${editorial.length} editorial/category pages, ${checkedLinks} internal links, unique metadata/canonicals/H1s.`);
