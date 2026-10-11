import { readFile, writeFile } from 'node:fs/promises';
import { loadToolRegistry, loadToolQuality, loadToolContentRegistry } from './tool-registry.mjs';

// Read built HTML, not the content registry: this catches missing template output.
const root = new URL('../', import.meta.url);
const tools = await loadToolRegistry();
const quality = await loadToolQuality();
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const section = (html, title) => html.match(new RegExp(`<section[^>]*><h2>${title}</h2>([\\s\\S]*?)</section>`))?.[1] || '';
const paragraphValues = html => [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(match => text(match[1]));
const rows = [];
for (const tool of tools.filter(tool => quality[tool.id].indexable)) {
  const html = await readFile(new URL(`dist/${tool.id}/index.html`, root), 'utf8');
  const guide = html.match(/<article class="tool-content-guide"[\s\S]*?<\/article>\s*<\/section>/)?.[0] || html;
  const intro = paragraphValues(section(guide, 'About This Tool'))[0] || '';
  const howTo = text(section(guide, 'How to Use'));
  const faq = text(section(guide, 'Frequently Asked Questions'));
  const guidance = text(section(guide, 'Practical Use Cases'));
  rows.push({ id: tool.id, name: tool.name, title: text(html.match(/<title>(.*?)<\/title>/)?.[1] || ''),
    description: html.match(/<meta name="description" content="([^"]*)"/)?.[1] || '',
    h1: [...html.matchAll(/<h1\b/g)].length, intro, howTo, faq, guidance,
    paragraphs: paragraphValues(guide),
    examples: text(section(guide, 'Worked Example')),
    related: [...section(guide, 'Related Tools').matchAll(/href="([^"]+)"/g)].map(match => match[1]),
    guides: [...guide.matchAll(/href="(\/guides\/[^"#]+)"/g)].map(match => match[1]) });
}
const duplicateGroups = values => {
  const groups = new Map();
  for (const [id, value] of values) {
    if (!value) continue;
    const key = normalize(value);
    groups.set(key, [...new Set([...(groups.get(key) || []), id])]);
  }
  return [...groups].filter(([, ids]) => ids.length > 1).map(([value, routes]) => ({ value, routes }));
};
const similarity = (a, b) => {
  const x = new Set(normalize(a).split(' ')), y = new Set(normalize(b).split(' '));
  return [...x].filter(word => y.has(word)).length / Math.max(1, new Set([...x, ...y]).size);
};
const near = [];
for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
  for (const field of ['intro', 'howTo', 'faq']) {
    const score = similarity(rows[i][field], rows[j][field]);
    if (score >= 0.65) near.push({ field, left: rows[i].id, right: rows[j].id, score: Number(score.toFixed(2)) });
  }
}
const duplicates = Object.fromEntries(['title', 'description', 'intro', 'howTo', 'faq'].map(field => [field, duplicateGroups(rows.map(row => [row.id, row[field]]))]));
duplicates.paragraphs = duplicateGroups(rows.flatMap(row => row.paragraphs.map(value => [row.id, value])));
const priority = new Set('merge-pdf split-pdf compress-pdf pdf-to-jpg jpg-to-pdf image-to-pdf compress-image resize-image crop-image image-converter image-ocr background-remover barcode-generator json-tool password-generator gst-calculator emi-calculator'.split(' '));
const report = `# Phase 4 initial HTML content inventory\n\nBaseline captured before Phase 4 content edits. Source: existing dist/<route>/index.html, 81 indexable tools. This is a reproducible structural/duplication audit, not a claim of human editorial approval. No JavaScript was executed.\n\nUseful initial text means an actual introduction, instructions, practical cases and worked example exist in the returned HTML. Uniqueness below means exact comparison; near-duplicate wording uses word-set Jaccard >= 0.65 and still needs editorial judgment. Title/description duplicate groups: ${duplicates.title.length}/${duplicates.description.length}. Pages without exactly one H1: ${rows.filter(row => row.h1 !== 1).length}.\n\n| Tool | Route | Initial HTML substantive | Unique intro | Unique how-to | Unique FAQ | Practical guidance | Repetitive content risk | Related tools | Related guide | Rewrite priority |\n|---|---|---|---|---|---|---|---|---|---|---|\n${rows.map(row => {
  const matches = near.filter(pair => pair.left === row.id || pair.right === row.id);
  const unique = field => duplicates[field].some(group => group.routes.includes(row.id)) ? 'Repeated' : 'Exact-unique';
  return `| ${row.name} | /${row.id}/ | ${row.intro && row.howTo && row.guidance && row.examples ? 'Present; editorial depth review required' : 'Incomplete'} | ${unique('intro')} | ${unique('howTo')} | ${unique('faq')} | ${row.guidance && row.examples ? 'Cases + example present' : 'Missing'} | ${matches.length ? `High: ${[...new Set(matches.map(pair => pair.field))].join(', ')}` : 'Shared sentence frames still require review'} | ${row.related.length} | ${row.guides.length} | ${priority.has(row.id) || matches.length ? 'High' : 'Medium'} |`;
}).join('\n')}\n\n## Baseline duplication evidence\n\n${near.map(pair => `- ${pair.field}: /${pair.left}/ and /${pair.right}/ — ${pair.score}`).join('\n')}\n\n${duplicates.paragraphs.map(group => `- Repeated paragraph: “${group.value}” — ${group.routes.join(', ')}`).join('\n')}\n\n## Interpretation\n\nAll entries are read from generated HTML, not inferred from source definitions. Existing tool interaction requires JavaScript; informational sections do not. Exact uniqueness alone does not establish substantial original value. Most privacy paragraphs share a sentence frame; preserve accurate disclosures rather than disguising shared policy with synonyms. There are no related-guide links in the baseline. Full evidence is in PHASE4_CONTENT_BASELINE.json; do not overwrite that snapshot after rewriting.\n`;
if (process.argv.includes('--baseline')) {
  await writeFile(new URL('docs/PHASE4_CONTENT_INVENTORY.md', root), report, { flag: 'wx' });
  await writeFile(new URL('docs/PHASE4_CONTENT_BASELINE.json', root), JSON.stringify({ rows, duplicates, near }, null, 2) + '\n', { flag: 'wx' });
} else if (process.argv.includes('--report')) {
  const baseline = JSON.parse(await readFile(new URL('docs/PHASE4_CONTENT_BASELINE.json', root), 'utf8'));
  const content = await loadToolContentRegistry();
  const rewritten = Object.entries(content).filter(([, entry]) => entry.editorialStatus).map(([id]) => id);
  const repeated = rows.filter(row => /documented boundary is the conversion|purpose-built conversion|scenario comparison|result preparation|current .* implementation produces|use a representative source image/i.test(row.paragraphs.join(' ')));
  const qualityReport = `# Phase 4 content quality audit\n\n## Scope and evidence\n\nCompared the preserved initial-HTML baseline with current generated HTML for all 81 indexable tools. Exact checks normalize case and punctuation; near matches use word-set Jaccard >= 0.65. This is a screening threshold, not a Google metric or a substitute for human review. Existing repository tests use a looser 0.78 threshold.\n\n| Measure | Before | After |\n|---|---:|---:|\n| Duplicate title groups | ${baseline.duplicates.title.length} | ${duplicates.title.length} |\n| Duplicate meta groups | ${baseline.duplicates.description.length} | ${duplicates.description.length} |\n| Duplicate intro groups | ${baseline.duplicates.intro.length} | ${duplicates.intro.length} |\n| Cross-route identical paragraph groups | ${baseline.duplicates.paragraphs.length} | ${duplicates.paragraphs.length} |\n| Near intro/how-to/FAQ pairs at 0.65 | ${baseline.near.length} | ${near.length} |\n| Tools with related-guide links | ${baseline.rows.filter(row => row.guides.length).length} | ${rows.filter(row => row.guides.length).length} |\n\n## Material revisions\n\n${rewritten.map(id => `- /${id}/`).join('\n')}\n\nTwenty priority routes received new introductions, four-step instructions, practical examples, three tailored FAQs and tips. Three of those routes remain noindex/ad-free: Base64, QR Reader and Barcode Reader. The generic metadata suffix was removed across tools; canonical URLs and the 81/14 tool publication policy are unchanged. New category/guide pages are checked separately by phase4-content-contract.mjs for unique metadata, H1, canonical and real internal destinations.\n\n## Remaining sentence-frame debt\n\n${repeated.length} indexable tool pages still contain at least one legacy converter/calculator/utility sentence frame in a feature, use-case or explanatory block. They already have actual implementation guidance and examples, but this is not equivalent to completing the requested site-wide editorial rewrite.\n\n${repeated.map(row => `- /${row.id}/ — review source public_html/assets/tool-content.js and emitted dist/${row.id}/index.html`).join('\n')}\n\n## Remaining near matches\n\n${near.map(pair => `- ${pair.field}: /${pair.left}/ ↔ /${pair.right}/ (${pair.score})`).join('\n')}\n\n## Privacy and shared facts\n\nMost local-tool privacy paragraphs deliberately share the accurate distinction between local file bytes and account-history metadata. Repeated policy is not disguised with synonyms. Specialized map/network disclosures remain separate. Repetition of a shared formula or limitation can be legitimate; repeated generic advice is not treated as an original contribution.\n\n## Human review and release gate\n\nNo human editorial approval has occurred in this task. All 123 public pages should receive publisher sign-off in the whole-site review, including 109 indexable pages and the 14 review routes. The 20 new resource/category pages show their actual drafting date and explicitly state that human review is pending. Do not deploy these drafts or describe Phase 4 as fully complete while the remaining sentence-frame work and owner review are outstanding. No AdSense approval is guaranteed.\n`;
  await writeFile(new URL('docs/CONTENT_QUALITY_AUDIT.md', root), qualityReport);
  console.log(JSON.stringify({ routes: rows.length, rewritten: rewritten.length, baselineNearPairs: baseline.near.length, remainingNearPairs: near.length, legacyFrameRoutes: repeated.length, relatedGuides: rows.filter(row => row.guides.length).length }));
} else console.log(JSON.stringify({ routes: rows.length, duplicates, near }, null, 2));
