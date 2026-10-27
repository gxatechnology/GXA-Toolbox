# GXA Toolbox final local project audit — 2026-10-24

## Executive summary

The generated public site is technically coherent: **95 registered tools**, **109 sitemap URLs**, **81 indexable/ad-eligible tool routes**, **14 intentional noindex/ad-free tool routes**, and real 404 behavior. The historical “100 advertising-eligible routes” figure is not current policy. The latest engine inventory classifies **63 tools fully working** (59 browser, 4 WASM), **31 working with documented browser/format limitations**, **1 dependency-blocked** (`ppt-to-pdf`), and **0 known broken routes**.

Result/download architecture remains intact. The focused browser suite completed two real file downloads and 18 responsive layout checks with the result-ready ad separated from Download. The new ratings implementation covers 94 tools locally and stays hidden in production until the database and server flags are verified.

Deployment is **NO-GO** today because the production database identity/schema state is not authenticated or reconciled, production ratings storage is intentionally disabled, and live provider/credential checks remain owner actions. Static build health is not proof of database readiness.

## Preserved local work and change control

The working tree already contained result/download and advertising changes before this pass. They were preserved. No commit, push, Netlify deploy, production migration, provider-account change, database write, Git history rewrite or secret rotation was performed.

Migration `0008_recover_expected_application_schema.sql` is unchanged. New migration `0009_create_tool_ratings.sql` is additive and separately gated.

## SEO and Search Console findings

Live checks were performed against the public domain and compared with `dist/`:

| URL | Live result | Current directive/canonical | Sitemap and internal discovery | Finding |
| --- | --- | --- | --- | --- |
| `http://gxatoolbox.in/` | 301, one hop | redirects to `https://gxatoolbox.in/` | canonical destination indexed | correct redirect |
| `https://www.gxatoolbox.in/` | 301, one hop | redirects to `https://gxatoolbox.in/` | canonical destination indexed | correct redirect |
| `/guides/qr-information/` | 200 HTML | `index, follow`, self-canonical | sitemap: yes; internal links: 5 generated pages | historical noindex report is stale |
| `/barcode-reader/` | 200 HTML | `noindex, follow`, self-canonical | sitemap: no; internal links: 5 generated pages | intentional quality-policy exclusion |
| `/edit-pdf/` | 200 HTML | `index, follow`, self-canonical | sitemap: yes; internal links: 5 generated pages | technically indexable; Google discovery status is not a code defect |
| `/ppt-to-pdf/` | 200 HTML | `index, follow`, self-canonical | sitemap: yes; internal links: 4 generated pages | crawlable honest limitation content; fidelity engine remains dependency-blocked |

All sampled pages return meaningful initial H1/title/canonical HTML before JavaScript. The generated content audit found **0 exact duplicate groups** for titles, descriptions, About sections, privacy text, methods, steps and FAQs, plus 0 near-duplicate About/step pairs. The SEO generator reports 95 tool routes, 7 company/legal routes, 20 editorial/category routes and 109 canonical sitemap URLs.

No verified SEO source defect was changed. Search Console can still choose not to index technically eligible pages, and no indexing/ranking promise is made.

## Adsterra audit

Central configuration remains Adsterra with seven display formats and Social Bar enabled; Popunder, Smartlink and unapproved interstitial behavior remain disabled. Policy admits 81 tools and excludes the 14 noindex/ad-free tools plus private/Admin/auth/error routes.

Fixture browser QA passed **150 lifecycle/publication checks**, **72 workspace geometry checks**, and **18 result/download checks**. It verifies route eligibility, responsive suppression, no overflow, no duplicate initialization, collapsed failed/no-fill slots, no tool overlap, real PDF processing and real downloads. Fixture creatives are not live provider fill evidence.

A genuine-provider sample on local `/compress-pdf/` at 1920px sent five display requests plus Social Bar. All six provider requests returned HTTP 200 without request failures or CSP/runtime errors. Social Bar bootstrap reported loaded. The five sampled display slots produced **no observable creative** and collapsed to zero geometry; the after-tool Native slot correctly remained waiting because no result had been produced. This is provider no-fill in the sample, not proof of an implementation failure or paid impression. Production fill, creative quality and Social Bar obstruction require manual live review without an ad blocker.

## Admin analytics and database diagnosis

First-party metrics come from `public.tool_analytics_events` using event types `tool_open`, `tool_start`, `tool_complete`, `tool_fail` and `tool_download`; Admin aggregates are date-bounded SQL queries. Users, auth events, jobs, support and system diagnostics use the corresponding public tables. External GA4, Search Console, AdSense and Adsterra reporting are independent server-side integrations and were not reconfigured.

The diagnostic's core expectation remains 12 tables: `users`, `user_profiles`, `file_jobs`, `auth_events`, `tool_analytics_events`, `system_events`, `support_messages`, `support_message_notes`, `admin_profiles`, `admin_audit_events`, `admin_rate_limits`, and `admin_resource_reads`. Ratings are reported separately as optional, so missing migration `0009` cannot mark the original Admin database unavailable.

### Confirmed evidence

- `.netlify/state.json` is `{}`; this checkout has no confirmed local Netlify site association.
- The direct live diagnostic function exists and returns 401 without an Admin session, confirming access protection. Its internal identity/schema output could not be read anonymously.
- The friendly `/api/admin/database-diagnostics` alias is not configured and returns 404; the protected function is currently addressed through `/.netlify/functions/admin-database-diagnostics`.
- Isolated PostgreSQL integration passed migrations 0001–0009 and auth/profile/history/support/tool-event/rating/Admin queries.
- Prior owner evidence says the new explorer showed zero public tables while deployment said no migrations pending.

### Root-cause conclusion

The exact production cause remains **not confirmed** without an authenticated diagnostic response and the new Netlify site's database/deploy identity. The evidence is consistent with a deploy-to-database branch/project mismatch or migration history recorded against a different branch while the inspected branch has an empty public schema. It is not safe to reset migration history or rerun SQL manually.

### Safe recovery plan

1. Link the CLI/UI only to the intended new Netlify site and record site ID, deploy ID, context and database branch—without exposing connection strings.
2. Create an isolated Deploy Preview and confirm its database branch is not production.
3. Authenticate as Admin and run the protected diagnostic. Compare current database/user/schema/search path, privileges, 12 core tables, tables in other schemas and `netlify.migrations` entries 0001–0009.
4. If 0001–0007 are marked applied but core tables are absent, verify additive migration 0008 is genuinely pending in the correctly associated branch. Do not edit/delete migration history.
5. Apply through a new preview deploy using Netlify's supported migration workflow; validate Admin counters and event writes.
6. Only after preview evidence, trigger an approved production deploy of the same migration set and repeat diagnostics.
7. Recover historical data separately from the old database/export if legally and technically available; never fabricate events.

## Security and integrations

- No tracked `.env` files were found.
- A location-only credential-pattern scan found environment-variable names, test-only dummy values, a deliberate AdSense template token, public IDs/URLs and vendor text; it found no confirmed real secret. Values were not printed.
- Production dependency audit is **0 vulnerabilities** after updating `sharp` to 0.35.5, Mammoth to 1.13.0 and overriding its XML parser to patched, Mammoth-compatible `@xmldom/xmldom` 0.8.15. Conversion suites remain the compatibility gate.
- The complete development tree still reports 8 advisories (2 moderate, 6 high) in test/dev tooling including Vitest/Vite/Undici-related packages. They are not shipped in the static production artifact, but should be upgraded in a separate test-tooling pass.
- Earlier exposed Google OAuth client secret/refresh tokens should remain revoked and rotated in Google/Netlify if that has not already been completed. No value was inspected or changed here.
- Admin data, rating moderation and diagnostics require Admin sessions; public rating submission is same-origin, validated, bounded and disabled by default.

## UI, accessibility and responsive evidence

Ratings passed 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920px with no horizontal overflow, 44px star targets, radiogroup semantics, keyboard arrows/numeric selection, explicit retry with state preservation, and independent downloads. The trust strip pauses on focus/hover and disables animation under reduced motion.

Existing ad/workspace suites cover mobile, tablet and desktop tool layouts; the latest result suite performed actual Image Converter and PDF output downloads. Physical devices, Safari/Firefox, production authentication, live database and provider overlays were not verified.

## Files changed in this audit/add-on

- **Ratings backend/database:** `netlify/database/migrations/0009_create_tool_ratings.sql`, `netlify/functions/tool-ratings.mjs`, `netlify/functions/admin-tool-ratings.mjs`, `netlify/functions/admin-data.mjs`, `netlify/functions/admin-database-diagnostics.mjs`, `netlify.toml`, `_redirects`.
- **Main public UI:** `index.html`, `public_html/assets/tool-ratings.js`, `public_html/assets/app.js`, `public_html/assets/style.css`, `public_html/assets/image-converter.js`, `public_html/assets/gps-map-camera.js`, `public_html/assets/pdf-edit.js`.
- **Background Remover:** `background-remover-app/src/components/ToolRating.tsx`, `background-remover-app/src/components/ExportDialog.tsx`, `background-remover-app/src/styles/global.css`; its normal Vite build regenerated `public_html/background-remover/index.html` and hashed CSS/JS assets.
- **Admin UI:** `public_html/admin/index.html`, `public_html/admin/admin.js`, `public_html/admin/admin.css`.
- **Dependencies/scripts:** `package.json`, `package-lock.json` (ratings test scripts plus patched production dependency versions).
- **Contracts and browser QA:** `tests/tool-ratings-contract.mjs`, `tests/tool-ratings-browser.mjs`, `tests/postgres-auth-integration.mjs`, `tests/database-recovery-contract.mjs`, `tests/admin-panel-contract.mjs`, `tests/admin-dashboard-final-contract.mjs`, `tests/production-finalization-contract.mjs`.
- **Documentation:** `docs/TOOL_RATINGS_ROLLOUT.md`, this report.

Pre-existing uncommitted result/download and advertising work was deliberately preserved, including changes in `public_html/assets/ad-network.js`, specialized result CSS, result/ad browser suites, `scripts/generate-result-download-audit.mjs`, and `docs/RESULT_DOWNLOAD_LAYOUT_AUDIT.md`. Those files were not reset or presented as new database/rating work.

## Validation ledger

| Command/suite | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm test` | PASS; normal PostgreSQL integration intentionally skipped with a clear opt-in message |
| `npm run build` | PASS, explicit exit code 0 |
| `git diff --check` | PASS, exit code 0; line-ending warnings only |
| `RUN_POSTGRES_INTEGRATION=true node tests/postgres-auth-integration.mjs` | PASS, isolated Netlify development database |
| `npm run test:ratings:browser` | PASS, 9 responsive widths and a real PDF download |
| `npm run test:ads:browser` | PASS, 150 fixture lifecycle/publication checks |
| `npm run test:tool-ad-layout:browser` | PASS, 72 responsive checks plus real GST/JSON/PDF flows |
| `npm run test:result-download:browser` | PASS, 18 responsive checks and 2 real downloads |
| genuine-provider local sample | Requests/responses verified; no sampled display creative filled |
| `npm audit --omit=dev --audit-level=high` | PASS, 0 production vulnerabilities |

No required command remains failed. Static-map/geocoder failure logs are deliberate sanitized failure-path fixtures. The normal test command skips the PostgreSQL integration by design; it was separately run and passed in isolation.

## Issue summary

| Issue | Severity | Verified cause | Files | Action taken | Remaining work |
| --- | --- | --- | --- | --- | --- |
| Admin database unavailable | Critical | production identity/schema mismatch not yet authenticated | `admin-database-diagnostics.mjs`, migrations 0001–0008 | core/optional diagnostic separation; isolated DB validation | authenticated preview/production reconciliation |
| Ratings persistence unavailable | High | production DB not confirmed; feature intentionally gated | migration 0009, rating functions/UI/Admin | implemented and verified locally | preview migration, secret and enable flag |
| PPT to PDF fidelity | High | no production-safe faithful renderer | existing PPT tool/content | honest unavailable state retained; ratings excluded | external renderer/service decision |
| Historical Search Console exclusions | Medium | redirects intentional; barcode noindex intentional; QR report stale; Edit/PPT technically eligible | generated SEO output | no speculative SEO change | request validation/indexing in Search Console after deploy as appropriate |
| Ad slots not visibly filled in sample | Medium | provider returned scripts but no observable creative | central ad runtime | confirmed requests/200/no-fill collapse | provider dashboard and live creative/brand-safety review |
| Production dependency advisories | High | patched transitive/direct versions were available | `package.json`, lockfile | production audit reduced to zero | keep regression tests green |
| Development dependency advisories | Medium | transitive test/build tooling | lockfile/tooling | documented only | separate controlled tooling upgrade |
| Earlier Google credentials exposed | Critical | owner-reported historical exposure | external Google/Netlify settings | no values reused or printed | confirm revocation/rotation externally |

## Deployment recommendation

**NO-GO for a consolidated production release until the database branch/migration state is proven in an isolated Netlify preview and genuine Admin/event/rating persistence checks pass.** The static SEO, result/download, ratings UI and ad lifecycle work is locally testable, but provider fill and production database/integration behavior remain external verification gates.
