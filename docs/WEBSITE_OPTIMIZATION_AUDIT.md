# GXA Toolbox website optimization audit

Local scope: the existing 95-tool source tree and generated `dist/` site. No deployment was performed.

## Shared architecture and findings

- `scripts/tool-registry.mjs` and `public_html/assets/tool-quality.js` define 95 tool routes: 81 indexable/ad-eligible, 14 noindex/ad-free. The build also creates direct static HTML for tools, category/editorial pages, and the homepage.
- `public_html/assets/app.js` renders the interactive homepage, navigation, cards, and tool-page guides. `scripts/generate-seo-site.mjs` renders crawlable initial HTML. Both paths previously had many top-level content sections and repeated the introductory About paragraph.
- Shared content is in `public_html/assets/tool-content.js`. No tool descriptions, methods, warnings, formulas, limitations, privacy boundaries, FAQs, or related links were removed from that registry.
- The hero and card CSS had fixed/minimum heights and large vertical padding. Shared rules now reduce those dimensions without replacing the design system or changing card/navigation behavior.
- The main app and shared stylesheet URLs now carry a new release query so the updated layout is not masked by a browser's prior cached asset after deployment.
- `config/ad-network.mjs` injects the central Adsterra runtime only into eligible generated pages. `public_html/assets/ad-config.js` retains the approved unit IDs and keeps Popunder and Social Bar disabled.
- The homepage previously had only a lower editorial Native candidate. It now has one responsive banner position after search, plus that lower candidate. The tool-page rail shell previously left insufficient measured width for the left unit at 1600px; the new width calculation leaves room for both rails on rail-approved simple tools.
- No ad is placed inside a file picker, editor, result, or download control. Unfilled provider slots remain hidden/collapse; a requested unit does not imply an impression or visible fill.

## Content and SEO

Generated tool pages now use five major guide headings: How to Use; About, Features and Practical Uses; Privacy, Formats and Limitations; Frequently Asked Questions; Related Tools and Guides. Specialized method, format, example, safety, and limitation details remain as subordinate topics. The interactive version uses the same core grouping, with its related tools and FAQ components preserved.

The source registry and generator remain authoritative. Metadata, canonical URLs, robots rules, sitemap, JSON-LD, GTM, and ads.txt were not changed for this optimization. The production build generated 95 tool routes and 109 sitemap URLs; the route/SEO contracts passed.

## Local verification and limits

- `npm run lint`, `npm test`, and `npm run build` exited 0; `git diff --check` exited 0.
- A real, non-mocked local browser rendered the homepage banner and the Compress PDF top/right ads. At 1600px the tool shell measured 1052px wide, with planned left and right rails and no page-level overflow. The left rail did not receive a creative during the observed provider window; this is not reported as a visible ad success.
- The 390px homepage and Compress PDF, 1280px Compress PDF, and 1600px Compress PDF were sampled for overflow and layout. The 14-route exclusion policy was contract-tested; `/html-to-pdf/` was also checked in-browser as noindex with no ad runtime or slots.
- Follow-up QA installed Playwright as a development dependency and ran the dedicated ad-layout browser suite: 111 fixture checks passed. The separate Adsterra lifecycle suite passed 154 checks, and the content-layout browser suite covered 19 cross-family routes. These simulated browser fixtures do not prove production-domain provider fill or physical-device interaction; see `docs/PRE_DEPLOYMENT_QA.md`.
- Real provider creatives are outside the site's visual control. The observed inventory included gambling/dating-style ads; review Adsterra category controls and brand-safety suitability before release. Do not replace missing creatives with fake ads or impressions.
