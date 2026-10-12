# Tool workspace compaction and safe ad layout

Date: 2026-10-12. Local implementation only; no commit, push or deployment.

## Changes and scope

- Shared upload-first pages now use a maximum 1280px page width, less top/card padding and a smaller decorative upload icon. Actual file types, limits, picker, validators and processing engines are unchanged. Cards grow for wrapped content rather than clipping to a fixed height.
- Crop's existing empty-state stage remains proportional; no loaded canvas geometry changes.
- Image Converter's empty drop zone is 280px minimum instead of 330px. Loaded preview/settings are unchanged.
- Edit PDF's already-small upload card is not artificially enlarged. Its technical overview moves from above upload to the lower guide, headed “How PDF editing works” in the interactive page. The static SEO generator preserves the overview inside the guide too. Loaded Edit PDF keeps its full editor width, toolbar, properties and exports.
- Upload/ready disclosure now includes the dedicated PDF editor using its existing document visibility state. It does not change document state or processing.
- Existing single native placement starts below the guide, not next to the newly compact uploader. A ready result promotes the unrequested placement to after-tool, following the whole workspace **and session result links**, before guidance. An already requested ad is never remounted. Dedicated editors without a ready-result marker retain their after-guide placement. Edit PDF and Image Converter receive an after-tool candidate outside their mounts; PDF preview availability is its safe ready marker.

## Measured empty state (1440 × 900)

Measurements are CSS pixels from actual Chromium DOM rectangles, not estimates or whole-page heights. Source: `test-results/tool-ad-layout/{before,after}/measurements.json`.

| Route | Old upload height | New upload height | Old upload top | New upload top |
|---|---:|---:|---:|---:|
| Edit PDF | 198.08 | 198.08 | 392.72 | 256.22 |
| Compress PDF | 373.25 | 337.31 | 349.97 | 309.97 |
| Merge PDF | 373.25 | 337.31 | 349.97 | 309.97 |
| Split PDF | 373.25 | 337.31 | 349.97 | 309.97 |
| Crop Image | 345.94 | 323.94 | 347.97 | 309.97 |
| Compress Image | 373.25 | 337.31 | 349.97 | 309.97 |
| Image Converter | 330 | 280 | 442.88 | 404.88 |

GST and JSON are input tools, not upload drop zones; their existing layouts are retained and included in responsive/function checks. Shared changes also apply to existing upload-first routes, without a claim that every processor was re-certified.

## Advertising policy and rail decision

Only the existing Native Banner is active, with one unit per document. All six fixed-size banners, Popunder and Social Bar remain disabled in `public_html/assets/ad-config.js`. The 81 eligible / 14 ad-free tool policy is unchanged. No demo ad language was found in shipped UI (the search also matched an unrelated “upload area” sentence).

**No sidebar ad renderer is enabled or added in this pass.** Therefore no 300px column, empty frame or placeholder is reserved at any viewport. The main workspace uses the available width within its normal container. This deliberately avoids activating unapproved fixed-size formats. A future rail needs explicit enablement and a real provider fill signal; a script load alone must not enable its two-column layout. Filled-rail rendering is not claimed as tested functionality.

Future rail candidates: Compress PDF, Merge PDF, Split PDF, PDF-to-image, image-to-PDF, Compress Image, Resize Image, Image Converter, simple calculators and text/developer utilities. Exclude Edit PDF, active Crop Image, Background Remover, GPS Map Camera, Organize PDF and other canvas/drag-heavy editors. A future rail must remain desktop-only and collapse entirely on no fill.

## Result order and no-fill behavior

Existing result summaries, filename, real original/output sizes, measured PDF savings, downloads and reset controls remain together inside the workspace. Mobile's early download shortcut remains. No ad is inserted into a result card or between summary and download. Session result download links also precede the ad. Ads have 40px desktop / 28px mobile exterior spacing and their own neutral disclosure only when filled.

No-fill/error/blocked slots collapse using the existing hidden state, with no retry loop or reserved column. The existing lazy observer waits for the hydrated primary UI; below-tool placements may load when within its 200px approach threshold. No ad service is contacted in browser QA: controlled fixtures exercise fill/failure, not real impressions. Real third-party fill quality and eventual provider behavior cannot be certified offline.

Mobile/tablet retain one main column and flow tool → result/download/reset → optional native ad → guide. No sticky or fixed ad was added. Loaded editor side panels retain their existing responsive behavior.

## Validation

Responsive snapshots cover nine requested routes at 320, 360, 390, 430, 768, 1024, 1280 and 1440px. Before/after screenshots at 390 and 1440px are in `test-results/tool-ad-layout/` (18 per pass).

The new browser suite also verifies GST output, JSON formatting, real PDF compression, downloaded PDF page count and reset. Existing UX/advanced PDF suites cover real file upload, output and editor regression. Advertising tests use controlled filled/empty/blocked responses and verify route policy, duplication, spacing and collapse.

- `npm run build`: exit 0, including `npm run lint`, Background Remover TypeScript/Vite build, full `npm test` and posttest suites. The existing classic-script Vite warning is non-fatal. Opt-in PostgreSQL integration is skipped by design; no production database was contacted.
- `npm run test:tool-ad-layout:browser`: exit 0; 72 route/width checks, no page overflow, no visible blocked-ad gaps, real GST/JSON/PDF checks, and result-ready placement promotion.
- `npm run test:ux-phase3:browser`: exit 0; nine real upload/process/download/reset workflows, 54 upload-first routes and 95-route inventory.
- `npm run test:phase4c:browser`: exit 0; 13 Edit PDF, 10 Merge PDF and 23 Split/Organize groups, including reopened output and touch interactions.
- Advertising contract in `npm test`: passed, 81 eligible / 14 excluded tools, fixed-size/intrusive units disabled, unchanged ads.txt and CSP.
- `npm run test:ads:browser`: exit 0; 154 checks, including the 20 additional filled-native spacing checks, all excluded routes, responsive fixtures, document navigation, repeated editorial sync, modal suppression, blocked/empty fill collapse and production CSP. No live ad requests.
- `git diff --check`: exit 0 (line-ending warnings only).
- Source and final dist copies of app.js, style.css, tool-ux.js and ad-network.js matched byte-for-byte.

An initial advertising run exposed early near-viewport requests beside the newly shorter empty state; the final implementation keeps the initial candidate below guidance and promotes only ready output before any request. A follow-up review also added explicit reuse of generated editorial candidates during repeated sync. No tests were weakened.

## Files

- `public_html/assets/app.js`: semantic overview placement and safe candidate ordering.
- `public_html/assets/style.css`: empty-state-only sizing.
- `public_html/assets/tool-ux.js`: dedicated Edit PDF disclosure.
- `public_html/assets/ad-network.js`: prefer after-workspace placement.
- `scripts/generate-seo-site.mjs`: preserve Edit PDF overview in lower static guide.
- `tests/ux-phase3-contract.mjs`: editor disclosure regression.
- `tests/tool-ad-layout-browser.mjs`: measurements, screenshots, responsive and functional checks.
- `tests/adsterra-browser.mjs`: additional filled-native spacing checks.
- `package.json`: named browser QA command (`test:tool-ad-layout:browser`).
- This report.

No authentication, database, processing engine, ad identifier, SEO metadata, route registry, dependency or deployment configuration changes.
