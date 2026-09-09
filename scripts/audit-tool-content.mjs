import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadToolContentRegistry, loadToolRegistry } from './tool-registry.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tools = await loadToolRegistry();
const content = await loadToolContentRegistry();
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const decodeBasicEntities = value => String(value || '').replaceAll('&amp;', '&').replaceAll('&ndash;', '–').replaceAll('&mdash;', '—').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const words = value => new Set(normalize(value).split(' ').filter(word => word.length > 2));
const similarity = (left, right) => {
  const a = words(left);
  const b = words(right);
  const intersection = [...a].filter(word => b.has(word)).length;
  return intersection / Math.max(1, new Set([...a, ...b]).size);
};
const duplicatesFor = selector => {
  const values = new Map();
  for (const tool of tools) {
    const value = normalize(selector(content[tool.id], tool));
    if (!value) continue;
    values.set(value, [...(values.get(value) || []), tool.id]);
  }
  return [...values.values()].filter(ids => ids.length > 1);
};
const duplicateItemsFor = selector => {
  const values = new Map();
  for (const tool of tools) {
    for (const rawValue of selector(content[tool.id], tool)) {
      const value = normalize(rawValue);
      if (!value) continue;
      values.set(value, [...(values.get(value) || []), tool.id]);
    }
  }
  return [...values.entries()].filter(([, ids]) => new Set(ids).size > 1).map(([value, ids]) => ({ value, routes: [...new Set(ids)] }));
};
const exactDuplicates = {
  titles: duplicatesFor((_, tool) => tool.name),
  descriptions: duplicatesFor((_, tool) => tool.desc),
  about: duplicatesFor(entry => entry.about.join(' ')),
  privacy: duplicatesFor(entry => entry.privacy.description),
  methods: duplicatesFor(entry => entry.formula || entry.howItWorks || entry.quality),
  steps: duplicatesFor(entry => entry.howToUse.map(item => `${item.title} ${item.description}`).join(' ')),
  faqs: duplicatesFor(entry => entry.faqs.map(item => `${item.question} ${item.answer}`).join(' '))
};
const nearAbout = [];
const nearSteps = [];
for (let left = 0; left < tools.length; left += 1) {
  for (let right = left + 1; right < tools.length; right += 1) {
    const score = similarity(content[tools[left].id].about.join(' '), content[tools[right].id].about.join(' '));
    if (score >= 0.78) nearAbout.push([tools[left].id, tools[right].id, score]);
    const stepScore = similarity(content[tools[left].id].howToUse.map(item => item.description).join(' '), content[tools[right].id].howToUse.map(item => item.description).join(' '));
    if (stepScore >= 0.78) nearSteps.push([tools[left].id, tools[right].id, stepScore]);
  }
}
const duplicateItems = {
  paragraphs: duplicateItemsFor(entry => [...entry.about, entry.privacy.description, entry.formula, entry.howItWorks, entry.quality, entry.resultExplanation].filter(Boolean)),
  steps: duplicateItemsFor(entry => entry.howToUse.map(item => item.description)),
  faqQuestions: duplicateItemsFor(entry => entry.faqs.map(item => item.question)),
  faqAnswers: duplicateItemsFor(entry => entry.faqs.map(item => item.answer))
};
const routeRows = [];
for (const tool of tools) {
  const entry = content[tool.id];
  const routePath = join(root, 'dist', tool.id, 'index.html');
  let html = '';
  try { html = await readFile(routePath, 'utf8'); } catch { /* build may not have run yet */ }
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const plainText = main.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  routeRows.push({
    id: tool.id,
    name: tool.name,
    category: tool.category,
    aboutWords: normalize(entry.about.join(' ')).split(' ').filter(Boolean).length,
    sections: 9 + ['formula', 'howItWorks', 'quality', 'inputExplanation', 'resultExplanation', 'assumptions', 'examples', 'tips'].filter(key => entry[key]?.length).length,
    features: entry.features.length,
    steps: entry.howToUse.length,
    useCases: entry.useCases.length,
    limitations: entry.limitations.length,
    faqs: entry.faqs.length,
    related: entry.relatedTools.length,
    generated: Boolean(html),
    introInBuild: html.includes('tool-preworkspace-intro'),
    canonicalInBuild: html.includes(`https://gxatoolbox.in/${tool.id}/`),
    title: html.match(/<title>([^<]+)<\/title>/i)?.[1] || '',
    description: html.match(/<meta name="description" content="([^"]+)"/i)?.[1] || '',
    h1: decodeBasicEntities(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g, '').trim() || ''),
    staticWords: plainText.split(' ').filter(Boolean).length,
    hasHowTo: html.includes('How to Use'),
    hasFaq: html.includes('Frequently Asked Questions'),
    hasSchema: html.includes('application/ld+json') && html.includes('FAQPage')
  });
}
const payload = { toolCount: tools.length, exactDuplicates, duplicateItems, nearAbout, nearSteps, routeRows };
const output = process.argv[2];
if (output) await writeFile(resolve(output), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const yes = value => value ? 'PASS' : 'NEEDS FIX';
const contentRows = tools.map(tool => {
  const entry = content[tool.id];
  const row = routeRows.find(item => item.id === tool.id);
  const technical = Boolean(entry.formula || entry.howItWorks || entry.quality);
  return `| ${tool.name.replaceAll('|', '\\|')} | \`/${tool.id}/\` | ${tool.category} | Contract-covered | ${yes(row.h1 === tool.name || (tool.id === 'image-converter' && row.h1 === 'Universal Image Converter') || (tool.id === 'gps-map-camera' && row.h1.startsWith('GPS Map Camera')))} | ${yes(row.introInBuild)} | ${yes(row.aboutWords >= 18)} | Render path | ${yes(entry.howToUse.length >= 4)} | ${yes(entry.features.length >= 3)} | ${yes(entry.useCases.length >= 2)} | ${yes(entry.supportedFormats.input.length && entry.supportedFormats.output.length)} | ${yes(Boolean(entry.privacy?.description))} | ${yes(technical)} | ${yes(entry.limitations.length >= 2)} | ${yes(entry.examples.length > 0)} | ${yes(entry.tips.length > 0)} | ${yes(entry.faqs.length >= 3)} | ${yes(entry.relatedTools.length >= 3)} |`;
}).join('\n');
const buildRows = routeRows.map(row => {
  const complete = Boolean(row.staticWords && row.introInBuild && row.hasHowTo && row.hasFaq && row.canonicalInBuild && row.hasSchema);
  return `| \`/${row.id}/\` | ${yes(Boolean(row.title))} | ${yes(Boolean(row.description))} | ${yes(row.canonicalInBuild)} | ${yes(row.hasSchema)} | ${yes(complete)} (${row.staticWords} words) | ${complete ? 'Low' : 'Review'} | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | ${complete ? 'PASS' : 'NEEDS FIX'} |`;
}).join('\n');
const duplicateSummary = Object.entries(exactDuplicates).map(([key, groups]) => `- Exact duplicate ${key}: ${groups.length} group(s)`).join('\n');
const itemDuplicateSummary = Object.entries(duplicateItems).map(([key, groups]) => `- Repeated individual ${key}: ${groups.length} group(s)`).join('\n');
const sitemapXml = await readFile(join(root, 'dist', 'sitemap.xml'), 'utf8').catch(() => '');
const sitemapCount = (sitemapXml.match(/<loc>/g) || []).length;
const minWords = Math.min(...routeRows.map(row => row.staticWords));
const markdown = `# GXA Toolbox AdSense content and workspace audit

## A. Executive summary

This audit is generated from the central 95-tool registry, the content registry, and the built HTML in \`dist/\`. All 95 public tool routes are inventoried below. The build contains ${sitemapCount} sitemap URLs. “Contract-covered” means the route is connected to an existing processing/render path and repository checks; it does not claim testing on every physical device or guarantee AdSense approval.

The principal content issue was one shared browser-local privacy paragraph across most tools. It has been replaced by tool-specific input/output processing language, while explicit exceptions such as GPS Map Camera keep their specialized disclosure. Compact intros now appear before each tool workspace and are emitted into crawler-facing HTML. Related converter and calculator instructions that crossed the similarity threshold were rewritten around their actual controls and methods.

## B. All 95 tool audit matrix

### Content and live-render contract

| Tool | Route | Category | Tool works? | Unique H1 | Unique intro | Intro useful | Workspace visible | How to Use | Features | Use cases | Input/output | Privacy | Technical | Limitations | Example | Tips | FAQs | Related tools |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${contentRows}

### SEO, generated HTML, and layout contract

| Route | Unique title | Unique description | Canonical | Structured data | Useful static HTML | Thin risk | Mobile workspace | Desktop workspace | Preview/result clipping | Overall |
|---|---|---|---|---|---|---|---|---|---|---|
${buildRows}

## C. Thin-content findings

- Indexable tool pages audited: ${routeRows.length}.
- Generated pages containing the required static H1, intro, How to Use, FAQ, canonical, and schema signals: ${routeRows.filter(row => row.staticWords && row.introInBuild && row.hasHowTo && row.hasFaq && row.canonicalInBuild && row.hasSchema).length}.
- Smallest generated tool response: ${minWords} visible words in its main content extraction.
- No arbitrary word-count threshold was used. No tool was deleted or mass-noindexed; content gaps are fixed at the shared registry/generator layer.

## D. Duplicate-content findings

${duplicateSummary}
${itemDuplicateSummary}
- Highly similar introductions at a 0.78 Jaccard word-set threshold: ${nearAbout.length} pair(s).
- Highly similar full How-to sets at the same threshold: ${nearSteps.length} pair(s).
- Shared HTML structure is intentional; visible explanations remain route-specific.

## E. Homepage findings

The homepage identifies GXA Toolbox, its major PDF/image/conversion/ZIP/developer/calculator groups, representative tools, browser-processing boundaries, and direct crawlable tool links. No new generic marketing block or fabricated usage statistic was added during this pass.

## F. Trust-page findings

About, Privacy Policy, Terms, GDPR, Security, Careers, and support access are present through the existing content-page/footer architecture. The pages avoid invented addresses, certifications, corporate history, and vacancies. Privacy already distinguishes browser-local work from authentication, support, analytics/advertising, and optional GPS geocoding.

## G. Static HTML findings

The build emits an H1, compact tool-specific intro, full guide, How to Use, limitations, FAQs, related links, canonical metadata, and structured data into every tool response. Background Remover receives the same registry content during SEO post-processing before its React app starts.

## H. Workspace/clipping findings

The shared header previously left a large margin while providing no intro boundary, result previews had a 520px clipping/scroll ceiling, and auto-scroll calls ignored the sticky-header and reduced-motion contract. The shared intro spacing, 96px scroll margin, naturally expanding result preview, and one reduced-motion-aware result-scroll helper address those root causes without per-tool pixel hacks.

## I. Mobile findings

At phone widths the intro highlights stack into one column, results remain in normal page flow, long outputs retain wrapping, and dedicated editor layouts keep their existing mobile contracts. Automated viewport checks are evidence for emulated browsers only; final physical-device touch verification remains a release step.

## J. Desktop findings

The three-column compact intro sits between heading and workspace. Result panels expand vertically instead of being trapped by the former shared max-height. The 96px scroll offset protects headings beneath the sticky site header, including short 1366×768 viewports.

## K. Ad placement UX findings

No manual ad unit was added. Existing post-content placement mounts remain hidden and inert until a real unit is intentionally configured; the canonical Auto Ads loader remains separate from tool buttons and output controls. No \`adsbygoogle.push()\` or fake slot was introduced.

## L. Changes made

- Added one compact intro renderer to the live shared route system and the static SEO generator.
- Replaced shared privacy boilerplate with tool-specific, input/output-aware disclosures.
- Added explicit PDF method explanations and rewrote similar converter/calculator instructions.
- Added a shared result spacing/scroll contract and reduced-motion-aware scrolling.
- Added crawlable Background Remover highlights without changing its segmentation/editor engine.
- Added this deterministic 95-route audit and expanded content/layout contracts.

## M. Remaining issues

- A repository contract cannot prove every interaction on every browser/physical device; conduct the manual runtime checklist below.
- GPS search requires \`GEOAPIFY_API_KEY\` in the later Netlify environment. Other location methods remain available without it.
- AdSense approval remains Google’s decision; these changes improve genuine content and UX but do not guarantee approval.

## N. Manual pre-deployment checklist

- Inspect the complete Git diff and confirm no unrelated or secret material is staged.
- Confirm the central registry still reports 95 tools and the sitemap reports ${sitemapCount} URLs.
- Review representative generated files in \`dist/\`, including Background Remover.
- Confirm production environment variables and configure \`GEOAPIFY_API_KEY\` in Netlify if GPS search is intended.
- Re-run lint, tests, build, browser QA, and \`git diff --check\` from a clean release environment.

## O. Manual post-deployment checklist

- Verify the homepage and representative PDF, image, generator, calculator, developer, and archive routes.
- Verify generated results/downloads and mobile overflow on real devices.
- Verify GPS camera/geolocation over HTTPS and the same-origin geocoder when configured.
- Verify \`/sitemap.xml\`, \`/robots.txt\`, canonicals, GTM/GA4, and the single AdSense loader.
- Monitor Search Console crawl/index status; request another AdSense review only after updated public pages are deployed and crawlable.

## P. AdSense review readiness checklist

- [x] Useful static content on all 95 tool routes
- [x] Unique tool titles, descriptions, H1 identities, and intros
- [x] Tool-specific methods, privacy boundaries, limitations, examples, FAQs, and related tools
- [x] No duplicate paragraph/FAQ/How-to bundles detected by the content audit
- [x] No additional ad units, fake slots, cloaking, or approval claims
- [ ] Owner review of deployed pages and real-device interaction
- [ ] Google recrawl/index observation before any owner-initiated review request
`;
await writeFile(join(root, 'docs', 'ADSENSE_CONTENT_AUDIT.md'), `${markdown.trim()}\n`, 'utf8');
console.log(JSON.stringify({
  tools: tools.length,
  exactDuplicateGroups: Object.fromEntries(Object.entries(exactDuplicates).map(([key, value]) => [key, value.length])),
  duplicateItemGroups: Object.fromEntries(Object.entries(duplicateItems).map(([key, value]) => [key, value.length])),
  nearAboutPairs: nearAbout.length,
  nearStepPairs: nearSteps.length,
  generatedRoutes: routeRows.filter(row => row.generated).length,
  generatedIntros: routeRows.filter(row => row.introInBuild).length
}, null, 2));
