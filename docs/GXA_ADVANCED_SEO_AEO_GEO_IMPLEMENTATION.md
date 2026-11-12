# GXA Toolbox — advanced SEO, AEO and GEO implementation

Local implementation: 2026-11-07. This is a release candidate, not a claim about Google/Bing rankings or AI citations. No production deployment was made.

## Executive summary

The existing registry-driven site already delivered canonical static HTML for 95 tools, with 81 intentionally indexable tools, 14 intentionally noindex tools and 109 static sitemap URLs. We retained those decisions and fixed a confirmed browser-crawler parity defect: the client app was replacing reviewed tool metadata after hydration. We also clarified 25 tool meta descriptions, added a descriptive 1200×630 social image, improved Blog article sharing/editor guidance, and added an opt-in IndexNow path for significant public Blog changes. No doorway pages or bulk keyword text were added.

## Changes implemented

| Priority | Change | Source of truth and effect |
|---|---|---|
| P0 | Hydrated metadata parity | The static generator now makes its reviewed tool SEO-intent metadata available to the browser runtime. `public_html/assets/app.js` preserves the same title, description, canonical and social image on direct loads and still updates metadata during in-app navigation. A direct `/merge-pdf/` load previously changed the reviewed title to an older short title after JavaScript initialized. |
| P1 | Clearer tool descriptions | `scripts/tool-seo-intents.mjs` improves 25 short or incomplete descriptions with factual operations, formats, outputs or limits. Existing strong descriptions remain; there is no character-count quota. The generated HTML, Open Graph, Twitter and JSON-LD descriptions remain aligned. |
| P1 | Descriptive sharing image | `scripts/generate-social-preview.mjs` builds a 1200×630 PNG using existing GXA branding. The homepage, generated pages, runtime metadata and Background Remover share the new image. The small square logo remains a logo asset, not the primary social preview. |
| P1 | Blog metadata and crawlability | The existing Blog CMS continues to serve published articles as HTML. Article featured images can supply social previews, and internal Blog links remain followable. The editor now shows advisory title/description, heading, image-alt and completeness checks plus a plain search preview; it does not invent a ranking score or block publishing. |
| P1 | IndexNow for public Blog changes | Production-only, opt-in notification covers publication, significant edits, canonical slug changes, unpublish/noindex and deletion of public articles. Validated Blog URLs only; drafts and preview deployments never submit. See `GXA_SEARCH_DISCOVERY_AND_INDEXNOW.md`. |
| P2 | Intent and answer coverage | `GXA_KEYWORD_INTENT_AND_CONTENT_MAP.json` accounts for all 95 tools using the registry, current content and the prior research map. Ideas without observed search data are explicitly hypotheses. `GXA_AEO_GEO_CONTENT_COVERAGE.md` records original evidence still needed. |
| QA | Browser parity smoke | `tests/seo-aeo-geo-browser.mjs` checks initial HTML against the hydrated page at 390, 768 and 1440 pixels for four representative routes, including the former Merge PDF failure. |

## What remains unchanged

- The 95 tool URLs, 81/14 publication policy, 109 static sitemap URLs, tool engines, processing/download logic, 404 behavior and existing initial-HTML guides.
- Dynamic Blog sitemap publication rules; Blog records, slugs, media, database migration 0010, Admin authorization and user accounts.
- Advertising, GTM/GA4, AdSense, Search Console configuration, and Background Remover processing.
- Current `robots.txt` crawler policy. Search-discovery access was not confused with training consent; no crawler-specific training directive was invented. `llms.txt` was not added because there is no verified need for it.

## Phase file inventory

Static metadata and social preview: `scripts/generate-seo-site.mjs`, `scripts/tool-seo-intents.mjs`, `scripts/generate-social-preview.mjs`, `index.html`, `background-remover-app/index.html`, `public_html/background-remover/index.html` (generated), `public_html/assets/app.js`, `public_html/assets/tool-seo-intents.js` (generated), `gxa-social-preview.png` (generated), `tests/seo-contract.mjs`, `tests/image-ocr-contract.mjs` (stale copy assertion updated).

Blog and discovery: `netlify/functions/_blog-core.mjs`, `netlify/functions/_blog-store.mjs`, `netlify/functions/_blog-indexnow.mjs`, `netlify/functions/blog-indexnow-key.mjs`, `netlify/functions/blog-admin.mjs`, `netlify/functions/blog-public.mjs`, `public_html/admin/blog/index.html`, `public_html/admin/blog/blog.js`, `public_html/admin/blog/blog.css`, `_redirects`, `netlify.toml`, `tests/blog-cms-contract.mjs`, `tests/blog-cms-integration.mjs`, `docs/GXA_BLOG_CMS_IMPLEMENTATION.md`.

Planning, browser QA and consolidated documentation: `scripts/generate-advanced-seo-intent-map.mjs`, `docs/GXA_KEYWORD_INTENT_AND_CONTENT_MAP.json`, `docs/GXA_AEO_GEO_CONTENT_COVERAGE.md`, `docs/GXA_SEARCH_DISCOVERY_AND_INDEXNOW.md`, `docs/GXA_ADVANCED_SEO_AEO_GEO_IMPLEMENTATION.md`, `docs/GXA_SEO_AEO_GEO_FINAL_QA.md`, `tests/seo-aeo-geo-browser.mjs`, `package.json`. Earlier advertising, database and mobile changes in the dirty tree were preserved, not reimplemented here.

## Search and answer opportunities

The prior 95-tool audit found useful introductions, steps, format boundaries, privacy explanations, examples, FAQs and related links already present. The next content work should use original, reproducible examples for conversion fidelity, OCR quality, compression decisions, PDF editor boundaries and calculator assumptions. The accompanying intent map identifies a canonical destination per tool and related editorial topics without publishing unverified articles or duplicating tool routes.

No local Google Search Console or Bing query export was available. The map therefore contains **no measured search volume, impressions, CTR, rank or AI-citation statistics**. When authenticated exports are available, prioritize observed high-impression/low-click queries and pages with relevant cited/grounding themes. Bing's [AI Performance documentation](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/) and Google's [Search generative AI reporting documentation](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) describe measurement surfaces; their existence is not evidence that this site has traffic or citations.

## Performance and release limits

The main `app.js` and `style.css` are approximately 690 KB and 268 KB raw. Heavy PDF/OCR/Background Remover processing stays route/action scoped, but mobile field performance has not been measured here. The browser smoke collects local layout observations only; it is not a field Core Web Vitals report. Some desktop layout-shift readings varied and need a dedicated ad-fill/hydration investigation before calling CLS resolved. No engine or ad lifecycle was changed just to improve a synthetic score.

IndexNow remains disabled until a valid production-scoped `INDEXNOW_KEY` is configured after review. Static tool updates and exact-time scheduled Blog publication do not emit IndexNow notifications; the sitemaps and links remain their discovery path. Neither IndexNow nor structured data guarantees indexing, rich results, rankings or AI citations.

This implementation is locally testable but not production-approved. It must remain on the uncommitted release branch until the broader pending release, isolated Netlify Deploy Preview, Blog database branch and storage isolation have been reviewed.
