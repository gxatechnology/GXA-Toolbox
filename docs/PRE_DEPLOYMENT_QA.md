# GXA Toolbox pre-deployment QA — 19 October 2026

This is a local release review of the consolidated website optimization, advertising, and database-recovery work. Nothing was committed, pushed, deployed, or written to the production database.

**Production recommendation: NO-GO until the Netlify preview proves the database branch/schema association, the Adsterra account's brand-safety restrictions are reviewed, and the production dependency advisories are triaged.** The local application build and fixture QA are passing; this is an external-state and release-policy gate, not a claim that the current source fails to compile.

## Result and boundaries

The generated site contains 95 tool routes. The existing publication policy marks 81 tools ad-eligible and 14 noindex/ad-free. The shorter guide hierarchy is present in the source renderer and generated HTML. Sampled PDF, Image, Converter, Calculator, and Developer pages retain the registry's privacy text, supported formats, limitations, and FAQs. Source/build tests found no exact duplicate content groups.

The homepage has a responsive discovery banner and a lower editorial candidate. Eligible simple-tool pages plan a top banner, after-tool Native/fallback, right rail where width permits, and either in-content or a wide-screen left rail within the four-placement cap. Complex editors have no side rails. Ads stay outside interaction and result areas. A homepage hydration race was corrected by rechecking missing homepage zones without remounting existing slots.

## Ad configuration and runtime

All nine IDs/URLs in the supplied `GXA_Toolbox_Adsterra_9_Ad_Unit_Codes (1).docx` match `public_html/assets/ad-config.js`: Native `b1b26904317d94da1830e1f5dd69d6d9`; fixed `82dc3dcdb859ef27455f631d49183d07`, `2cc9598f48bdcb102277c47352490483`, `eb9ac703bb90ff49c53631490a2933f5`, `a141cf44861510c02f8b814719a223bf`, `983c84b73f5901c5877413ab9680312e`, and `900dabd0bb67d683bd5dbc7486b6d25a`; disabled Popunder `3a66eef4b20eb6bc449cee178926437d`; disabled Social Bar `fcd69a971630acd0557b6a7e1c55ba85`. No Popunder or Social Bar request occurred in the browser fixtures.

The production build has exactly one Adsterra runtime script on each of 109 eligible public HTML pages and none on sampled noindex/dashboard pages. There is no direct AdSense loader in the Adsterra-selected `dist/` output. Source templates retain the single canonical `ca-pub-6705105270847964` token and Background Remover's Vite plugin consumes it for a future AdSense switch. No manual AdSense `data-ad-slot` IDs were introduced. Root and built `ads.txt` use `pub-6705105270847964`. GTM remains `GTM-TBQN2SJ4`.

At 1600px on local Compress PDF, a real Chromium session requested the Native, 728×90, 300×250, 160×300 left, and Native-fallback 320×50 provider URLs. There were no request failures or page errors, but no creative DOM appeared in that localhost window; top/right/left slots collapsed with `empty`. This confirms left-rail insertion and request execution, **not** guaranteed fill on the production domain. Provider inventory, domain matching, geography, and time can affect fill. The fixture suites verify placement mechanics without making fake impressions.

## Browser and functional checks

- `npm run test:ads:layout:browser`: 111 fixture checks across nine representative tools and 12 widths (320–2400px); placement, density, no overflow/overlap, editor rail exclusions, duplicate-script prevention, failed/empty collapse, real Compress PDF upload/process/download, GST and JSON interactions passed.
- `npm run test:ads:browser`: 154 checks; 81 eligible routes, 14 excluded routes, homepage/editorial/Background Remover, route navigation, Native lifecycle, failure and CSP scenarios passed. Test-only scripts were isolated so repeated fixture declarations do not create false page errors.
- `npm run test:content-layout:browser`: 19 cross-family routes at 390×844 plus full-page screenshots at 320, 390, 768, 1366, and 1920px passed. Its selector was updated for the intentionally hidden progressive-disclosure intro.
- Mobile homepage at 390px: no horizontal overflow; drawer opens, shows tool navigation, and closes with Escape. Desktop feedback opens the support dialog. The floating feedback control is intentionally hidden on mobile; Contact Support remains in the mobile drawer. No physical-device or soft-keyboard session was run.
- Isolated `RUN_POSTGRES_INTEGRATION=true` test passed with all migrations including 0008 and Identity profile, history, Contact Support, and admin analytics. This does not prove the new Netlify production database branch is healthy.

## Release conditions and manual actions

1. **Database:** migration `0008_recover_expected_application_schema.sql` was preserved, is additive, and passed the isolated database test. Before the consolidated production deploy, verify the correct new Netlify site/database branch, run an isolated preview, inspect migration history versus the actual `public` tables through the protected diagnostic endpoint, then explicitly approve production application. Do not reset history or fabricate historical analytics.
2. **Brand safety:** prior real-browser sampling recorded gambling/dating-style creatives. The current localhost probe returned no creative, so category suitability cannot be revalidated here. In Adsterra's publisher account, review the site's ad-category filters and whether the “Boost CPM” all-types option is enabled; restrict categories inappropriate for a general productivity site. Escalate unsuitable creative URLs/screenshots to Adsterra support. The site cannot safely rewrite third-party creative content. Adsterra describes category controls and reporting through its [publisher guidance](https://adsterra.com/monetize-traffic/) and [dashboard setup guide](https://adsterra.com/blog/set-up-publishers-dashboard/). No advertising-account setting was changed.
3. **Dependencies:** `npm audit --omit=dev` reports five production advisories (two high, three moderate), including `sharp` and `@xmldom/xmldom`. These were not automatically upgraded as part of layout QA; triage them before approval.
4. **Provider fill and layout stability:** confirm actual visual fill, no unsuitable creative, and no disruptive post-fill movement on a production-origin preview. Localhost no-fill is not proof of production fill. Failed slots collapse without a lasting blank area.

`dist/` and `test-results/` are ignored/generated, not source changes. Final command results are also summarized in the task completion response.

## Working-tree classification

These groups describe the current uncommitted working tree; some files were touched in more than one phase.

| Group | Files |
| --- | --- |
| Website/content optimization | `docs/ADSENSE_CONTENT_AUDIT.md`, `docs/WEBSITE_OPTIMIZATION_AUDIT.md`, `index.html`, `public_html/assets/app.js`, `public_html/assets/style.css`, `scripts/generate-seo-site.mjs`, `tests/phase4-content-contract.mjs`, `tests/tool-content-contract.mjs` |
| Database recovery, preserved | `netlify/functions/_database.mjs`, `netlify/functions/admin-database-diagnostics.mjs`, `netlify/database/migrations/0008_recover_expected_application_schema.sql`, `docs/NETLIFY_DATABASE_RECOVERY.md`, `tests/database-recovery-contract.mjs`, `tests/postgres-auth-integration.mjs`, `tests/production-finalization-contract.mjs`; the previously changed `package.json` test chain includes the recovery contract |
| Earlier Adsterra expansion and current homepage correction | `public_html/assets/ad-config.js`, `public_html/assets/ad-layout.js`, `public_html/assets/ad-network.css`, `public_html/assets/ad-network.js`, `tests/ad-layout-browser.mjs`, `tests/adsterra-browser.mjs`, `tests/adsterra-contract.mjs`, `docs/ADSTERRA_PLACEMENT_EXPANSION.md` |
| QA-only additions | `package.json` and `package-lock.json` for the Playwright dev dependency; `tests/content-layout-browser.mjs`, `tests/ad-provider-live-browser.mjs`, and this report. The two Adsterra browser tests above also received fixture/timing corrections. |
| Generated/temporary | `dist/` and `test-results/` are Git-ignored. The Background Remover Vite output in `public_html/background-remover/` was regenerated by the build but has no working-tree diff. |
