import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTION_ORIGIN,
  canonicalContentUrl,
  canonicalToolUrl,
  loadBlockedToolIds,
  loadContentPageRegistry,
  loadToolRegistry,
  toolDescription,
  toolTitle
} from '../scripts/tool-registry.mjs';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const distRoot = join(projectRoot, 'dist');
const GTM_CONTAINER_ID = 'GTM-TBQN2SJ4';
const GA4_MEASUREMENT_ID = 'G-E16HBF4R7W';
const ADSENSE_PUBLISHER_ID = 'ca-pub-6705105270847964';
const ADSENSE_SELLER_LINE = 'google.com, pub-6705105270847964, DIRECT, f08c47fec0942fa0';
const ADSENSE_LOADER_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decodeHtml = value => String(value)
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

function attribute(html, selectorAttribute, selectorValue, targetAttribute = 'content') {
  const tag = html.match(new RegExp(`<(?:meta|link)\\b[^>]*${selectorAttribute}=["']${escapeRegex(selectorValue)}["'][^>]*>`, 'i'))?.[0];
  assert.ok(tag, `Missing ${selectorAttribute}="${selectorValue}" metadata.`);
  const value = tag.match(new RegExp(`${targetAttribute}=["']([^"']*)["']`, 'i'))?.[1];
  assert.notEqual(value, undefined, `Missing ${targetAttribute} on ${selectorAttribute}="${selectorValue}".`);
  return decodeHtml(value);
}

function structuredData(html, route) {
  const scripts = [...html.matchAll(/<script\b[^>]*id=["']gxa-structured-data["'][^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, `${route} must contain exactly one generated JSON-LD block.`);
  const source = scripts[0]?.[1];
  assert.ok(source, `${route} is missing generated JSON-LD.`);
  const graph = JSON.parse(source);
  assert.equal(graph['@context'], 'https://schema.org', `${route} JSON-LD context is invalid.`);
  assert.ok(Array.isArray(graph['@graph']) && graph['@graph'].length > 0, `${route} JSON-LD graph is empty.`);
  return graph;
}

function assertSocialMetadata(html, { route, title, description, canonical }) {
  const singletonPatterns = [
    [/<title\b[^>]*>/gi, 'title'],
    [/<meta\b[^>]*name=["']description["'][^>]*>/gi, 'description'],
    [/<meta\b[^>]*name=["']robots["'][^>]*>/gi, 'robots'],
    [/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, 'canonical'],
    [/<meta\b[^>]*property=["']og:title["'][^>]*>/gi, 'Open Graph title'],
    [/<meta\b[^>]*property=["']og:description["'][^>]*>/gi, 'Open Graph description'],
    [/<meta\b[^>]*property=["']og:url["'][^>]*>/gi, 'Open Graph URL'],
    [/<meta\b[^>]*name=["']twitter:title["'][^>]*>/gi, 'Twitter title'],
    [/<meta\b[^>]*name=["']twitter:description["'][^>]*>/gi, 'Twitter description']
  ];
  for (const [pattern, label] of singletonPatterns) {
    assert.equal((html.match(pattern) || []).length, 1, `${route} must contain exactly one ${label} tag.`);
  }
  assert.equal(decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''), title, `${route} title is not unique/correct.`);
  assert.equal(attribute(html, 'name', 'description'), description, `${route} description is incorrect.`);
  assert.equal(attribute(html, 'rel', 'canonical', 'href'), canonical, `${route} canonical is incorrect.`);
  assert.equal(attribute(html, 'property', 'og:title'), title, `${route} Open Graph title is incorrect.`);
  assert.equal(attribute(html, 'property', 'og:description'), description, `${route} Open Graph description is incorrect.`);
  assert.equal(attribute(html, 'property', 'og:url'), canonical, `${route} Open Graph URL is incorrect.`);
  assert.equal(attribute(html, 'property', 'og:type'), 'website', `${route} Open Graph type is incorrect.`);
  assert.equal(attribute(html, 'name', 'twitter:title'), title, `${route} Twitter title is incorrect.`);
  assert.equal(attribute(html, 'name', 'twitter:description'), description, `${route} Twitter description is incorrect.`);
  assert.ok(['summary', 'summary_large_image'].includes(attribute(html, 'name', 'twitter:card')), `${route} Twitter card is invalid.`);
  assert.match(attribute(html, 'property', 'og:image'), /^https:\/\//, `${route} Open Graph image must be absolute.`);
  assert.match(attribute(html, 'name', 'twitter:image'), /^https:\/\//, `${route} Twitter image must be absolute.`);
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

function assertGoogleTagManager(html, route) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  assert.notEqual(head, undefined, `${route} has no head element.`);
  assert.notEqual(body, undefined, `${route} has no body element.`);

  const loaderScripts = (head.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [])
    .filter(script => script.includes('https://www.googletagmanager.com/gtm.js'));
  assert.equal(loaderScripts.length, 1, `${route} must contain exactly one GTM head loader.`);
  assert.equal(countOccurrences(head, GTM_CONTAINER_ID), 1, `${route} must contain the GTM container ID once in head.`);
  assert.equal(countOccurrences(head, 'https://www.googletagmanager.com/gtm.js'), 1, `${route} has a duplicate GTM loader URL.`);
  assert.ok(head.indexOf('https://www.googletagmanager.com/gtm.js') < head.search(/<title\b/i), `${route} GTM loader must precede the title.`);
  assert.match(loaderScripts[0], /w\[l\]=w\[l\]\|\|\[\]/, `${route} GTM dataLayer bootstrap is incomplete.`);
  assert.match(loaderScripts[0], /['"]gtm\.start['"]/, `${route} GTM start event is missing.`);
  assert.match(loaderScripts[0], /j\.async=true/, `${route} GTM loader must remain asynchronous.`);

  const noscriptBlocks = body.match(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi) || [];
  assert.equal(noscriptBlocks.length, 1, `${route} must contain exactly one GTM noscript block.`);
  assert.equal(countOccurrences(body, GTM_CONTAINER_ID), 1, `${route} must contain the GTM container ID once in body.`);
  assert.equal(countOccurrences(body, 'https://www.googletagmanager.com/ns.html'), 1, `${route} has a duplicate GTM noscript URL.`);
  assert.match(
    noscriptBlocks[0],
    new RegExp(`<iframe\\b[^>]*src=["']https://www\\.googletagmanager\\.com/ns\\.html\\?id=${GTM_CONTAINER_ID}["'][^>]*>[\\s\\S]*?<\\/iframe>`, 'i'),
    `${route} GTM noscript iframe is invalid.`
  );
  assert.match(
    body,
    /^\s*<!-- Google Tag Manager \(noscript\) -->\s*<noscript\b/i,
    `${route} GTM noscript block must immediately follow the opening body tag.`
  );

  assert.equal(countOccurrences(html, GTM_CONTAINER_ID), 2, `${route} must contain one head and one noscript container ID.`);
  assert.doesNotMatch(html, /googletagmanager\.com\/gtag\/js/i, `${route} must not load direct GA4 gtag.js.`);
  assert.doesNotMatch(html, /\bgtag\s*\(/i, `${route} must not call direct GA4 gtag().`);
  assert.doesNotMatch(html, /google-analytics\.com/i, `${route} must not load Google Analytics directly.`);
  assert.ok(!html.includes(GA4_MEASUREMENT_ID), `${route} must configure GA4 through GTM, not source HTML.`);
}

function assertAdSenseLoader(html, route) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert.notEqual(head, undefined, `${route} has no head element.`);
  const loaderScripts = (head.match(/<script\b[^>]*><\/script>/gi) || [])
    .filter(script => script.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'));
  assert.equal(loaderScripts.length, 1, `${route} must contain exactly one AdSense loader.`);
  assert.equal(countOccurrences(head, ADSENSE_LOADER_URL), 1, `${route} has a missing or duplicate AdSense loader URL.`);
  assert.equal(countOccurrences(html, ADSENSE_PUBLISHER_ID), 1, `${route} must contain the AdSense publisher ID exactly once.`);
  assert.match(loaderScripts[0], /<script\b[^>]*\basync\b/i, `${route} AdSense loader must be asynchronous.`);
  assert.match(loaderScripts[0], /\bcrossorigin=["']anonymous["']/i, `${route} AdSense loader must use anonymous CORS.`);
  assert.ok(head.indexOf(ADSENSE_LOADER_URL) < head.search(/<title\b/i), `${route} AdSense loader must precede the title.`);
  assert.doesNotMatch(html, /\bdata-ad-slot\s*=/i, `${route} must not contain an unconfigured or fake ad slot.`);
  assert.doesNotMatch(html, /\(\s*adsbygoogle\s*=|adsbygoogle\s*\.\s*push\s*\(/i, `${route} must not request a manual ad without a real unit ID.`);
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(path);
  }
  return files;
}

const [tools, blockedIds, contentPages, netlify, robots, manifestSource, rootTemplate, backgroundTemplate, appSource, backgroundFooterSource, backgroundAdPlaceholderSource] = await Promise.all([
  loadToolRegistry(),
  loadBlockedToolIds(),
  loadContentPageRegistry(),
  readFile(join(projectRoot, 'netlify.toml'), 'utf8'),
  readFile(join(distRoot, 'robots.txt'), 'utf8'),
  readFile(join(distRoot, 'site.webmanifest'), 'utf8'),
  readFile(join(projectRoot, 'index.html'), 'utf8'),
  readFile(join(projectRoot, 'background-remover-app', 'index.html'), 'utf8'),
  readFile(join(projectRoot, 'public_html', 'assets', 'app.js'), 'utf8'),
  readFile(join(projectRoot, 'background-remover-app', 'src', 'components', 'SiteFooter.tsx'), 'utf8'),
  readFile(join(projectRoot, 'background-remover-app', 'src', 'components', 'AdPlacementPlaceholder.tsx'), 'utf8')
]);

assert.ok(tools.length >= 90, 'SEO generation unexpectedly lost registered tools.');
assert.equal(contentPages.length, 6, 'All six company/legal pages must remain registered.');
assert.deepEqual([...blockedIds], ['ppt-to-pdf'], 'Only PPT to PDF may be excluded from indexing.');
assert.match(netlify, /publish\s*=\s*["']dist["']/, 'Netlify must publish the generated dist directory.');
assert.doesNotMatch(netlify, /from\s*=\s*["']\/\*["']/, 'Netlify must not restore a broad SPA catch-all.');
assertGoogleTagManager(rootTemplate, 'root HTML template');
assertGoogleTagManager(backgroundTemplate, 'Background Remover HTML template');
assertAdSenseLoader(rootTemplate, 'root HTML template');
assertAdSenseLoader(backgroundTemplate, 'Background Remover HTML template');
assert.match(appSource, /data-ad-placement="tool-content"/i, 'Tool pages are missing the future responsive ad mount.');
assert.match(appSource, /data-ad-state="awaiting-ad-unit"/i, 'Tool ad mount must remain explicitly unconfigured.');
assert.match(appSource, /data-ad-placement="tool-content"[\s\S]*?hidden/i, 'Tool ad mount must stay hidden until a real unit ID exists.');
assert.doesNotMatch(appSource, /\bdata-ad-slot\s*=/i, 'Main application source must not invent an AdSense slot ID.');
assert.match(backgroundAdPlaceholderSource, /data-ad-placement="tool-content"/i, 'Background Remover is missing the future responsive ad mount.');
assert.match(backgroundAdPlaceholderSource, /data-ad-state="awaiting-ad-unit"/i, 'Background Remover ad mount must remain explicitly unconfigured.');
assert.match(backgroundAdPlaceholderSource, /\bhidden\b/i, 'Background Remover ad mount must stay hidden until a real unit ID exists.');
assert.doesNotMatch(backgroundAdPlaceholderSource, /\bdata-ad-slot\s*=/i, 'Background Remover must not invent an AdSense slot ID.');

const footerSource = appSource.slice(appSource.indexOf('function renderFooter'), appSource.indexOf('// --- Page Navigator'));
const expectedProductLinks = [
  ['/merge-pdf/', 'tool-merge-pdf', 'Merge PDF'],
  ['/compress-image/', 'tool-compress-image', 'Compress Image'],
  ['/color-extractor/', 'tool-color-extractor', 'Color Extractor'],
  ['/password-generator/', 'tool-password-generator', 'Password Tool']
];
for (const [href, pageId, label] of expectedProductLinks) {
  assert.ok(footerSource.includes(`href="${href}"`), `Products footer link changed or disappeared: ${label}.`);
  assert.ok(footerSource.includes(`handleRouteLink(event, '${pageId}')`), `Products footer route handler changed: ${label}.`);
}
for (const page of contentPages) {
  assert.ok(footerSource.includes(`href="/${page.id}/"`), `Footer is missing /${page.id}/.`);
  assert.ok(footerSource.includes(`handleRouteLink(event, 'content-${page.id}')`), `Footer SPA route is missing for ${page.id}.`);
}
assert.ok(footerSource.includes('href="/?support=1"'), 'Contact Support needs a real fallback URL.');
assert.ok(appSource.includes('function handleSupportLink(event)'), 'Contact Support click behavior was removed.');
assert.ok(appSource.includes("get('support') === '1'"), 'Cross-route Contact Support requests are not opened on arrival.');
for (const [href, , label] of expectedProductLinks) {
  assert.ok(backgroundFooterSource.includes(`['${href}', '${label}']`), `Background Remover Products footer changed: ${label}.`);
}
for (const page of contentPages) assert.ok(backgroundFooterSource.includes(`['/${page.id}/', '${page.name}']`), `Background Remover footer is missing ${page.id}.`);
assert.ok(backgroundFooterSource.includes("['/?support=1', 'Contact Support']"), 'Background Remover Contact Support fallback is missing.');

assert.match(robots, /^User-agent:\s*\*/mi);
assert.match(robots, /^Allow:\s*\/\s*$/mi);
assert.match(robots, new RegExp(`^Sitemap:\\s*${escapeRegex(PRODUCTION_ORIGIN)}/sitemap\\.xml\\s*$`, 'mi'));
assert.doesNotMatch(robots, /Disallow:\s*\/$/mi, 'robots.txt must not block the whole site.');

const manifest = JSON.parse(manifestSource);
assert.equal(manifest.name, 'GXA Toolbox');
assert.ok(['GXA Toolbox', 'GXA Tools'].includes(manifest.short_name));
assert.match(manifest.start_url, /^(?:\.\/|\/)$/);
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Manifest icons are incomplete.');
for (const icon of manifest.icons) {
  assert.ok(icon.src && icon.sizes && icon.type, 'Every manifest icon needs src, sizes, and type.');
  assert.ok(await stat(join(distRoot, icon.src.replace(/^\.\//, ''))).then(value => value.isFile()), `Manifest icon is missing: ${icon.src}`);
}

const sitemap = await readFile(join(distRoot, 'sitemap.xml'), 'utf8');
const adsText = await readFile(join(distRoot, 'ads.txt'), 'utf8');
assert.equal(adsText.trim(), ADSENSE_SELLER_LINE, 'Generated ads.txt seller authorization is incorrect.');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decodeHtml(match[1]));
assert.equal(sitemapUrls.length, 1 + (tools.length - blockedIds.size) + contentPages.length, 'Sitemap count does not match the current registries.');
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'Sitemap URLs must be unique.');
assert.ok(sitemapUrls.includes(`${PRODUCTION_ORIGIN}/`), 'Homepage is missing from sitemap.');
assert.ok(!sitemapUrls.includes(canonicalToolUrl('ppt-to-pdf')), 'Blocked PPT to PDF route must not enter sitemap.');
for (const tool of tools.filter(tool => !blockedIds.has(tool.id))) {
  assert.ok(sitemapUrls.includes(canonicalToolUrl(tool.id)), `Sitemap is missing ${tool.id}.`);
}
for (const page of contentPages) assert.ok(sitemapUrls.includes(canonicalContentUrl(page.id)), `Sitemap is missing ${page.id}.`);

const home = await readFile(join(distRoot, 'index.html'), 'utf8');
assertSocialMetadata(home, {
  route: '/',
  title: 'GXA Toolbox — Your Complete Digital Toolbox',
  description: 'Use browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations with GXA Toolbox.',
  canonical: `${PRODUCTION_ORIGIN}/`
});
assert.match(home, /data-static-route-shell/);
assert.match(home, /<h1\b[^>]*>[\s\S]*Your Complete[\s\S]*Digital Toolbox[\s\S]*<\/h1>/i);
structuredData(home, '/');
assertGoogleTagManager(home, '/');
assertAdSenseLoader(home, '/');

let generatedPublicPageCount = 1;
let adSenseVerifiedPublicPageCount = 1;
for (const tool of tools) {
  const route = `/${tool.id}/`;
  const html = await readFile(join(distRoot, tool.id, 'index.html'), 'utf8');
  const canonical = canonicalToolUrl(tool.id);
  assertSocialMetadata(html, {
    route,
    title: toolTitle(tool),
    description: toolDescription(tool),
    canonical
  });
  assert.match(html, /<h1\b[^>]*>[\s\S]*?<\/h1>/i, `${route} has no static H1 shell.`);
  assert.ok(html.includes(tool.name), `${route} static shell does not identify its tool.`);
  assert.equal(
    attribute(html, 'name', 'robots'),
    blockedIds.has(tool.id) ? 'noindex, follow' : 'index, follow',
    `${route} robots directive is incorrect.`
  );
  const graph = structuredData(html, route);
  assert.ok(JSON.stringify(graph).includes(canonical), `${route} JSON-LD does not identify its canonical URL.`);
  assertGoogleTagManager(html, route);
  assertAdSenseLoader(html, route);
  generatedPublicPageCount += 1;
  adSenseVerifiedPublicPageCount += 1;
}
for (const page of contentPages) {
  const route = `/${page.id}/`;
  const html = await readFile(join(distRoot, page.id, 'index.html'), 'utf8');
  const canonical = canonicalContentUrl(page.id);
  assertSocialMetadata(html, { route, title: page.title, description: page.description, canonical });
  assert.equal(attribute(html, 'name', 'robots'), 'index, follow', `${route} must be indexable.`);
  assert.match(html, new RegExp(`<h1\\b[^>]*>\\s*${escapeRegex(page.name)}\\s*<\\/h1>`, 'i'), `${route} static H1 is incorrect.`);
  assert.ok(html.includes(page.intro), `${route} is missing meaningful static introductory content.`);
  const graph = structuredData(html, route);
  assert.ok(JSON.stringify(graph).includes(canonical), `${route} JSON-LD does not identify its canonical URL.`);
  assertGoogleTagManager(html, route);
  assertAdSenseLoader(html, route);
  generatedPublicPageCount += 1;
  adSenseVerifiedPublicPageCount += 1;
}
assert.equal(generatedPublicPageCount, 1 + tools.length + contentPages.length, 'GTM contract must cover the homepage and every current public route.');
assert.equal(adSenseVerifiedPublicPageCount, 1 + tools.length + contentPages.length, 'AdSense contract must cover the homepage and every current public route.');

const dashboard = await readFile(join(distRoot, 'dashboard', 'index.html'), 'utf8');
assert.doesNotMatch(dashboard, /pagead2\.googlesyndication\.com/i, 'Private dashboard must not load AdSense.');
const notFound = await readFile(join(distRoot, '404.html'), 'utf8');
assert.doesNotMatch(notFound, /pagead2\.googlesyndication\.com/i, 'The generated 404 page must not load AdSense.');

const files = await listFiles(distRoot);
const forbiddenExtensions = new Set(['.php', '.sql']);
const forbiddenSegments = /(^|[\\/])(?:tests|scripts|docs|config|netlify)(?:[\\/]|$)/i;
const forbiddenNames = new Set(['.env', 'database.sql', 'netlify.toml', 'package.json', 'package-lock.json']);
for (const file of files) {
  const path = relative(distRoot, file);
  assert.ok(!forbiddenExtensions.has(extname(file).toLowerCase()), `Server source leaked into dist: ${path}`);
  assert.doesNotMatch(path, forbiddenSegments, `Repository-only directory leaked into dist: ${path}`);
  assert.ok(!forbiddenNames.has(path.toLowerCase()), `Repository source leaked into dist: ${path}`);
}

console.log(`SEO contract passed: ${tools.length} tools, ${contentPages.length} company/legal pages, ${sitemapUrls.length} sitemap URLs, ${generatedPublicPageCount} GTM/AdSense-verified public pages, ads.txt, unique route metadata/JSON-LD, footer links, robots, manifest, and artifact isolation.`);
