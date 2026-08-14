# GXA Toolbox production SEO architecture

This document describes the production behavior generated from the existing GXA Toolbox registry. Google Search Console ownership is already verified and is not part of this implementation.

## Public indexing strategy

- Canonical origin: `https://gxatoolbox.in`
- Canonical homepage: `https://gxatoolbox.in/`
- Canonical tool pattern: `https://gxatoolbox.in/{tool-id}/`
- The central 91-tool registry in `public_html/assets/app.js` remains the source of truth.
- Ninety working public tools are `index, follow` and are listed in the sitemap.
- `ppt-to-pdf` remains directly reachable but is `noindex, follow` and is omitted from the sitemap until its presentation-renderer dependency is implemented.
- UI category filters are not separate routes. Thin category pages were deliberately not invented.
- `/all-tools/` redirects to the homepage, where the real tool directory is visible.
- Dashboard, authentication state, API/function endpoints, uploaded/generated data, query variants, fragments, source files, and unknown paths are never sitemap entries.
- Unknown paths return the generated `404.html` with a real HTTP 404 through Netlify static-file handling.

Run `npm run generate:seo` after changing the registry. The generator validates the exact registry, creates an allowlisted `dist/` publish directory, writes one static HTML shell per tool, and regenerates `sitemap.xml`, `robots.txt`, `404.html`, and `docs/SEO_ROUTE_AUDIT.md`. Sitemap entries intentionally omit `lastmod` because the registry has no reliable per-route modification date.

## Netlify deployment behavior

Netlify must publish `dist/`, never the repository root. The generated directory includes only the browser application, route HTML, Background Remover build, required runtime assets, icons, manifest, robots file, sitemap, and 404 page. PHP source, SQL, tests, documentation, package metadata, function source, upload directories, and repository internals are excluded by construction.

The six existing authentication API routes continue to map to Netlify Functions. Private responses carry `X-Robots-Tag` and no-store headers. There is no broad SPA rewrite: every supported clean route has a physical generated HTML file, and invalid paths remain 404s.

## Metadata and structured data

Every generated public tool shell has a unique title and description, self-referencing canonical URL, robots directive, Open Graph title/description/URL, Twitter title/description, a visible H1, and truthful WebApplication plus BreadcrumbList JSON-LD. The homepage defines Organization, WebSite, and WebApplication entities for GXA Technologies and GXA Toolbox. No prices, offers, ratings, reviews, statistics, people, or fake FAQ markup are generated.

The browser router updates the same metadata after in-app navigation and supports normal links, History API navigation, refresh, back, and forward. Static route shells remain meaningful when JavaScript is delayed or unavailable.

## Google Tag Manager

The official Google Tag Manager container `GTM-TBQN2SJ4` is installed once in each of the two source HTML templates: the shared GXA Toolbox template and the standalone Background Remover Vite template. Each has one asynchronous head loader and one matching noscript iframe immediately after the opening body tag. The build system propagates those templates to all 92 public HTML routes (the homepage plus 91 tools), and the SEO contract rejects missing or duplicate installations.

GA4 measurement ID `G-E16HBF4R7W` must be configured through this GTM container. The repository intentionally does not install direct GA4 `gtag.js`, call `gtag('config', ...)`, or load `google-analytics.com`; this avoids duplicate page views and competing consent/configuration paths.

After deployment, use GTM Preview to verify the container on the homepage, representative generated tool routes, and Background Remover. Configure and publish the GA4 tag in the GTM workspace, including History API page-view behavior for in-app tool navigation. No GTM or GA4 settings are changed by the repository build.

## Post-deploy owner actions

1. Trigger a normal production deploy from the reviewed commit. The build command creates `dist/` automatically.
2. Verify `/robots.txt` is plain text, `/sitemap.xml` is XML, representative tools return their own HTML, and a random path returns 404.
3. Submit `https://gxatoolbox.in/sitemap.xml` in the already-verified Search Console property and inspect representative homepage, tool, noindex, and 404 URLs.
4. Because prior production deploys exposed repository files, reset or delete any privileged account that ever reused the sample credentials in `database.sql`. Rotate `AUTH_SESSION_SECRET` if existing sessions should be invalidated or compromise is suspected.
5. After the clean deploy is live, delete older Netlify deploys that contain the exposed source files. A clean deploy must be live first so the site is not left unavailable.
6. In Google Tag Manager, configure and publish GA4 measurement ID `G-E16HBF4R7W`; do not install a direct GA4 tag in parallel.

No automatic push or deployment is performed by this implementation.
