# Phase 4A functionality checkpoint — IN PROGRESS

Updated: 2026-10-05. Local repository only. **This is not the final 95-tool functionality certification or deployment approval.**

## Coverage and counts

- Registered routes inventoried: **95**.
- Direct URL + hydrated page + no horizontal overflow: **95/95** at 320, 360, 375, 390, 412, 430, 768 and 1440 CSS pixels in installed Chromium.
- Entries with selected core/output evidence in the matrix: **68**. This includes engine-level tests, existing output contracts and selected full UI workflows; it does not mean 68 complete end-to-end certifications.
- Entries without new per-tool core/output evidence in this ledger: **27**.
- Newly certified FULLY WORKING across every requested axis: **0**. This is a verification count, not a claim that zero tools function.
- Final partially-working/broken/format-limited/browser-limited totals: **pending**. Do not reuse the original audit's 62/32 counts as current results. Provisional format/browser scope restrictions and unfinished classifications are listed explicitly in both 95-row reports.
- Confirmed defects addressed below: no unresolved failure in their focused regressions. Additional defects may remain in untested axes.
- Current publication policy: **81 indexable tools, 81 ads-eligible tools, 14 noindex/no-ad review tools**. No additional route moved to noindex and no review route promoted during this checkpoint. These are existing flags, not final Phase 4A approval.
- Sitemap: **109 URLs** (81 tools, 27 content/category/legal pages and home). Public tool routes remain 95.

## Defects reproduced and fixed

All production function changes are in `public_html/assets/app.js`; the function names below are stable locations.

| Route(s) | Function / root cause | Fix and evidence |
|---|---|---|
| `/zip-manager/` | `runZIPMaker`: JSZip overwrote earlier files with the same name | Collision-safe suffixes reserve original names. Four duplicate/Unicode files retain all four byte contents after real mobile ZIP download, CRC validation and reopening. Empty selection rejects. |
| `/emi-calculator/` | `generateEMICalc`: zero rate rejected; unstable division and nonfinite results | Zero-interest branch, numerically stable annuity denominator, finite validation; blank rate remains missing, not zero. UI min now permits zero. |
| `/loan-calculator/` | `generateLoanCalc`: zero rate rejected; fractional months truncated; unbounded schedule | Zero-rate amortization, whole months 1–1200, finite totals/schedule validation. Flat and reducing examples tested. UI constraint matches cap. |
| `/interest-calculator/` | `generateInterestCalc`: zero rate/duration rejected; overflow printed | Explicit zero support, missing/negative/nonfinite validation and overflow message. Simple and compounded expected outputs tested. |
| `/sip-calculator/` | `generateSipCalc`: zero rate rejected; division by rate | Zero-return contributions, stable compounding expression, finite guards. Beginning-of-month contribution semantics preserved. |
| `/percentage-calculator/` | `generatePercentageCalc`: zero divisor replaced with one; zero-base change returned fake 0%; missing pairs fabricated values | Undefined zero-base/divisor results are explained; missing pairs stay incomplete; finite results preserve existing calculation types. |
| `/discount-calculator/` | `generateDiscountCalc`: negative or >100% discounts accepted | Discount/tax range validation and overflow handling. Sequential discount plus tax verified. |
| `/scientific-calculator/` | `evaluateSciExpression`: substring replacement mangled inverse trig; degree conversion applied only to first term | Whitelisted operations convert complete arguments. `sin(30+30)`, inverse trig, powers, roots, logs and invalid tokens tested. |
| `/timestamp-converter/` | `generateTimestampConvert`: parseInt truncated exponent notation; empty input became epoch zero; out-of-range date could throw | Parse complete number; reject missing/nonfinite/out-of-Date-range values before formatting. Actual epoch zero still works. |
| `/age-calculator/`, `/date-calculator/` | Single-month borrowing produced negative days (Jan 31–Mar 1); reversed duration produced 1 year/10 months for 29 days; local date setters shifted dates across timezone/month boundaries | Shared validated civil-date arithmetic uses UTC; month/year offsets clamp to valid days, reversed duration uses the same positive breakdown, leap-day convention is disclosed. Invalid dates, fractional/missing offsets and out-of-range results reject. Five grouped boundary checks pass in Los Angeles and Kolkata TZ runs. |
| `/base64-tool/` | Live btoa/atob path rejected/misdecoded Unicode; file import encoded Base64 a second time; non-UTF-8 decoding replaced bytes silently | Shared UTF-8 conversion, strict decoder, true file-byte encoding/Base64-file decoding, stale-import guard and invalid-download prevention. Binary file decoding/export is not claimed. |
| `/hash-tool/` | Live preview treated whitespace/empty text as absent and showed `-`; digest rejection could escape an event handler | Hash the actual UTF-8 bytes, including empty bytes. Accessible unsupported-algorithm/API errors and stale-text-request guard. Independent Node SHA-1/256/384/512 comparisons verify engine outputs. |
| `/organize-pdf/` and page-range consumers | `runPDFOrganize` silently discarded invalid selections; `parsePdfPageSelection` accepted `1-0` | Shared strict validation, preserving intentional reorder/repeated pages; invalid ranges reject before export. No billion-range iteration. |
| `/crop-pdf/` | `runPDFCrop`: negative/nonfinite margins accepted | Validate all margins before PDF work; reopened CropBox and untouched pages checked. |
| `/markdown-to-pdf/` | `runMarkdownToPDF`: one-page limit and 80-character substring silently discarded source text | Reuses existing bounded, paginated text renderer; six-page fixture, final sentinel, 800-character token, Unicode/empty/oversize failures and inert raw markup tested. Keeps heading/plain-text scope. |
| `/svg-to-png/` | `runSvgToPng`: missing image/reader rejection left corrupt SVG pending indefinitely | Existing decoded-image helper, explicit input/dimension/pixel limits, canvas/encoding errors and resource cleanup. Real invalid image rejects and valid PNG decodes. |
| `/word-to-pdf/`, `/txt-to-pdf/`, `/excel-to-pdf/`, `/epub-to-pdf/` | `createTextPdf`: unbroken tokens could exceed printable width | Wrap every character without truncation; reopen operators and measure every run. Fail explicitly at 500 pages rather than return partial output. Existing format limitations remain. |

`public_html/assets/tool-content.js` changes in this checkpoint correct Markdown scope/limits, Base64 text-only decoding scope, and calendar month-end/timezone behavior. No bulk editorial rewrite.

## Tests and output evidence

`npm run test:phase4a` is included in the existing `posttest` chain:

- `calculators-archives.mjs`: 37 grouped checks, including mathematical normal cases for all 15 calculators, focused zero/missing/invalid/overflow/calendar boundary cases, Epoch and duplicate ZIP content. The entire file also passes with `TZ=America/Los_Angeles` and `TZ=Asia/Kolkata`.
- `text-utilities.mjs`: 15 grouped checks across Base64, URL, JSON, UUID, password, hash, diff and Markdown utilities. Includes independent UTF-8/SHA byte comparisons, actual file-encoding logic, invalid input, stale import, 100KB JSON, secure generation structure and inert hostile content. Engine checks are not complete download/reset/browser certifications.
- `pdf-output.mjs`: 15 grouped real-output checks. Reopens PDF pages, verifies ordering/rotation/CropBox/Unicode metadata/drawn operators, parses split ZIP entries, checks corrupt input and long-token wrapping.
- `markdown-output.mjs`: real six-page PDF, ending marker, long token retention, explicit empty/oversize/unsupported-Unicode failure and inert HTML.

`npm run test:phase4a:browser`:

- `browser.mjs`: 95 direct routes × eight widths; actual touch EMI input and four-file ZIP selection/process/download/reset.
- `calendar-text-browser.mjs`: calendar, Base64 and hash workflows in two browser timezones, eight populated-result widths, real binary/Base64 input files and reopened Unicode TXT download. Final execution status is recorded below.
- `conversion-browser.mjs`: 18 cases covering actual browser conversion engines and invalid SVG; real PDF/RTF/text/HTML/Markdown/EPUB/XLSX/PPTX/image/archive outputs parsed or decoded. Package presence alone does **not** certify spreadsheet fidelity or slide visual fidelity.
- `background-browser.mjs`: real local ONNX WASM model, invalid input, one real product photograph, mobile PNG export; independent image decode proves source dimensions and both transparent and retained pixels. No model/mask mock. This is not hair/brush/pinch/crop/cross-browser certification.
- Existing `ux-phase3-browser.mjs`: nine real upload/process/download/reset workflows; width checks, keyboard picker and 95-route navigation inventory. Resize now explicitly tests 50% output.
- `download-output.mjs`: independently reopens those nine browser downloads; expected image dimensions, PDF structure, ZIP CRC and OCR text.

Additional specialized suites are recorded in the validation section below. GPS tests use controlled provider responses: no claim of live Geoapify service verification or real location permission testing.

## Test failures encountered and corrected

- Initial numeric/archive run: 9/23 passed; concrete application defects listed above were then repaired. The next calendar-edge expansion reproduced four grouped failures, now repaired. Expanded suite has 37 grouped checks.
- Text utility expansion reproduced the Unicode Base64 and whitespace/empty hash inconsistencies. One JSON fixture incorrectly expected object prototype identity after JSON serialization; corrected the fixture, not the production JSON implementation. The expanded suite passes all 15 groups.
- PDF harness originally mixed VM/native Array realms; corrected the harness to use the same realm as pdf-lib, then reproduced and fixed actual Organize/Crop validation failures. No production workaround for the harness issue.
- First wide browser attempts hit third-party dependency timeouts. Playwright routing used to block ads disables its normal cache. The helper caches exact real CDN responses per suite; it does not stub or replace processing libraries. The final 95-route run passed. External CDN availability remains a production dependency.
- Existing SPA inventory test waited for a document `load` event after history navigation. It now waits for the exact URL plus the existing application-ready checks.
- Image Converter's older test looked for the superseded `Choose Image` label. Updated to actual `Select image`, keeping the genuine filechooser and touch-target assertions.
- PPT conversion test assumed a Blob return. Corrected it to inspect the real `{ blob, warnings, slideCount }` API already used by the application. PPT implementation was not changed.

## Fake-output review

Focused production-source searches found only the legitimate Lorem Ipsum mockup-text description and a notice explicitly saying no fake document rendering is displayed. No new simulated engine/output fallback was removed in this checkpoint. Earlier Phase 2 secure UUID and safe text-output regressions still run. This keyword search is not a substitute for the remaining per-tool output checks.

## Files changed in this checkpoint

- `public_html/assets/app.js`
- `public_html/assets/tool-content.js` (Markdown, Base64 and calendar claim corrections)
- `package.json` (deterministic regressions and explicit browser command)
- `tests/tool-content-contract.mjs` (stable EMI/SIP formulas; numeric tests added, not removed)
- `tests/ux-phase3-browser.mjs` (actual resize result, SPA wait, exact CDN-response cache)
- `tests/image-converter-browser.mjs` (current accessible upload label and exact CDN-response cache)
- `tests/adsense-phase2.mjs` (load the shared UTF-8 helper and decoder in the existing hostile-input harness)
- Ten new modules under `tests/tool-functionality-phase4a/`
- `docs/TOOL_FUNCTIONALITY_REAUDIT.md`
- `docs/TOOL_FUNCTIONALITY_MATRIX.md`
- This report

Build generation also refreshes existing SEO/content audit artifacts and ignored `dist/`; existing unrelated admin/GPS/earlier-phase worktree changes were preserved. The overall Git diff contains earlier work and must not be attributed solely to this checkpoint.

## Validation status

- Production build including lint, full npm test, repository-specific contracts, SEO/noindex/sitemap checks and Background Remover type/build/tests: **passed, exit 0** after all calendar/Base64/hash fixes and content alignment.
- Calendar/text browser suite: **passed, exit 0**. Eight route/timezone workflows (four tools × Los Angeles/Kolkata), eight populated-result widths each, real file imports and independently reopened Unicode TXT downloads. Evidence: `test-results/tool-functionality-phase4a/calendar-text/results.json` and four mobile screenshots.
- Combined Phase 4A browser suite: **passed, exit 0** after the calendar/text changes. Includes 95 routes/eight widths, eight calendar/text route-timezone workflows, 18 conversion cases, real Background Remover WASM inference/export, nine upload/process/download/reset workflows and all nine reopened downloads.
- Edit PDF browser suite: **passed** (form values, flattened/editable reopen, overlays/signatures, touch, rotations, errors/reset and eight widths).
- Image Converter browser suite: **passed** after selector correction (16 conversions, decoder reopen, invalid formats/animation consent, seven mobile and six desktop widths).
- GPS compact-stamp browser suite: **passed**, six portrait/landscape/template JPEG outputs and mobile full-resolution PNG, map-size controls, EXIF and provider/fallback races. Provider responses are controlled fixtures, not live Geoapify.
- Phase 2 browser suite: **passed**, 14 noindex/no-ad routes, HTML pagination/download/failure, real QR and Code 128 fallback decoding and navigation. Installed Chrome lacks native BarcodeDetector; its native branch has only controlled-API test coverage.
- `git diff --check`: **passed, exit 0**; Git emits existing LF-to-CRLF warnings, not whitespace errors.
- PostgreSQL integration: intentionally skipped by normal tests; no database credentials or production account changes.

## Remaining work / release decision

Phase 4A remains **in progress**. Finish each matrix row's processing/validation/reset/error/export/browser axes, strengthen conversion fidelity/Unicode/multi-file tests, finish developer/ZIP/QR family coverage, and expand remaining calculator boundary tests. Calendar edge regressions now pass, but this does not complete all calculator input/compatibility checks. Do not infer FULLY WORKING from a route loading, one valid Blob, one fixture or an existing publication flag.

Firefox, Safari, actual mobile hardware, native BarcodeDetector, microphone/voice availability, camera/geolocation permissions and live external services remain unverified. Existing authentication/database/admin, routes, SEO, GTM and AdSense integrations were not redesigned or reconfigured.

Nothing committed, pushed or deployed. No production configuration or secrets changed. AdSense approval is not guaranteed. This checkpoint alone does not authorize release.
