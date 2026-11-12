# GXA Toolbox — SEO/AEO/GEO local QA

Date: 2026-11-07. Scope: current local source and generated `dist/`; no live deployment or authenticated search-engine data was modified.

## Route and metadata coverage

- Registered tool routes: **95**. Indexable: **81**. Intentional noindex: **14**. Static sitemap entries: **109**; no fabricated `lastmod` values were added.
- Generated initial HTML includes route-specific H1, title, description, canonical, robots directive, visible content, crawlable internal anchors and JSON-LD. Direct-route and SEO contracts verify generated paths, the sitemap, 404 behavior and private-route exclusions.
- The new browser smoke loads `/`, `/merge-pdf/`, `/compress-image/` and `/json-tool/` at 390, 768 and 1440 pixels. All **12** direct loads retained title, description, canonical and OG image after JavaScript hydration, had exactly one H1, and had no page-level horizontal overflow. It found and then verified the fix for the prior Merge PDF title overwrite.
- The social preview is a real 1200×630 PNG. The SEO contract checks its dimensions and singleton metadata, including Background Remover. This is a local asset/HTML check, not a live social-crawler fetch.
- Blog contract and isolated PostgreSQL integration verify dynamic sitemap publication/noindex behavior, significant `lastmod`, slug changes, public HTML, media privacy and publish/unpublish without a static rebuild. The local Blog browser suites cover editor responsiveness and rendered public articles; they do not verify a deployed CDN or real search crawler.
- IndexNow contract uses mocked network calls to check production-only key gating, approved URL selection and retry behavior. No live provider request was sent; there is no configured key in the repository.

## Executed checks

| Check | Result | Scope / limitation |
|---|---|---|
| `npm run lint` | PASS | Syntax and Background Remover ESLint. |
| `npm test` | PASS after updating one stale Image OCR copy assertion | Full repository and Background Remover contracts; the normal PostgreSQL auth integration is intentionally skipped unless explicitly enabled. |
| `npm run build` | PASS | Repeats lint, Background Remover build and full tests; generated `dist/` locally. |
| `npm run test:blog:integration` | PASS | Disposable local PostgreSQL, not production. |
| `npm run test:blog:browser` | PASS | Four responsive widths; API responses mocked for editor behavior. |
| `npm run test:blog:public:browser` | PASS | Real isolated PostgreSQL article response at mobile and desktop widths. |
| `npm run test:seo-aeo-geo:browser` | PASS | Twelve static-route browser loads and hydration parity. |
| `npm run test:ads:layout:browser` | PASS | 147 local layout/workflow checks, including a real PDF upload/process/download and 14 ad-free routes; ad creatives were fixtures, not live provider fill. |
| `git diff --check` | PASS | Working-tree whitespace check. |

## Performance and accessibility observations

The browser smoke runs on local static assets with advertising and tracking network calls aborted. Its layout-shift and paint observations are **lab-only** and variable; they are not user-experience field metrics, Adsterra creative-fill tests or real LCP/CLS/INP measurements. At 1440 pixels, one run reported approximately 0.27 CLS for Merge PDF and Compress Image and 0.14 for JSON Tool; the two largest observed shifts named the `tool-container ... gxa-ad-layout` element. This points to the tool/ad layout lifecycle under blocked-network conditions, but does not by itself prove real-provider or field-user behavior. Investigate with an isolated ad-layout trace and real-user data before changing no-fill collapse. Important upload, editor and download interactions retain their existing regression tests, but this SEO pass did not retest all 95 tools by touch or measure mobile memory on real devices.

## Remaining release gates

1. Review the complete dirty working tree, generated asset replacements, Blog migration 0010, and secrets before an approved commit.
2. Verify a Netlify Deploy Preview uses the correct isolated database branch and non-production Blob namespace before Blog writes. Preview media is scoped per deploy ID and does not survive a preview redeploy.
3. Validate deployed HTTP headers, social-image MIME/availability, Blog redirects, IndexNow key route (only if configured), robots and both sitemaps on the preview. Static local tests do not prove Netlify runtime behavior.
4. Obtain actual GSC/Bing exports and field Core Web Vitals before claiming organic growth or AI visibility. No rankings, citations or indexing outcomes are promised.
5. Keep `INDEXNOW_KEY` absent until separately approved and production-scoped. Do not submit all 109 static URLs after every build.

**Local code gate:** PASS. **Production deployment gate:** pending the broader release review and isolated preview; no commit, push or deployment was performed in this phase.
