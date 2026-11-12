import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateArticleInput, renderMarkdown, blogSitemapXml, publicArticleUrl } from '../netlify/functions/_blog-core.mjs';
import { blogMediaStoreName } from '../netlify/functions/_blog-media.mjs';
import { indexNowKey, indexNowUrls, submitBlogIndexNow } from '../netlify/functions/_blog-indexnow.mjs';
import keyHandler from '../netlify/functions/blog-indexnow-key.mjs';

const productionStore = blogMediaStoreName({ deploy: { context: 'production', id: 'production-deploy-id' } });
const previewStore = blogMediaStoreName({ deploy: { context: 'deploy-preview', id: 'preview-deploy-1234' } });
assert.equal(productionStore, 'gxa-blog-media-production');
assert.equal(previewStore, 'gxa-blog-media-preview-preview-deploy-1234');
assert.equal(blogMediaStoreName({ deploy: { context: 'dev' } }), 'gxa-blog-media-dev');
assert.notEqual(previewStore, productionStore);
assert.throws(() => blogMediaStoreName(), /deploy context unavailable/);
assert.throws(() => blogMediaStoreName({ deploy: { context: 'deploy-preview' } }), /deploy context unavailable/);

const oldIndexNowKey = process.env.INDEXNOW_KEY;
process.env.INDEXNOW_KEY = 'test-IndexNow-key-1234';
const production = { deploy: { context: 'production' } };
const preview = { deploy: { context: 'deploy-preview' } };
assert.equal(indexNowKey(preview), null, 'Deploy Previews must never notify for production URLs');
assert.equal((await keyHandler(new Request('https://gxatoolbox.in/indexnow-key.txt'), preview)).status, 404);
const keyResponse = await keyHandler(new Request('https://gxatoolbox.in/indexnow-key.txt'), production);
assert.equal(keyResponse.status, 200);
assert.equal(await keyResponse.text(), process.env.INDEXNOW_KEY);
assert.deepEqual(indexNowUrls({ id: '1', version: 2, previousSlug: 'old-title', slug: 'new-title',
  beforePublic: true, afterPublic: true, significantChange: true }),
  ['https://gxatoolbox.in/blog/old-title/', 'https://gxatoolbox.in/blog/new-title/']);
assert.deepEqual(indexNowUrls({ previousSlug: 'draft-title', slug: 'draft-title', beforePublic: false,
  afterPublic: false, significantChange: true }), []);
assert.deepEqual(indexNowUrls({ previousSlug: 'published-title', slug: 'published-title', beforePublic: true,
  afterPublic: false, significantChange: true }), ['https://gxatoolbox.in/blog/published-title/']);
assert.deepEqual(indexNowUrls({ previousSlug: 'published-title', slug: 'published-title', beforePublic: true,
  afterPublic: true, significantChange: false }), []);
let providerCalls = 0;
const change = { id: 'post-1', version: 2, previousSlug: 'old-title', slug: 'new-title',
  beforePublic: true, afterPublic: true, significantChange: true };
const mockedProvider = async (url, init) => {
  providerCalls++;
  assert.equal(url, 'https://api.indexnow.org/indexnow');
  assert.deepEqual(JSON.parse(init.body).urlList, indexNowUrls(change));
  return { status: 202, headers: { get: () => null } };
};
assert.equal((await submitBlogIndexNow(change, preview, { fetch: mockedProvider })).state, 'skipped');
assert.equal((await submitBlogIndexNow(change, production, { fetch: mockedProvider })).state, 'accepted');
assert.equal((await submitBlogIndexNow(change, production, { fetch: mockedProvider })).state, 'duplicate');
assert.equal(providerCalls, 1);
const retryChange = { ...change, id: 'post-2' };
let retryCalls = 0;
const retried = await submitBlogIndexNow(retryChange, production, { pause: async () => {}, fetch: async () => {
  retryCalls++;
  return { status: retryCalls === 1 ? 503 : 200, headers: { get: () => null } };
} });
assert.equal(retried.state, 'accepted');
assert.equal(retryCalls, 2);
const rateLimited = await submitBlogIndexNow({ ...change, id: 'post-3' }, production, { pause: async () => {}, fetch: async () => ({
  status: 429, headers: { get: () => '600' }
}) });
assert.equal(rateLimited.state, 'rate_limited');
process.env.INDEXNOW_KEY = 'invalid key with spaces';
assert.equal(indexNowKey(production), null);
assert.equal((await keyHandler(new Request('https://gxatoolbox.in/indexnow-key.txt'), production)).status, 404);
if (oldIndexNowKey === undefined) delete process.env.INDEXNOW_KEY;
else process.env.INDEXNOW_KEY = oldIndexNowKey;

const markdown = '## Safe heading\n\nA useful paragraph. <script>alert(1)</script> [bad](javascript:alert(1))';
const html = renderMarkdown(markdown);
assert.match(html, /<h2>Safe heading<\/h2>/);
assert.doesNotMatch(html, /<script|javascript:/i);
const linkedHtml = renderMarkdown('[Merge PDF](/merge-pdf/) and [Reference](https://example.org/reference)');
assert.match(linkedHtml, /href="\/merge-pdf\/"/);
assert.doesNotMatch(linkedHtml.match(/<a[^>]*href="\/merge-pdf\/"[^>]*>/)?.[0] || '', /nofollow|target="_blank"/);
assert.match(linkedHtml, /href="https:\/\/example.org\/reference"[^>]*rel="noopener noreferrer"/);
assert.throws(() => validateArticleInput({ title: 'Valid title', slug: 'Bad Slug', markdown, categories: [], tags: [] }), /lowercase slug/);
assert.throws(() => validateArticleInput({ title: 'Valid title', slug: 'valid-slug', markdown, canonical_url: 'https://elsewhere.example/post', categories: [], tags: [] }), /Canonical URL/);
assert.equal(publicArticleUrl('safe-slug'), 'https://gxatoolbox.in/blog/safe-slug/');
const xml = blogSitemapXml([
  { slug:'published',status:'published',published_at:'2026-10-01T00:00:00.000Z',significant_updated_at:'2026-10-02T00:00:00.000Z',noindex:false },
  { slug:'draft',status:'draft',noindex:false },
  { slug:'noindex',status:'published',published_at:'2026-10-01T00:00:00.000Z',noindex:true },
  { slug:'scheduled',status:'scheduled',scheduled_at:'2099-01-01T00:00:00.000Z',noindex:false }
]);
assert.match(xml, /<loc>https:\/\/gxatoolbox\.in\/blog\/published\/<\/loc><lastmod>2026-10-02T00:00:00.000Z/);
for (const excluded of ['draft','noindex','scheduled']) assert.doesNotMatch(xml, new RegExp(`<loc>[^<]*${excluded}`));
const [robots, redirects, toml, staticXml, blogAdminHtml] = await Promise.all([
  readFile('dist/robots.txt','utf8'), readFile('dist/_redirects','utf8'), readFile('netlify.toml','utf8'),
  readFile('dist/sitemap.xml','utf8'), readFile('dist/admin/blog/index.html','utf8')
]);
assert.match(robots, /Sitemap: https:\/\/gxatoolbox\.in\/sitemap\.xml/);
assert.match(robots, /Sitemap: https:\/\/gxatoolbox\.in\/blog-sitemap\.xml/);
assert.equal((staticXml.match(/<url>/g) || []).length, 109);
assert.match(redirects, /\/blog-sitemap\.xml \/\.netlify\/functions\/blog-sitemap 200/);
assert.match(redirects, /\/indexnow-key\.txt \/\.netlify\/functions\/blog-indexnow-key 200/);
assert.match(toml, /from = "\/blog-sitemap\.xml"/);
assert.match(toml, /from = "\/indexnow-key\.txt"/);
assert.match(blogAdminHtml, /Blog Studio/);
console.log('Blog CMS contract passed: sanitized HTML, slug/canonical validation, sitemap visibility, 109 static URLs, dynamic routing and generated Admin Studio.');
