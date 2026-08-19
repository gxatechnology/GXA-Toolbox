# SEO, AEO and GEO Readiness

## Verified technical SEO

| Area | Status | Detail |
|---|---|---|
| Route-specific title/description | Implemented | Generated for every tool/content route |
| Canonical | Implemented | Self-referencing `https://gxatoolbox.in/.../` |
| Robots directives | Implemented | Public indexable; PPT/dashboard/admin/404 noindex |
| `robots.txt` | Implemented | Allows public assets/pages and points to sitemap |
| `sitemap.xml` | Implemented | 98 absolute HTTPS URLs; no fabricated `lastmod` |
| Open Graph/Twitter | Implemented | Route title/description/URL/image metadata |
| Structured data | Implemented | Home Organization/WebSite/WebApplication; tool Application + Breadcrumb |
| Internal links | Implemented | Real anchors to clean tool routes |
| Direct route load | Tested | Representative HTTP and all-shell contracts |
| Invalid route | Tested | Real 404 architecture |
| SearchAction | Not implemented | Correctly absent until search has a stable URL contract |
| FAQ schema | Not implemented | Correctly absent; repeated/generic FAQs should not be marked up |
| Hreflang/localized URLs | Not implemented | Language selector is not a localized-route architecture |

## Counts

- 92 registered tool pages generated.
- 91 tool pages indexable.
- 1 tool page (`/ppt-to-pdf/`) noindex and excluded.
- 6 indexable company/legal pages.
- 1 indexable homepage.
- **98 sitemap URLs**.
- 99 public route entrypoints; 2 private/noindex routes; 1 real 404.

## SEO readiness: strong

The registry-driven static generation removes the former generic-SPA identity problem. Search crawlers receive unique server-delivered title, description, canonical, robots, social metadata, structured data and H1/content for direct tool routes. Unknown paths no longer create soft-404 homepage duplicates.

Remaining SEO work:

1. Keep metadata descriptions accurate as engine capabilities change.
2. Add distinct category landing pages only when they provide substantive user value; do not create thin keyword pages.
3. Verify production redirects for the Netlify subdomain and any `www` host.
4. Monitor sitemap/index coverage and Core Web Vitals after deployment.
5. Resolve the blocked PPT route before making it indexable.

## AEO readiness: moderate

Positive signals include descriptive tool H1s, concise explanations, real routes, breadcrumbs and visible FAQ/help content. Weaknesses are repeated generic FAQ patterns, limited question-oriented content, no validated FAQ schema and incomplete evidence/citations for high-stakes calculator topics.

Recommendations:

- Add concise visible “what it does / inputs / outputs / limitations / privacy” answers to high-value tools.
- Add tool-specific FAQs only where the UI genuinely answers them.
- Explain calculator assumptions and avoid advice claims.
- Make browser/format limitations explicit in visible help.

## GEO / AI-search readiness: moderate

The product has structured entity identity (GXA Technologies/GXA Toolbox), deterministic facts, semantic route names and machine-readable schema. AI-search trust is limited by scarce external corroboration, incomplete company/entity depth, stale auth privacy copy and limited public engineering evidence.

Recommendations:

- Publish an accurate fact sheet, architecture/privacy explanation and changelog.
- Correct session/privacy statements before using them as trust evidence.
- Add author/organization provenance to substantive guides.
- Publish reproducible examples and limitation-aware technical documentation.
- Do not add fake awards, ratings, reviews, usage counts or unsupported security/privacy claims.

## Tracking and advertising

- GTM container: `GTM-TBQN2SJ4`.
- GA4 Measurement ID is intended to be configured **through GTM**; no direct `gtag.js` loader is installed.
- AdSense publisher: `ca-pub-6705105270847964`.
- Authorized `ads.txt` seller: `google.com, pub-6705105270847964, DIRECT, f08c47fec0942fa0`.
- Public-page generator contracts check one GTM and one AdSense loader; dashboard/admin/404 remain ad-free.
- Consent, jurisdictional privacy obligations and external account configuration require owner/legal review.
