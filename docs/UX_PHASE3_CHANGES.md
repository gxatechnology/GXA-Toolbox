# Phase 3 — public tool UX

## Scope

Build on `ADSENSE_AUDIT.md` and `ADSENSE_PHASE2_CHANGES.md`. Preserve the existing design system, 95 routes, 81/14 publication policy, real processors, authentication/database, GTM/AdSense configuration and Background Remover React app. No deployment, push or commit.

## Reusable components and behavior

`public_html/assets/tool-ux.js` is a small presentation controller, not another file-processing system. It observes the main route mount and coalesces updates to one animation frame. Accepted file state comes from the existing shared queue, decoded Crop Image controls or the converter's decoded-original state. Settings, inactive editor controls and session panels are hidden with the semantic `hidden` attribute until usable. Reset returns to upload-first. Text/generator controls and HTML-to-PDF's alternate typed input are deliberately excluded.

The shared uploader now provides a real Select file/files button with keyboard activation. Existing file inputs, accept rules, limits, validation, paste/drop behavior and processors are unchanged. Shared processing actions follow settings, and mobile flow places results after settings. File queue flex/grid minimum widths are constrained at the component level; no body-wide overflow hiding was added.

Crop Image hides its inactive toolbar/settings before selection and places exact pixel position/size in an accessible details disclosure. Aspect ratio, format, appropriate quality controls, touch editor, processing and download remain. Image Converter's error/status region stays outside the hidden settings, so a rejected file can still be explained. Supported types and its actual 50 MB upper bound appear at upload; codec-specific limits still apply.

## Content and privacy

- Keep the official brand/tagline. Replace the prominent "powerful browser-based" supporting sentence with plain descriptions of tasks.
- Remove "Clear processing details", "Clear processing modes", "Precision controls", and the mockup's "Local processing" label.
- Use "Crop settings" and plain Select image/file controls.
- Runtime and generated static guides start with How to Use, followed by existing practical content. No long content, fake guides, FAQs or statistics were generated.
- The longer duplicate pre-workspace intro is hidden in migrated interactive pages; its content remains in the guide and in no-JS HTML.
- Shared file-workspace privacy explains device-local file processing and the separate saving of filenames/operation details to signed-in history, with a real Privacy link. Common tool privacy descriptions now distinguish file bytes from account metadata.
- Existing specialized privacy disclosures (including location/network details and React Background Remover) remain unchanged. No new retention/security guarantees are made.

## Navigation

Anonymous desktop navigation offers Convert instead of a prominent Dashboard link. Signed-in users retain Dashboard; account/menu sign-in and sign-up functionality is intact. No authentication logic changed. Existing PDF/Image/Calculators menus and mobile menu behavior are retained rather than rebuilt.

## Ad framework

The optional helper is eligibility-gated and supports named, empty, hidden zones outside interaction areas. The shared page has after-tool and after-guide candidates; dedicated editors retain the after-guide candidate. No real manual ad unit is configured. See `ADSENSE_LAYOUT_PLAN.md` for limitations and forbidden zones.

## Phase 3 files

- New `public_html/assets/tool-ux.js`
- `public_html/assets/app.js`, `style.css`, `tool-content.js`, `image-converter.js`
- `index.html`, `public_html/index.php`
- `scripts/generate-seo-site.mjs` (static guide order)
- `package.json` (contract/browser commands)
- New `tests/ux-phase3-contract.mjs`, `tests/ux-phase3-browser.mjs`
- `tests/adsense-phase2-browser.mjs`: allow 60 seconds for direct-page navigation while preserving 20-second interaction checks and every assertion; a parallel run hit an external-resource navigation timeout.
- This report and `docs/ADSENSE_LAYOUT_PLAN.md`
- Normal generated SEO/content reports, build snapshots and ignored production assets regenerate through the existing build. Pre-existing Phase 2/GPS/admin changes are not new Phase 3 work.

## Coverage and deferred work

Representative real-file flows: Crop Image, Resize Image, Compress Image, Image Converter, JPG to PDF, Images to PDF, Merge PDF, PDF to JPG and Image OCR. Test files are local fixtures, not production/demo account records. Tests activate the real picker by keyboard, select files, run the existing engines, download outputs, and reset.

Responsive checks cover 320, 360, 375, 390, 412, 430, 768 and 1440px before upload, plus selected-state mobile overflow. Browser inventory checks disclosure and collapsed ad containers across applicable routes; Background Remover retains its independent architecture. Tests also read generated Crop Image content with JavaScript disabled.

Remaining layouts intentionally include generators/calculators (no upload step), hybrid typed/file HTML-to-PDF, dedicated Edit PDF, GPS Map Camera and React Background Remover. These retain their working UX; they are not claimed as newly migrated or end-to-end retested in this phase.

Phase 4 remains responsible for substantive route-specific editorial rewriting and shortening repetitive legacy copy, specialized-editor UX review, broader real-device testing, live Auto Ads review, and native BarcodeDetector device verification. No blocker requires changing authentication or the database. Passing local checks does not guarantee AdSense approval.

## Verified migration inventory

53 upload-first routes, verified by the browser inventory:

`merge-pdf`, `organize-pdf`, `compress-image`, `resize-image`, `image-converter`, `crop-image`, `image-ocr`, `color-extractor`, `zip-manager`, `split-pdf`, `protect-pdf`, `unlock-pdf`, `pdf-to-jpg`, `jpg-to-pdf`, `word-to-pdf`, `pdf-to-word`, `epub-to-pdf`, `pdf-to-epub`, `gif-maker`, `zip-extractor`, `compress-pdf`, `rotate-pdf`, `watermark-pdf`, `pagenumber-pdf`, `pdf-metadata`, `excel-to-pdf`, `ppt-to-pdf`, `pdf-to-text`, `pdf-to-html`, `markdown-to-pdf`, `pdf-to-markdown`, `svg-to-png`, `png-to-svg`, `webp-to-jpg`, `gif-to-png`, `qr-reader`, `barcode-reader`, `exif-viewer`, `remove-pdf-pages`, `extract-pdf-pages`, `extract-images-pdf`, `crop-pdf`, `header-footer-pdf`, `sign-pdf`, `repair-pdf`, `ocr-pdf`, `image-to-pdf`, `png-to-pdf`, `txt-to-pdf`, `pdf-to-image`, `pdf-to-png`, `pdf-to-excel`, `pdf-to-ppt`.

The other 42 retain their existing interaction architecture: 38 generators/text tools/calculators, plus Edit PDF, GPS Map Camera, Background Remover and hybrid HTML-to-PDF. No tools are removed or newly approved for indexing. The nine representative flows have real processing/download coverage; the other migrated routes have presentation/inventory coverage, not a new per-format processing certification.

## Final validation — 2026-10-02

- `npm run build`: PASS, exit 0, including `npm run lint`, the Background Remover TypeScript/Vite build, `npm test`, pretest and posttest.
- `npm run test:ux-phase3:browser`: PASS, exit 0. Nine real flows; invalid-file checks for crop/resize/converter; keyboard picker; upload and selected-state overflow checks at 320/360/375/390/412/430/768/1440px; 95-entry route inventory (React Background Remover intentionally excluded from this UI sweep); empty ad-zone checks; no-JS guide readability; no unexpected browser runtime errors.
- `node --check tests/ux-phase3-browser.mjs` and `node --check public_html/assets/tool-ux.js`: PASS.
- `npm run test:phase2:browser`: PASS, exit 0 when rerun serially. The 14 review routes remain noindex/ad-free; HTML export/error, QR/Code128 fallback decoding, ad-state/navigation and homepage width checks passed. Native BarcodeDetector remains unavailable in this Chrome installation (covered by controlled API tests, not a real native-device run).
- `git diff --check`: PASS, exit 0; existing LF/CRLF normalization warnings are not whitespace errors.
- Existing isolated PostgreSQL integration remains deliberately skipped unless explicitly enabled; no production credentials or accounts were used. The existing non-fatal Vite classic-script warning remains.

Evidence is in `test-results/ux-phase3/results.json`, nine post-reset mobile screenshots and nine downloaded fixture outputs. These are local test artifacts, not public website/demo data. Production services, real-device keyboards, live Auto Ads and live authentication were not exercised. No commit, push or deployment was performed.
