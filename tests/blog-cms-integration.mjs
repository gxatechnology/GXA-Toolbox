import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDatabase } from '@netlify/database';
import { NetlifyDB } from '@netlify/database-dev';
import { createAdminSessionToken, ADMIN_SESSION_COOKIE } from '../netlify/functions/_admin-auth.mjs';
import { setDatabaseClientForTests } from '../netlify/functions/_database.mjs';
import { setBlogCachePurgerForTests } from '../netlify/functions/_blog-cache.mjs';
import { setBlogMediaStoreForTests } from '../netlify/functions/_blog-media.mjs';
import adminHandler from '../netlify/functions/blog-admin.mjs';
import articleHandler from '../netlify/functions/blog-public.mjs';
import sitemapHandler from '../netlify/functions/blog-sitemap.mjs';
import mediaAdminHandler from '../netlify/functions/blog-media-admin.mjs';
import mediaPublicHandler from '../netlify/functions/blog-media-public.mjs';

const migrations = fileURLToPath(new URL('../netlify/database/migrations', import.meta.url));
const staticSitemap = fileURLToPath(new URL('../dist/sitemap.xml', import.meta.url));
const local = new NetlifyDB({ logger: () => {} });
let database;
const cachePurges = [];
const mediaBlobs = new Map();
process.env.ADMIN_SESSION_SECRET = 'local-isolated-blog-test-secret-32-characters';
setBlogCachePurgerForTests(async ({ tags }) => { cachePurges.push(tags); });
setBlogMediaStoreForTests({ set: async (key, bytes) => { mediaBlobs.set(key, bytes); }, get: async key => mediaBlobs.get(key), delete: async key => { mediaBlobs.delete(key); } });

const adminRequest = (method, path, body) => new Request(`https://gxatoolbox.in${path}`, {
  method,
  headers: { Origin: 'https://gxatoolbox.in', 'sec-fetch-site': 'same-origin', 'x-gxa-admin-request': '1',
    'Content-Type': 'application/json', Cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(createAdminSessionToken())}` },
  body: body ? JSON.stringify(body) : undefined
});
const publicRequest = path => new Request(`https://gxatoolbox.in${path}`);
const article = (slug, status = 'draft', extra = {}) => ({ title: 'A practical PDF workflow guide', slug,
  excerpt: 'Learn how to prepare and check a PDF workflow.', markdown: '## Prepare the document\n\nUse a readable file and inspect its pages before processing. Then check the downloaded result carefully for page order and text legibility.',
  status, noindex: false, author_name: 'GXA Technologies', categories: ['PDF'], tags: ['workflow'], ...extra });

try {
  const connectionString = await local.start();
  const names = (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort().map(name => name.slice(0, -4));
  assert.ok(names.includes('0010_create_blog_schema'));
  assert.deepEqual(await local.applyMigrations(migrations), names);
  database = getDatabase({ connectionString });
  setDatabaseClientForTests(database);
  const tables = await database.pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'blog_%' ORDER BY table_name`);
  assert.equal(tables.rows.length, 10, 'ten additive blog tables');
  const staticBefore = await stat(staticSitemap);
  assert.equal((await readFile(staticSitemap, 'utf8')).match(/<url>/g)?.length, 109, 'existing static sitemap inventory remains intact');

  const draft = await adminHandler(adminRequest('POST', '/api/blog-admin', article('example-pdf-workflow')));
  assert.equal(draft.status, 200, await draft.clone().text());
  const created = (await draft.json()).post;
  const initialSitemapResponse = await sitemapHandler(publicRequest('/blog-sitemap.xml'));
  assert.equal(initialSitemapResponse.status, 200);
  assert.match(initialSitemapResponse.headers.get('content-type'), /application\/xml; charset=utf-8/);
  let sitemap = await initialSitemapResponse.text();
  assert.doesNotMatch(sitemap, /example-pdf-workflow/);
  assert.equal((await articleHandler(publicRequest('/blog/example-pdf-workflow/?slug=example-pdf-workflow'))).status, 404);

  const published = await adminHandler(adminRequest('PATCH', `/api/blog-admin?id=${created.id}`, { ...article('example-pdf-workflow', 'published'), version: created.version }));
  assert.equal(published.status, 200, await published.clone().text());
  const current = (await published.json()).post;
  sitemap = await (await sitemapHandler(publicRequest('/blog-sitemap.xml'))).text();
  assert.match(sitemap, /https:\/\/gxatoolbox\.in\/blog\/example-pdf-workflow\//);
  assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}T/);
  const publicHtml = await articleHandler(publicRequest('/blog/example-pdf-workflow/?slug=example-pdf-workflow'));
  assert.equal(publicHtml.status, 200);
  const html = await publicHtml.text();
  assert.match(html, /<h1>A practical PDF workflow guide<\/h1>/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /rel="canonical" href="https:\/\/gxatoolbox\.in\/blog\/example-pdf-workflow\/"/);
  assert.equal((await stat(staticSitemap)).mtimeMs, staticBefore.mtimeMs, 'publication must not rebuild the static sitemap');
  assert.ok(cachePurges.some(tags => tags.includes('gxa-blog-sitemap') && tags.includes('gxa-blog-article-example-pdf-workflow')));

  const beforeLastmod = sitemap.match(/<lastmod>(.*?)<\/lastmod>/)[1];
  const edited = await adminHandler(adminRequest('PATCH', `/api/blog-admin?id=${created.id}`, { ...article('example-pdf-workflow', 'published', { markdown: article('x').markdown + '\n\nA new significant check: reopen the saved document.' }), version: current.version }));
  assert.equal(edited.status, 200, await edited.clone().text());
  sitemap = await (await sitemapHandler(publicRequest('/blog-sitemap.xml'))).text();
  assert.ok(new Date(sitemap.match(/<lastmod>(.*?)<\/lastmod>/)[1]) >= new Date(beforeLastmod));
  const version = (await edited.json()).post.version;

  const renamed = await adminHandler(adminRequest('PATCH', `/api/blog-admin?id=${created.id}`, { ...article('renamed-pdf-workflow', 'published'), version }));
  assert.equal(renamed.status, 200, await renamed.clone().text());
  sitemap = await (await sitemapHandler(publicRequest('/blog-sitemap.xml'))).text();
  assert.match(sitemap, /renamed-pdf-workflow/); assert.doesNotMatch(sitemap, /example-pdf-workflow/);
  assert.equal((await articleHandler(publicRequest('/blog/example-pdf-workflow/?slug=example-pdf-workflow'))).status, 301);
  const renamedVersion = (await renamed.json()).post.version;
  const badCanonical = await adminHandler(adminRequest('PATCH', `/api/blog-admin?id=${created.id}`, { ...article('renamed-pdf-workflow', 'published', { canonical_url: 'https://gxatoolbox.in/blog/' }), version: renamedVersion }));
  assert.equal(badCanonical.status, 400, 'a changed canonical must never point to a different article');
  const canonicalChanged = await adminHandler(adminRequest('PATCH', `/api/blog-admin?id=${created.id}`, { ...article('renamed-pdf-workflow', 'published', { canonical_url: 'https://gxatoolbox.in/blog/renamed-pdf-workflow/' }), version: renamedVersion }));
  assert.equal(canonicalChanged.status, 200, await canonicalChanged.clone().text());
  const canonicalHtml = await (await articleHandler(publicRequest('/blog/renamed-pdf-workflow/?slug=renamed-pdf-workflow'))).text();
  assert.match(canonicalHtml, /rel="canonical" href="https:\/\/gxatoolbox\.in\/blog\/renamed-pdf-workflow\/"/);

  const noindex = await adminHandler(adminRequest('PATCH', `/api/blog-admin?id=${created.id}`, { ...article('renamed-pdf-workflow', 'published', { noindex: true }), version: (await canonicalChanged.json()).post.version }));
  assert.equal(noindex.status, 200, await noindex.clone().text());
  sitemap = await (await sitemapHandler(publicRequest('/blog-sitemap.xml'))).text(); assert.doesNotMatch(sitemap, /renamed-pdf-workflow/);
  const noindexHtml = await (await articleHandler(publicRequest('/blog/renamed-pdf-workflow/?slug=renamed-pdf-workflow'))).text();
  assert.match(noindexHtml, /name="robots" content="noindex, follow"/);

  const unpublished = await adminHandler(adminRequest('PATCH', `/api/blog-admin?id=${created.id}`, { ...article('renamed-pdf-workflow', 'draft'), version: (await noindex.json()).post.version }));
  assert.equal(unpublished.status, 200, await unpublished.clone().text());
  assert.ok(cachePurges.at(-1).includes('gxa-blog-article-renamed-pdf-workflow'), 'unpublish must purge the old article cache tag');
  assert.equal((await articleHandler(publicRequest('/blog/renamed-pdf-workflow/?slug=renamed-pdf-workflow'))).status, 404);
  sitemap = await (await sitemapHandler(publicRequest('/blog-sitemap.xml'))).text(); assert.doesNotMatch(sitemap, /renamed-pdf-workflow/);

  const scheduled = await adminHandler(adminRequest('POST', '/api/blog-admin', article('scheduled-pdf-workflow', 'scheduled', { scheduled_at: new Date(Date.now() + 86400000).toISOString() })));
  assert.equal(scheduled.status, 200, await scheduled.clone().text());
  assert.equal((await articleHandler(publicRequest('/blog/scheduled-pdf-workflow/?slug=scheduled-pdf-workflow'))).status, 404);
  sitemap = await (await sitemapHandler(publicRequest('/blog-sitemap.xml'))).text(); assert.doesNotMatch(sitemap, /scheduled-pdf-workflow/);
  await database.pool.query('UPDATE public.blog_posts SET scheduled_at=CURRENT_TIMESTAMP - INTERVAL \'1 minute\' WHERE slug=$1', ['scheduled-pdf-workflow']);
  sitemap = await (await sitemapHandler(publicRequest('/blog-sitemap.xml'))).text(); assert.match(sitemap, /scheduled-pdf-workflow/);
  assert.equal((await articleHandler(publicRequest('/blog/scheduled-pdf-workflow/?slug=scheduled-pdf-workflow'))).status, 200);
  const conflict = await adminHandler(adminRequest('POST', '/api/blog-admin', article('renamed-pdf-workflow')));
  assert.equal(conflict.status, 409, 'published/unpublished slug may not be reused by another article');
  const deleted = await adminHandler(adminRequest('DELETE', `/api/blog-admin?id=${created.id}`, { version: (await unpublished.json()).post.version }));
  assert.equal(deleted.status, 200, await deleted.clone().text());
  assert.equal((await articleHandler(publicRequest('/blog/renamed-pdf-workflow/?slug=renamed-pdf-workflow'))).status, 410);
  sitemap = await (await sitemapHandler(publicRequest('/blog-sitemap.xml'))).text(); assert.doesNotMatch(sitemap, /renamed-pdf-workflow/);
  const unauthenticated = await adminHandler(new Request('https://gxatoolbox.in/api/blog-admin', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(article('unauthorized')) }));
  assert.equal(unauthenticated.status, 401);
  const imageBytes = await readFile(fileURLToPath(new URL('./fixtures/small.png', import.meta.url)));
  const upload = await mediaAdminHandler(new Request('https://gxatoolbox.in/api/blog-media', { method: 'POST',
    headers: { Origin:'https://gxatoolbox.in', 'sec-fetch-site':'same-origin', 'x-gxa-admin-request':'1',
      Cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(createAdminSessionToken())}`, 'Content-Type':'image/png', 'x-gxa-image-alt':'Example%20document%20preview' },
    body: imageBytes }));
  assert.equal(upload.status, 200, await upload.clone().text());
  const uploadedId = (await upload.json()).media.id;
  assert.equal((await mediaPublicHandler(publicRequest(`/blog-media/${uploadedId}?id=${uploadedId}`))).status, 404, 'draft media must not be public');
  const withImage = await adminHandler(adminRequest('POST', '/api/blog-admin', article('blog-with-image', 'published', {
    featured_media_id: uploadedId, markdown: `${article('x').markdown}\n\n![Document preview](/blog-media/${uploadedId})`
  })));
  assert.equal(withImage.status, 200, await withImage.clone().text());
  assert.equal((await mediaPublicHandler(publicRequest(`/blog-media/${uploadedId}?id=${uploadedId}`))).status, 200);
  const imageArticleHtml = await (await articleHandler(publicRequest('/blog/blog-with-image/?slug=blog-with-image'))).text();
  assert.match(imageArticleHtml, /name="twitter:card" content="summary_large_image"/);
  assert.match(imageArticleHtml, new RegExp(`name="twitter:image" content="https://gxatoolbox\\.in/blog-media/${uploadedId}"`));
  assert.match(imageArticleHtml, /property="og:image:alt" content="Example document preview"/);
  const withImagePost = (await withImage.json()).post;
  const hideImage = await adminHandler(adminRequest('PATCH', `/api/blog-admin?id=${withImagePost.id}`, { ...article('blog-with-image', 'draft', { featured_media_id: uploadedId }), version: withImagePost.version }));
  assert.equal(hideImage.status, 200, await hideImage.clone().text());
  assert.equal((await mediaPublicHandler(publicRequest(`/blog-media/${uploadedId}?id=${uploadedId}`))).status, 404, 'unpublished media must stop being public');
  console.log('Blog CMS isolated PostgreSQL integration passed: 109 static URLs preserved; draft, publish without rebuild, edit lastmod, slug redirect/conflict, noindex, unpublish, delete, schedule, auth rejection, media privacy, 10 tables.');
} finally {
  setDatabaseClientForTests(undefined);
  setBlogCachePurgerForTests(undefined);
  setBlogMediaStoreForTests(undefined);
  if (database?.pool) await database.pool.end();
  await local.stop();
}
