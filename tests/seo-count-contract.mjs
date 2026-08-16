import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_BUILD_COUNTS } from '../netlify/functions/_seo-build-counts.mjs';
import {
  PRODUCTION_ORIGIN,
  canonicalContentUrl,
  canonicalToolUrl,
  loadBlockedToolIds,
  loadContentPageRegistry,
  loadToolRegistry
} from '../scripts/tool-registry.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const [tools, blockedIds, contentPages, sitemap] = await Promise.all([
  loadToolRegistry(),
  loadBlockedToolIds(),
  loadContentPageRegistry(),
  readFile(join(dist, 'sitemap.xml'), 'utf8')
]);

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const indexableTools = tools.filter(tool => !blockedIds.has(tool.id));
const expectedSitemap = new Set([
  `${PRODUCTION_ORIGIN}/`,
  ...indexableTools.map(tool => canonicalToolUrl(tool.id)),
  ...contentPages.map(page => canonicalContentUrl(page.id))
]);

assert.equal(new Set(tools.map(tool => tool.id)).size, tools.length, 'Registered tool IDs must be unique.');
assert.equal(indexableTools.length + blockedIds.size, tools.length, 'Index/noindex tool counts do not reconcile.');
assert.equal(sitemapUrls.length, expectedSitemap.size, 'Sitemap count does not match current indexable registries.');
assert.deepEqual(new Set(sitemapUrls), expectedSitemap, 'Sitemap URLs drifted from current canonical registries.');
assert.ok(blockedIds.has('ppt-to-pdf'), 'PPT to PDF must remain explicitly noindex while its blocker exists.');
assert.ok(tools.some(tool => tool.id === 'background-remover'), 'Background Remover is missing from the registry.');
assert.ok(tools.some(tool => tool.id === 'image-ocr'), 'Image OCR is missing from the registry.');
assert.ok(sitemapUrls.includes(canonicalToolUrl('background-remover')), 'Background Remover is missing from the sitemap.');
assert.ok(sitemapUrls.includes(canonicalToolUrl('image-ocr')), 'Image OCR is missing from the sitemap.');
assert.ok(!sitemapUrls.some(url => /netlify\.app|localhost/i.test(url)), 'Sitemap contains a non-production host.');

for (const tool of tools) {
  assert.ok((await stat(join(dist, tool.id, 'index.html'))).isFile(), `Generated tool route is missing: ${tool.id}`);
}
for (const page of contentPages) {
  assert.ok((await stat(join(dist, page.id, 'index.html'))).isFile(), `Generated content route is missing: ${page.id}`);
}

assert.deepEqual(SEO_BUILD_COUNTS, {
  registeredTools: tools.length,
  indexableToolPages: indexableTools.length,
  noindexToolPages: blockedIds.size,
  companyLegalPages: contentPages.length,
  sitemapUrls: sitemapUrls.length,
  generatedPublicDirectRoutes: 1 + tools.length + contentPages.length,
  generatedNoindexPrivateRoutes: 2,
  generatedDirectRoutes: 1 + tools.length + contentPages.length + 2,
  generatedHtmlEntrypoints: 1 + tools.length + contentPages.length + 2 + 1,
  noindexPages: blockedIds.size + 2
});

console.log(`SEO count contract passed: ${tools.length} registered, ${indexableTools.length} indexable tools, ${blockedIds.size} noindex tool, ${contentPages.length} company/legal pages, ${sitemapUrls.length} sitemap URLs, ${SEO_BUILD_COUNTS.generatedPublicDirectRoutes} public and ${SEO_BUILD_COUNTS.generatedDirectRoutes} total generated direct routes.`);
