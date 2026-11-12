# GXA Toolbox Blog Studio — local implementation and release gate

## Architecture

The existing static `dist/sitemap.xml` is unchanged and still contains 109 URLs. The blog is a separate database-backed publication channel:

- `/blog/` → `blog-public` Netlify Function, server-rendered HTML article index.
- `/blog/{slug}/` → `blog-public` Function, server-rendered article with correct status, metadata, canonical and Article JSON-LD.
- `/blog-sitemap.xml` → `blog-sitemap` Function, UTF-8 XML from effective published, indexable, self-canonical records. Above 45,000 articles it becomes a sitemap index linking paged `?page=N` XML responses.
- `/blog-media/{id}` → `blog-media-public` Function, serves only media linked to an effectively published article.
- `/admin/blog/` → protected Blog Studio frontend, using the existing HttpOnly administrator session.
- `/.netlify/functions/blog-admin`, `blog-media-admin`, `blog-preview` → server-authorized CRUD, image upload and sanitized preview.

The original static generator copies the Blog Studio assets, but does not generate article HTML. Publishing an article changes PostgreSQL rows only; no source edit, Git push, static rebuild or deployment is involved. A future deployment is required **once** to install the schema, functions and route rules.

## Database

Additive migration `netlify/database/migrations/0010_create_blog_schema.sql` creates ten blog-only tables: `blog_posts`, `blog_post_revisions`, `blog_categories`, `blog_tags`, `blog_post_categories`, `blog_post_tags`, `blog_media`, `blog_post_media`, `blog_slug_redirects`, `blog_audit_events`. It does not drop, truncate, import or rewrite existing application records. Existing migrations 0001–0009 remain intact. The local disposable PostgreSQL migration test applies all migrations and checks the blog table count.

The sole existing administrator role can author and publish. Editor/Publisher roles are not exposed because the current Admin authentication model has no independent, server-enforced roles. Mutations require its signed session, same-origin request policy and request header. Post updates use optimistic version checks; revisions and audit records are persisted. Deletion is a soft `deleted` state, with public HTTP 410. A changed slug records an old-slug redirect; neither old slugs nor current slugs may be reused by another article.

## Content and media safety

The editor stores Markdown in a structured JSONB block. Server-side `marked` + `sanitize-html` renders a restricted HTML vocabulary; raw scripts and unsafe links are removed. Admins can upload JPEG, PNG or WebP images up to 6 MB. The server verifies the actual format, bounds image pixels, strips source metadata while optimizing to WebP, and stores bytes in a context-scoped Netlify Blobs store, not in database rows. The database stores metadata and explicit post/media links. Draft or unpublished media cannot be fetched from the public media route. The authenticated media-library route can display unpublished images to the administrator.

Sanitized links to GXA Toolbox pages remain normal internal links; editorial external HTTPS links open separately with `noopener noreferrer`. A featured image is exposed in Open Graph and large-image Twitter metadata with its stored alternative text. The optional, production-only IndexNow publishing hook and its configuration gate are documented in `docs/GXA_SEARCH_DISCOVERY_AND_INDEXNOW.md`.

Netlify Blobs uses the `gxa-blog-media-production` store in production and a deploy-ID-scoped store for each Deploy Preview or branch deploy. The namespace comes from Netlify's trusted Function `context.deploy`, not build-time environment variables; an absent or unrecognized context fails closed. Netlify Blobs stores are otherwise shared across deploys of a site. Preview media intentionally does not persist across preview redeploys because each deploy has a distinct ID; use it only for isolated release testing. Preview database branch isolation must also be confirmed in Netlify before any Deploy Preview. No production data or settings were touched locally.

## Visibility, SEO and caching

Draft, private, deleted and future scheduled articles return no public article HTML. Matured scheduled articles become public from their stored time without a rebuild. Noindex articles remain publicly readable but are excluded from the blog sitemap. The blog index itself is noindex until at least one article exists. Each article uses a self-canonical URL; a nonmatching custom canonical is rejected during authoring. Article `lastmod` is the latest actual publication, scheduled-publication or significant update timestamp. The existing `robots.txt` sitemap declaration remains, with a second declaration for the blog sitemap.

Article HTML and media are `no-store` so an unpublished article or its image cannot persist in a public CDN cache. The blog index and sitemap use a 30-second Netlify CDN TTL, with `gxa-blog-index` / `gxa-blog-sitemap` cache tags purged after mutations. If a purge fails, the authoring API reports that content was saved but the index or sitemap may take at most 30 seconds to refresh. Scheduled publication may likewise become visible in a cached index or sitemap within that TTL. This bounded delay should be tested in a real Deploy Preview; local integration verifies the purge call contract, not Netlify's global CDN.

## Exact local evidence

`npm run test:blog:integration` starts a disposable `@netlify/database-dev` PostgreSQL instance, applies migrations 0001–0010, and calls the real Admin/public/sitemap/media Functions. It checks draft exclusion, publish inclusion, article 200 HTML, accurate `lastmod`, slug redirect and conflict, noindex, unpublish removal/404, deleted 410, scheduled exclusion and automatic activation, unauthenticated rejection and media access control. It verifies `dist/sitemap.xml` still has 109 URLs and its modification time does not change during article publication. `npm run test:blog:contract` checks routing, generated Admin Studio, sanitization and sitemap visibility. `npm run test:blog:browser` checks the Admin Studio UI at 320, 390, 768 and 1440px using mocked API responses; the PostgreSQL integration is the separate source of backend evidence.

## Google Search Console and one-time deployment sequence

1. Review the whole dirty working tree; it includes unrelated pending changes. Do not stage it indiscriminately.
2. On an isolated Netlify Deploy Preview, confirm the preview database is a separate branch and the Blobs store is non-production. Apply the migration through Netlify's normal deployment lifecycle—**not** a read-only SQL console.
3. Test authenticated Admin Studio, image upload, draft/preview, publish, HTML response, sitemap, cache purge, unpublish and old-slug behavior on the Preview. Confirm the 109-URL static sitemap remains unchanged and the blog sitemap is publicly fetchable.
4. Only after approval, deploy the reviewed release to production. Check migration tracking, publish one genuine article, then fetch `https://gxatoolbox.in/blog-sitemap.xml` anonymously.
5. In Google Search Console for `gxatoolbox.in`, submit `https://gxatoolbox.in/blog-sitemap.xml` under Sitemaps. The `robots.txt` declaration also exposes it. Do not expect immediate indexing or approval; Search Console discovery is not a ranking guarantee.

## Remaining limitations / release gate

This is a functional Markdown-based CMS, not a full WYSIWYG editor. Category and tag assignment, optimized media, revision restore, schedule and SEO fields are present, but there is not yet a separate taxonomy-management dashboard, structured FAQ builder, related-article picker or genuine per-article analytics. The Admin Studio browser suite mocks API responses, while the isolated PostgreSQL suite exercises real handlers. The local tests cannot prove Netlify CDN purge behavior, production database readiness, live media storage configuration or Google crawl/indexing behavior. **Production GO requires an isolated Deploy Preview and owner approval.** No commit, push, deploy, environment change or production migration was performed.
