# Ad layout expansion — local implementation

Historical implementation report. The current breakpoint mapping, rail selection and validation results are documented in [ADSTERRA_FULL_UNIT_ROLLOUT.md](ADSTERRA_FULL_UNIT_ROLLOUT.md), which supersedes the mapping and results below.

No commit, push, deployment, account configuration, tracking-ID change, or ads.txt change is part of this work. This document supersedes the **native-only, one-placement** rollout limits in ADSTERRA_INTEGRATION.md.

## Architecture and placements

The source of truth remains `public_html/assets/ad-config.js`. `network` selects `adsterra`, `adsense`, or `off`; rebuild after changing it. `config/ad-network.mjs` injects the local runtime only into publication-policy-approved HTML. `ad-layout.js` is a deterministic, unit-tested planner. `ad-network.js` owns eligibility checks, measured placement, lazy loading, failure cleanup, and document-lifetime deduplication. No per-tool ad code or independent keys were added.

| Zone | Enabled | Selection / conditions |
| --- | --- | --- |
| Below tool heading/description | Yes | 728×90 at desktop ≥1024 if it fits; 468×60 at tablet ≥768; otherwise 320×50 only when the actual content width is ≥320 |
| After complete tool | Yes | One native unit at the existing marker after workspace, results, download/reset, and session history |
| Right rail | Yes, conditional | ≥1280 AND measured unused gutter; 300×250 if gutter ≥324, otherwise 160×300 if gutter ≥184 |
| Left rail | Yes, conditional | ≥1600 AND measured unused gutter ≥184; 160×600 |
| Content middle | Yes, conditional | One 300×250 between guide sections with substantial preceding copy; tablet/desktop only, remaining density budget, and unused key required |
| Additional footer unit | No | Not needed within conservative density limits |

Each approved banner key is used at most once per document, and the native fixed container ID has one instance. Format choice is stable; resize never refreshes an ad. The six approved banner definitions remain centralized. Each banner receives its own iframe context and `atOptions` so concurrent units cannot race a shared options global. The provider controls creative links; no ad-click handlers or custom redirects are installed. The compatibility iframe is **not a security sandbox**; Adsterra remains trusted third-party code, as with the existing native integration.

## Responsive layout and density

- Simple allowlisted tools: maximum 4 placements, including native. Both rails consume that budget, replacing the content placement where necessary.
- Other/high-interaction tools: maximum 3 inline placements; no rails unless expressly allowlisted in configuration.
- Mobile: maximum 2; 320×50 plus native if space permits. At 320px viewport width, normal page padding leaves less than 320px: the fixed banner is omitted, not scaled, clipped, or forced into overflow. Native remains after the tool.
- Homepage/editorial and Background Remover: retain the existing single native candidate. Background Remover's React-owned editor DOM is not reparented or modified.
- Tested existing tool shells have insufficient unused gutter at 1280–1600px, so they deliberately have **no rails** there. At 1920px both 160px rails fit. Breakpoint alone does not authorize a rail.
- Rails use only existing external gutters. The main tool column is never squeezed or given a reserved blank rail column. Pending/failed units have zero layout height; mounted rails are non-sticky and outside the tool rectangle. Header and tool widths stay unchanged whether a rail fills or not.
- Ads carry a neutral `Advertisement` disclosure and dedicated spacing. No ads are inserted into tool controls, preview/result elements, or between result and download.

## Eligibility and exclusions

The existing publication policy is unchanged: **81 of 95 registered tool routes eligible; 14 noindex/ad-free routes denied**. Runtime checks also require productionReady and reject noindex metadata. Private/dashboard/admin/error pages remain excluded at generation and runtime.

Rails are opt-in for the simple/medium route list in configuration. Edit PDF, Crop Image, Organize PDF, Background Remover, GPS Map Camera and unknown/new tools are not allowlisted. Do not automatically grant rail eligibility by category: future canvas-heavy tools must default safe.

## Failure and lifecycle safeguards

IntersectionObserver requests units only within 200px of the viewport. No provider response is itself a fill signal: native/banner creative DOM is required, and nested creative iframes must emit a load event with a nonblank source. The host compatibility iframe never counts as a filled ad.

Blocked/failed/no-response/no-creative units collapse; no fake creative, placeholder, spinner, border, or reserved space remains. No-fill timeout is 20 seconds. A delayed creative is not revealed while a tool field is active; pointer interaction cancels pending ad loads to avoid moving controls under the pointer. Modal/error/processing states suppress requested units. Closing a modal does not refresh an already requested unit. Fresh document navigation after any provider execution preserves the existing SPA safety guard. Resize waits 150ms for dimensions to settle, collapses units that cease to fit, and never generates replacement impressions. Rail breakpoint CSS hides prohibited rails immediately.

Cross-origin creative contents are opaque: an iframe load is a rendering signal, **not proof of a paid impression or visible inventory**. Provider-side blank-creative behavior, consent, creative quality and pop-up policies need account-level validation; local fixtures cannot prove them. No ad earnings or impressions are fabricated. Inline insertion may still cause initial layout shift when a fast response fills; no guarantee of zero CLS is made, because reserving permanent blank ad space was expressly excluded.

## Disabled formats, switching, and CSP

Popunder and Social Bar remain explicitly disabled. Interstitial is disabled/deferred because no approved interstitial unit was supplied. The 30-minute frequency setting is reserved documentation/configuration only; there is no fabricated overlay implementation.

Zone switches: `zones.top`, `right`, `left`, `afterTool`, `content`. Global switch: `network`. For future AdSense, change `network` to `adsense` and rebuild: the existing canonical Google loader is retained instead of injecting Adsterra. Do not mix networks in slots. `off` removes both public network installations. GTM, GA4, Google publisher configuration, robots, sitemap, ads.txt, authentication and engines are untouched.

CSP unchanged. Existing policy does not restrict script-src/connect-src/frame-src; no wildcard weakening or guessed third-party allowlist was added.

## Validation

- `tests/adsterra-contract.mjs`: all 95 generated routes, 81/14 eligibility, three network switches, deterministic widths/density, editor exclusions, distinct keys and unchanged ads.txt/CSP.
- `tests/ad-layout-browser.mjs`: default expanded configuration, 9 requested representative routes × 10 widths (320,360,390,430,768,1024,1280,1440,1600,1920), all six banner adapters, one native ID, no overlap/overflow, blocked/no-fill collapse, resize without refresh, 14 exclusions, real GST/JSON interactions and real PDF upload/process/download/reopen.
- `tests/adsterra-browser.mjs`: retained native-only lifecycle regression using an explicit test-only zone configuration; all eligible routes, exclusions, editorial routes, modal suppression, fresh-document navigation and native failures.
- Screenshots and JSON measurements: `test-results/ad-layout-expansion/`. Ad-looking creative boxes in these screenshots are **intercepted test fixtures only**, never production assets. No live creative or impression requests are executed by browser QA. The approved provider bootstrap was fetched as text during adapter inspection, not executed.

### Executed validation

| Command / suite | Result |
| --- | --- |
| `npm run lint` | PASS, exit 0 |
| `npm test` | PASS, exit 0; isolated PostgreSQL integration remains explicitly skipped without its opt-in flag |
| `npm run build` | PASS, exit 0 on final runtime; includes Background Remover TypeScript/Vite and full contracts |
| `node tests/ad-layout-browser.mjs` | PASS on final build: 93 recorded checks (90 route/width cases, two failure cases, real PDF output); additional GST/JSON, duplicate/resize, screenshot lifetime and 14 exclusion assertions |
| `node tests/adsterra-browser.mjs` | PASS: 154 native lifecycle/publication/responsive checks |
| `node tests/tool-ad-layout-browser.mjs` | PASS: 72 responsive checks; GST, JSON, PDF processing/download/reopen/reset |
| `node tests/image-converter-browser.mjs` | PASS: 16 real conversions with signature/decoder reopening; 7 mobile and 6 desktop widths; format/error/security checks |
| `git diff --check` | PASS; no whitespace errors |

The existing Vite warning for the non-module `/assets/tool-content.js` script remains; build exits 0 and generated asset/SEO contracts pass. An initial content-audit report write encountered a transient Windows `UNKNOWN` error; retry and subsequent full test/build runs passed. No test was disabled to obtain a pass. The native-only regression explicitly selects its original single-zone setup; the separate expanded suite exercises the production multi-zone configuration.

Visual QA found one additional bug: screenshot capture briefly reported a **1px viewport**, causing the immediate resize handler to permanently retire otherwise fitting banners. The 150ms settling delay fixes that lifecycle issue. A retained assertion now verifies that scrolling and screenshots do not retire filled slots; the complete 90-case matrix and 154-check native suite passed again after the fix. Preview evidence includes 8 full-page and 8 viewport screenshots in `test-results/ad-layout-expansion/`.

Provider-account/live creative validation remains a pre-deployment owner check; this task does not deploy or change Adsterra settings. Real-device testing and field CLS measurements were not performed. The browser runs use Chrome viewport/touch emulation, not physical phones.

## Files changed in this phase

- `config/ad-network.mjs` — includes the shared layout planner through the existing eligible-page generator hook.
- `public_html/assets/ad-config.js` — zone switches, approved banner enablement, density limits, explicit rail allowlist, deferred interstitial configuration.
- `public_html/assets/ad-layout.js` — new deterministic pure planner.
- `public_html/assets/ad-network.js` — multi-zone lifecycle, isolated banner options, lazy loading, conservative fill checks and cleanup.
- `public_html/assets/ad-network.css` — collapsed loading state, measured non-sticky gutter rails and banner frame styling.
- `package.json` — planner/browser syntax checks and expanded-ad browser command.
- `tests/adsterra-contract.mjs` — strengthened multi-zone/publication/switch contracts.
- `tests/adsterra-browser.mjs` — retained native lifecycle tests with explicit native-only zone configuration.
- `tests/ad-layout-browser.mjs` — new expanded-layout/default-config fixture and real-output browser suite.
- `tests/tool-ad-layout-browser.mjs` — locates the after-tool marker specifically rather than assuming it is the only ad.
- `docs/ADSTERRA_INTEGRATION.md` — points historical rollout readers to the current policy.
- `docs/AD_LAYOUT_EXPANSION.md` — this report.

Existing uncommitted PDF/editor/content changes were preserved. This phase did not change any processing engine, route registry, authentication/database code, Google IDs, or deployment settings. Normal build outputs were regenerated by the existing build, not patched by hand.
