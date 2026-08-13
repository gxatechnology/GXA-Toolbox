import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTION_ORIGIN,
  canonicalToolUrl,
  loadBlockedToolIds,
  loadToolRegistry,
  toolDescription,
  toolTitle
} from '../scripts/tool-registry.mjs';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const distRoot = join(projectRoot, 'dist');

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
  const source = html.match(/<script\b[^>]*id=["']gxa-structured-data["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(source, `${route} is missing generated JSON-LD.`);
  const graph = JSON.parse(source);
  assert.equal(graph['@context'], 'https://schema.org', `${route} JSON-LD context is invalid.`);
  assert.ok(Array.isArray(graph['@graph']) && graph['@graph'].length > 0, `${route} JSON-LD graph is empty.`);
  return graph;
}

function assertSocialMetadata(html, { route, title, description, canonical }) {
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

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(path);
  }
  return files;
}

const [tools, blockedIds, netlify, robots, manifestSource] = await Promise.all([
  loadToolRegistry(),
  loadBlockedToolIds(),
  readFile(join(projectRoot, 'netlify.toml'), 'utf8'),
  readFile(join(distRoot, 'robots.txt'), 'utf8'),
  readFile(join(distRoot, 'site.webmanifest'), 'utf8')
]);

assert.equal(tools.length, 91, 'SEO generation must preserve all 91 registered tools.');
assert.deepEqual([...blockedIds], ['ppt-to-pdf'], 'Only PPT to PDF may be excluded from indexing.');
assert.match(netlify, /publish\s*=\s*["']dist["']/, 'Netlify must publish the generated dist directory.');
assert.doesNotMatch(netlify, /from\s*=\s*["']\/\*["']/, 'Netlify must not restore a broad SPA catch-all.');

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
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decodeHtml(match[1]));
assert.equal(sitemapUrls.length, 91, 'Sitemap must contain home plus 90 indexable tools.');
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'Sitemap URLs must be unique.');
assert.ok(sitemapUrls.includes(`${PRODUCTION_ORIGIN}/`), 'Homepage is missing from sitemap.');
assert.ok(!sitemapUrls.includes(canonicalToolUrl('ppt-to-pdf')), 'Blocked PPT to PDF route must not enter sitemap.');
for (const tool of tools.filter(tool => !blockedIds.has(tool.id))) {
  assert.ok(sitemapUrls.includes(canonicalToolUrl(tool.id)), `Sitemap is missing ${tool.id}.`);
}

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
}

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

console.log('SEO contract passed: 91 tools, 91 sitemap URLs, route metadata/JSON-LD, robots, manifest, and artifact isolation.');
