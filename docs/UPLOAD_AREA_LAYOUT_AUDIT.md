# Upload and input layout audit

Measured in local Chromium across all 13 requested sizes. Each area is scrolled into view before checking header clearance; document scrolling is permitted. Editor canvas clipping after upload is outside the initial-area assertion.

## Findings and shared fixes

- **Header clearance:** the old 96px scroll margin applied to workspace/result wrappers, not their input cards. Calling `scrollIntoView` on those cards aligned them beneath the fixed header. The baseline sweep reproduced this on all 95 routes. Root scroll padding now reserves the actual 72px desktop / 66px mobile header (including the mobile safe area); input and result targets add a shared 16px gap. The separate React header uses its existing 68px / 60px heights.
- **Inactive panels exposed:** author `display: grid` styles overrode the native `hidden` attribute in Image Converter and GPS Map Camera. Screenshots showed an empty original-image preview and inactive camera controls before upload. The shared tool-container hidden-state rule now respects the existing JavaScript state; it does not hide enabled features. `hidden="until-found"` is explicitly excluded.
- **Pre-upload height:** Crop Image inherited the real editor's fixed, clipped, minimum-480px canvas even before an image was selected. Only the empty state now grows naturally with responsive padding; uploading an image restores the existing bounded crop canvas.
- **Intrinsic grid widths:** Unit Converter's nested form/select minimum sizes overflowed at the narrowest width. Shared `min-width: 0` / `max-width: 100%` rules constrain flexible form children, rather than changing tool logic or using page-level overflow hiding.
- No blanket overflow suppression, new dependencies, tool-specific pixel offsets, route changes, processing logic changes, auth changes, or backend changes were introduced.

## Coverage and interpretation

- **95 tools before and after; 103 sitemap URLs.** Registry-driven matrix below has one row per tool.
- **1,235 measured combinations:** 665 mobile/tablet, 285 laptop, 285 desktop. All passed the final layout sweep.
- Sizes: 320×568, 360×800, 375×812, 390×844, 412×915, 430×932, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080.
- Checks cover actual bounding rectangles, clipping ancestors, document width, hidden-state correctness, and keyboard focus / hit testing for the first available primary control. User Agent Parser is automatic read-only information: its real browser output is checked instead of inventing an input.
- Long forms may need normal document scrolling. PASS means no ancestor clipping or inaccessible input area; it does not mean an arbitrarily long form fits on a single phone screen.
- The primary area is measured, not every possible post-processing state or every engine operation across all 95 tools.
- Evidence: `test-results/upload-area-layout/measurements.json`, 50 viewport screenshots and 50 full-page screenshots (10 representative routes × 5 sizes). Base64 Tool is the registered combined encoder/decoder route, not a separate invented decoder URL.

## Local reproduction

Run `npm run build` first, then browser suites sequentially to avoid worker/Chromium contention:

1. `npm run test:upload-layout` — installed Chrome via CDP; override its path with `GXA_BROWSER_EXECUTABLE` if necessary.
2. `npm run test:upload-lifecycle` — optional Playwright supplied via `GXA_PLAYWRIGHT_MODULE`; no production dependency is added.
3. `npm run test:tool-ui:browser`, `npm run test:edit-pdf:browser`, `npm run test:image-converter:browser`, `npm run test:gps-map-camera:browser`.

Native file-picker tests use synthetic fixtures, at 320px/390px by touch and 1366px by mouse. They cover upload, preview, reset/remove and re-upload in seven file tools plus Background Remover, with actual crop downloads. The Background Remover cancellation case deliberately holds the local model response: image decoding/preview is real, but this test does **not** assert completed segmentation or fake a successful mask. Existing engine/store contracts are separate. Google tracking/advertising requests are blocked in local browser QA only.

Physical devices, native OS file-picker presentation, mobile soft keyboards, live accounts, production services and exhaustive engine operations were not verified by this layout task.

## Validation results for this change

| Check | Final result |
|---|---|
| `npm run lint` | PASS, exit 0; also repeated by the build |
| `npm test` | PASS, exit 0; repository/engine/auth/admin/analytics/SEO contracts, core fixtures, and 10 Background Remover unit tests |
| `npm run build` | PASS, exit 0; TypeScript + Vite, generated Netlify artifact, and complete test chain |
| `git diff --check` | PASS, exit 0; existing LF/CRLF normalization warnings only |
| New upload/input layout contract | PASS: 95 routes × 13 sizes = 1,235 combinations; zero measured clipping, overlap, overflow, exposed inactive panels, or unreachable primary controls |
| New upload lifecycle suite | PASS: 8 routes × 3 sizes = 24 checks, with real crop downloads |
| Existing workspace layout contract | PASS: 95 routes; now validates root clearance + shared gap instead of a literal 96px margin, and asserts empty-canvas / hidden-state behavior |
| Existing architecture Chromium suite | PASS: all 13 sizes, 16 cross-family routes, password/hash full-output clipboard checks, Merge PDF queue/process, Compress Image results, Base64 output, and Help Center |
| Edit PDF browser regression | PASS on rerun: form/overlay edits, PDF export/reopen, touch drag, undo/redo, zoom, responsive controls, reset privacy |
| Image Converter browser regression | PASS: 16 conversions with signatures and decoder reopen; 7 mobile and 6 desktop sizes |
| GPS Map Camera browser regression | PASS on rerun: export/reopen, EXIF replace/remove, simulated geolocation/camera permission states, and 13 sizes |

The isolated PostgreSQL integration remains explicitly opt-in and was skipped by the normal test command, as configured before this task. No live database test was performed. The build retains its pre-existing classic-script Vite warning for `/assets/tool-content.js`; generated asset contracts pass.

Earlier runs encountered an Edit PDF null bounding box during touch setup, browser navigation timeouts, and Vitest fork-worker startup timeouts during concurrent browser activity. Reruns passed without increasing timeouts, disabling assertions, changing production engines, or changing test-runner limits. The old literal-offset contract was updated to assert the new shared architecture, not removed.

## Files changed for this task

- `public_html/assets/style.css` — shared header/input sizing, hidden-state semantics, natural empty crop stage.
- `background-remover-app/src/styles/global.css` — existing React header clearance and upload target sizing/scroll gap only.
- `package.json` — optional `test:upload-layout` and `test:upload-lifecycle` commands.
- `tests/tool-workspace-layout-contract.mjs` — strengthened shared layout assertions.
- `tests/upload-area-layout-contract.mjs` — new registry-wide Chromium geometry/reachability audit and screenshots.
- `tests/upload-area-lifecycle-browser.mjs` — new native-picker/touch/reset/re-upload checks.
- `tests/helpers/chrome-cdp.mjs` — reusable CDP helper extracted from the existing architecture test.
- `docs/UPLOAD_AREA_LAYOUT_AUDIT.md` — findings, methodology, results and complete matrix.

Normal build outputs were refreshed in `dist/` and `public_html/background-remover/` (generated index and hashed assets, including `index-DYc3TAxi.css` and `index-BvQWB7P1.js`). Existing unrelated working-tree changes were preserved. No processing, authentication, database, SEO, GTM/GA4, AdSense, branding, or route source logic was edited in this task.

| Tool | Route | Input type | Family | Visible | Top clipped | Bottom clipped | Horizontal clipped | Parent clips | Mobile | Laptop | Desktop | Fix | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Merge PDF | /merge-pdf/ | upload | pdf-multi-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Organize PDF | /organize-pdf/ | upload | pdf-multi-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Compress Image | /compress-image/ | upload | image-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Resize Image | /resize-image/ | upload | image-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Image Converter | /image-converter/ | upload | preview-heavy-image-converter | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| GPS Map Camera – Geotag Photo | /gps-map-camera/ | upload | gps-camera | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Crop Image | /crop-image/ | upload | preview-heavy-image-editor | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Image OCR | /image-ocr/ | upload | ocr | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Background Remover | /background-remover/ | upload | dedicated-image-editor | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Password Generator | /password-generator/ | form / generator | security-password | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| QR & Barcode | /barcode-generator/ | form / generator | generator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Color Extractor | /color-extractor/ | upload | metadata | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| ZIP Manager | /zip-manager/ | upload | archive | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Split PDF | /split-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Protect PDF | /protect-pdf/ | upload | security-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Unlock PDF | /unlock-pdf/ | upload | security-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to JPG | /pdf-to-jpg/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| JPG to PDF | /jpg-to-pdf/ | upload | pdf-multi-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Word to PDF | /word-to-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to Text/RTF | /pdf-to-word/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| EPUB to PDF | /epub-to-pdf/ | upload | file-converter | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to EPUB | /pdf-to-epub/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| GIF Maker | /gif-maker/ | upload | image-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| ZIP Extractor | /zip-extractor/ | upload | archive | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Compress PDF | /compress-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Edit PDF | /edit-pdf/ | upload | preview-heavy-pdf-editor | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Rotate PDF | /rotate-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Add Watermark | /watermark-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Add Page Numbers | /pagenumber-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF Metadata Editor | /pdf-metadata/ | upload | metadata | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Excel to PDF | /excel-to-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PPT to PDF | /ppt-to-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to Text | /pdf-to-text/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| HTML to PDF | /html-to-pdf/ | upload | file-converter | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to HTML | /pdf-to-html/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Markdown to PDF | /markdown-to-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to Markdown | /pdf-to-markdown/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| SVG to PNG | /svg-to-png/ | upload | image-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PNG to SVG | /png-to-svg/ | upload | image-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| WEBP to JPG | /webp-to-jpg/ | upload | image-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| GIF Frame Extractor | /gif-to-png/ | upload | image-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Text-to-Speech Reader | /text-to-speech/ | textarea | generator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| QR Code Reader | /qr-reader/ | upload | metadata | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Barcode Scanner | /barcode-reader/ | upload | metadata | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Base64 Tool | /base64-tool/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| URL Encoder/Decoder | /url-tool/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| JSON Formatter | /json-tool/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Hash Generator | /hash-tool/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Text Case Converter | /case-converter/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Word Counter | /word-counter/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Lorem Ipsum Generator | /lorem-ipsum/ | form / generator | generator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Diff Checker | /diff-checker/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| SQL Formatter | /sql-formatter/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| XML to JSON Converter | /xml-to-json/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| UUID Generator | /uuid-generator/ | form / generator | generator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| User Agent Parser | /user-agent/ | automatic read-only information | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Regex Tester | /regex-tester/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Markdown Editor | /markdown-editor/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| CSS Formatter | /css-beautifier/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| JS Formatter | /js-beautifier/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| HTML Formatter | /html-beautifier/ | textarea | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Cron Expression Helper | /cron-generator/ | form / generator | generator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Color Converter | /color-converter/ | form / generator | generator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| EXIF Metadata Viewer | /exif-viewer/ | upload | metadata | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Epoch Converter | /timestamp-converter/ | form / generator | developer-text | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Remove PDF Pages | /remove-pdf-pages/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Extract PDF Pages | /extract-pdf-pages/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Extract Images | /extract-images-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Crop PDF | /crop-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Add Header & Footer | /header-footer-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Sign PDF | /sign-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Repair PDF | /repair-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| OCR PDF | /ocr-pdf/ | upload | ocr | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Image to PDF | /image-to-pdf/ | upload | pdf-multi-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PNG to PDF | /png-to-pdf/ | upload | pdf-multi-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| TXT to PDF | /txt-to-pdf/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to Image | /pdf-to-image/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to PNG | /pdf-to-png/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to Excel | /pdf-to-excel/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| PDF to PPT | /pdf-to-ppt/ | upload | pdf-file | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Simple Calculator | /calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Scientific Calculator | /scientific-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Percentage Calculator | /percentage-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Age Calculator | /age-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Date Calculator | /date-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| EMI Calculator | /emi-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Loan Calculator | /loan-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Interest Calculator | /interest-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| GST Calculator | /gst-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| SIP Calculator | /sip-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| BMI Calculator | /bmi-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Discount Calculator | /discount-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Unit Converter | /unit-converter/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Currency Converter | /currency-converter/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
| Time Calculator | /time-calculator/ | calculator | calculator | Yes | No | No | No | No | PASS | PASS | PASS | Shared natural-flow input rules | PASS |
