# Adsterra full-unit rollout — local only

This report supersedes the breakpoint mapping in AD_LAYOUT_EXPANSION.md. No commit, push, deployment, provider-account change, or live ad interaction is authorized by this work.

## Inventory and central controls

`public_html/assets/ad-config.js` remains the sole unit/configuration source. All approved IDs and URLs are unchanged. `network` selects `adsterra`, `adsense`, or `off`; rebuild after changing it. `native.enabled`, each `banners[].enabled`, zone switches and density limits independently control the supported placements. No per-tool scripts were added.

| Approved unit | State | Placement |
| --- | --- | --- |
| Native | Enabled | One after-tool unit, unique provider container ID |
| 728×90 | Enabled | Top, desktop ≥1280 |
| 468×60 | Enabled | Top, tablet 768–1279 |
| 320×50 | Enabled | Top, mobile, only if actual content width is ≥320 |
| 300×250 | Enabled | Right gutter when it fits, otherwise eligible content section |
| 160×300 | Enabled | Secondary gutter at 1600–1919 when it fits |
| 160×600 | Enabled | Secondary gutter at ≥1920 when it fits |
| Social Bar | Enabled | Official provider bootstrap once per ads-eligible public document |
| Popunder | Enabled | Official provider bootstrap once per ads-eligible public document |

All nine selected units are enabled. The local bootstrap injects the exact Popunder and Social Bar provider scripts once per eligible document. It does not add custom click listeners, call `window.open`, force redirects, or claim control over provider-owned frequency or creative behavior. Smartlink remains disabled.

Adsterra documents [page-interaction Popunder behavior](https://adsterra.com/blog/popunder-traffic-monetization/) and [provider-controlled Social Bar formats](https://adsterra.com/blog/publishers-guide-to-social-bar/). Loading each bootstrap once prevents duplicate site initialization, but does not prove provider fill, popup frequency, creative quality, or safe overlay geometry. Those remain deployment-time provider/account checks. Interstitial remains disabled and is not one of the nine selected units.

## Routes, placement and density

The unchanged publication policy admits **81 of 95 tool routes**, excluding all **14 noindex/ad-free tools**. Production readiness and runtime noindex checks are retained. Private, login/signup, dashboard, admin and error pages do not receive ads. There is no change to route IDs, SEO, authentication, Google tags or ads.txt.

Rails are opt-in for these existing simple-tool routes only (and still subject to publication eligibility):

`compress-pdf`, `merge-pdf`, `split-pdf`, `pdf-to-jpg`, `jpg-to-pdf`, `image-to-pdf`, `compress-image`, `resize-image`, `image-converter`, `calculator`, `scientific-calculator`, `percentage-calculator`, `age-calculator`, `date-calculator`, `emi-calculator`, `loan-calculator`, `interest-calculator`, `gst-calculator`, `sip-calculator`, `bmi-calculator`, `discount-calculator`, `unit-converter`, `currency-converter`, `time-calculator`, `json-tool`, `hash-tool`, `word-counter`, `lorem-ipsum`, `diff-checker`, `regex-tester`, `timestamp-converter`.

Other eligible tools default to inline-only. Edit PDF, Crop Image, Organize PDF, Background Remover and GPS Map Camera have no rails. Background Remover preserves its existing single after-tool Native placement without modifying its React-owned workspace. Homepage/editorial pages retain the conservative single Native candidate.

| Viewport | Top format | Rails | Maximum placements |
| --- | --- | --- | --- |
| <768 | 320×50 if it fits | None | 2 |
| 768–1279 | 468×60 if it fits | None | 3 |
| 1280–1599 | 728×90 if it fits | Right 300×250 only with ≥324px measured free gutter | Simple 4; editor 3 |
| 1600–1919 | 728×90 | Right as above; optional 160×300 with ≥184px free gutter | Simple 4; editor 3 |
| ≥1920 | 728×90 | Right as above; optional 160×600 with ≥184px free gutter | Simple 4; editor 3 |

The two tall formats are mutually exclusive. Native receives a reserved budget position; content-middle 300×250 is added only when substantial guide sections, remaining budget and an unused key exist. It never duplicates a right-rail key. On a 320px viewport, page padding leaves less than 320px, so the fixed banner is omitted and Native remains; the banner is not clipped or scaled.

Breakpoint eligibility does not guarantee physical room. Existing wide tool shells generally leave insufficient rail space at 1280–1600; at 1920 the 160px secondary rail fits but the 300px right rail does not. Larger widths can admit the right rail. Tool columns are never squeezed to accommodate inventory.

Top banners follow the H1/description outside the workspace. After-tool Native follows the entire interaction/results/download area. Content placements are between substantial editorial sections. Rails are non-sticky, outside the tool rectangle, with measured separation. No ad-click interception, wrapping popup behavior, tool DOM reparenting, or custom advertiser navigation is added.

## Lifecycle, performance and failures

The existing centralized runtime lazily requests below-fold placements near the viewport. Each approved key executes at most once per document; Native has one fixed container. Modal/processing/focus safeguards, navigation deduplication and settled-resize retirement remain intact. Resizing never refreshes an ad. Pending, blocked, failed and no-fill containers collapse without placeholder text, border or reserved gap; no-fill timeout is 20 seconds.

No CSP changes were needed. Provider scripts use controlled configuration, not user-supplied HTML. Isolated banner iframe contexts prevent shared `atOptions` races but are not a security sandbox. Cross-origin creative loading cannot prove a paid impression or nonblank provider inventory. Live provider quality, consent and fill require account-level review. Initial inline fill may cause layout shift; zero CLS and revenue gains are not promised.

## Validation

All browser ad requests are intercepted with test-only fixtures; no real impressions, clicks or advertiser windows are generated. Required nine tools are exercised at 320, 390, 430, 768, 1024, 1280, 1440, 1600 and 1920, plus 360, 1800 and 2400 to cover narrow layout and both secondary/right rail sizes.

| Command / suite | Actual result |
| --- | --- |
| `npm run lint` | PASS, exit 0 |
| `npm test` | PASS, exit 0 |
| `npm run build` | PASS, exit 0; includes Background Remover TypeScript/Vite and complete tests |
| `npm run test:ads` | PASS, exit 0; all 95 routes, 81/14 policy, switches, density and approved IDs |
| `node tests/ad-layout-browser.mjs` | PASS, exit 0; 111 recorded checks: 108 route/width cases, two no-fill/failure cases, real PDF upload/process/download/reopen; additional GST/JSON, resize, deduplication and 14 route-exclusion assertions |
| `node tests/adsterra-browser.mjs` | PASS, exit 0; 154 native lifecycle/publication/responsive checks |
| `node tests/tool-ad-layout-browser.mjs` | PASS, exit 0; 72 responsive cases and real GST/JSON/PDF processing/download/reopen/reset |
| `node tests/image-converter-browser.mjs` | PASS, exit 0; 16 real conversions validated/reopened; seven mobile and six desktop widths |
| `git diff --check` | PASS, exit 0; Windows LF/CRLF notices only |

Screenshots: `test-results/ad-layout-expansion/` contains eight full-page and eight viewport captures of Compress Image and Edit PDF at 390, 768, 1440 and 1920. `results.json` records all 108 width cases, including actual short/tall secondary rails at 1800/1920 and both rails at 2400. Mobile Compress Image/Edit PDF and desktop Compress Image viewport screenshots were visually inspected; fixture units remain separated from upload controls. The test output confirms zero page errors, horizontal overflow and workspace overlap in the measured cases. Screenshots contain clearly marked intercepted test creatives, not live advertisements.

The opt-in PostgreSQL integration test is skipped normally, as intended. The existing non-module `/assets/tool-content.js` Vite warning remains nonfatal. No tests were disabled or weakened for this rollout. Local browser emulation is not physical-device validation. Popunder/Social Bar tests verify eligible-only, once-per-document script initialization; provider frequency and overlay behavior still require owner review on the production domain. Local build and regression validation are green; deployment requires owner approval and provider-account/live creative review.

## Files changed for this follow-up

- `public_html/assets/ad-config.js`: explicit tablet density and documented blocked intrusive-unit policy.
- `public_html/assets/ad-layout.js`: requested tablet/desktop boundaries, 300px-only right rail and mutually exclusive tall secondary units.
- `tests/adsterra-contract.mjs`: density, unit-switch, rail dimensions and intrusive exclusion contracts.
- `tests/ad-layout-browser.mjs`: exact top-format assertions, intrusive-script exclusion and wider rail coverage.
- `docs/AD_LAYOUT_EXPANSION.md`: historical report points to this current report.
- `docs/ADSTERRA_FULL_UNIT_ROLLOUT.md`: current implementation and verification report.

Existing unrelated uncommitted changes are preserved. The normal build regenerated its existing SEO/audit reports, build-count snapshots and Background Remover artifacts; those outputs were not manually patched. No processing engine, authentication/database, route, branding, Google ID or deployment configuration was changed by this follow-up. Production publication remains pending owner approval and live-provider review.
