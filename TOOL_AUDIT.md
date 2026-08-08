# GXA Toolbox Functional Audit

## Phase 1 studio integration (2026-08-03)

The production registry remains at 91 tools. Existing image and PDF routes are now grouped by shared Image Studio and PDF Studio shells without ID or route changes. The authoritative implementation remains under `public_html/`; root JavaScript and CSS remain compatibility forwarders.

Phase 1 adds generated-output signature validation, deterministic test fixtures, manual PDF crop coordinates mapped to real PDF points, visual page selection/reordering, selected-page PDF edits, image Canvas adjustments/watermarking, Crop Image undo/redo, and responsive settings drawers. Detailed route maps and limitations are documented in `docs/IMAGE_STUDIO.md` and `docs/PDF_STUDIO.md`.

Audit date: 2026-08-02

The repository contains 91 unique registered tools. Every registration was checked for a reachable generic route, configuration/dispatcher reference, processing disclosure, and simulated-success patterns. Shared upload validation was unit-tested for valid, empty, oversized, wrong-type, and duplicate files. Image upload/preview/compression was exercised end to end in the browser. Responsive overflow checks passed at 375, 768, 1024, and 1440 px.

“Dependency required” is an intentional, user-visible unavailable state. These tools retain their routes and settings but cannot run until the named engine is configured; they no longer return fabricated files.

| # | Tool | Processing | Expected result | Audit outcome |
|---:|---|---|---|---|
| 1 | Merge PDF | Local | Merged PDF | Pass — real pdf-lib output |
| 2 | Organize PDF | Local | Reordered/rotated/watermarked PDF | Pass — real pdf-lib output |
| 3 | Compress Image | Local | JPEG plus actual size comparison | Pass — browser E2E verified |
| 4 | Resize Image | Local | Image at validated dimensions | Pass — real canvas output |
| 5 | Crop Image | Local | Centered aspect-ratio crop | Pass — real canvas output |
| 6 | Background Remover | Browser-local | U2NetP ONNX soft alpha mask opened in Advanced Cutout Studio | Pass with limitations — 15-image WebGPU suite, forced WASM, 4K, mobile layout, save-job suppression, and local asset checks completed; U2NetP still needs manual refinement for hair/fur/low-contrast/product edge cases |
| 7 | Password Generator | Local | Cryptographically random password text | Pass |
| 8 | QR & Barcode | Local | Scannable QR PNG or Code 128 SVG | Pass — real encoder libraries |
| 9 | Color Extractor | Local | Palette sampled from uploaded image | Pass |
| 10 | ZIP Manager | Local | Downloadable ZIP | Pass — JSZip output |
| 11 | Split PDF | Local | ZIP of selected PDF pages | Pass — strict range validation |
| 12 | Protect PDF | Dependency required | Encrypted PDF | Blocked honestly — qpdf-compatible encryption service required |
| 13 | Unlock PDF | Dependency required | Decrypted PDF | Blocked honestly — qpdf-compatible decryption service required |
| 14 | PDF to JPG | Local | ZIP of rendered JPG/PNG pages | Pass — PDF.js rasterization |
| 15 | JPG to PDF | Local | PDF containing uploaded images | Pass — pdf-lib output |
| 16 | Word to PDF | Dependency required | Layout-preserving PDF | Blocked honestly — DOC/DOCX renderer required |
| 17 | PDF to Word | Local | Extracted TXT or valid RTF | Pass — PDF.js selectable-text extraction |
| 18 | EPUB to PDF | Dependency required | Rendered PDF | Blocked honestly — EPUB parser/renderer required |
| 19 | PDF to EPUB | Dependency required | Standards-compliant EPUB | Blocked honestly — EPUB packaging engine required |
| 20 | GIF Maker | Dependency required | Animated GIF | Blocked honestly — GIF encoder required |
| 21 | ZIP Extractor | Local | Real archive listing and per-file downloads | Pass — JSZip extraction |
| 22 | Compress PDF | Local | Smaller reserialized PDF or honest no-savings error | Pass |
| 23 | Rotate PDF | Local | Rotated PDF pages | Pass |
| 24 | Add Watermark | Local | Watermarked PDF | Pass |
| 25 | Add Page Numbers | Local | Numbered PDF | Pass |
| 26 | PDF Metadata Editor | Local | PDF with updated metadata | Pass |
| 27 | Excel to PDF | Dependency required | Rendered workbook PDF | Blocked honestly — spreadsheet renderer required |
| 28 | PPT to PDF | Dependency required | Rendered presentation PDF | Blocked honestly — presentation renderer required |
| 29 | PDF to Text | Local | Extracted TXT | Pass — PDF.js text extraction |
| 30 | HTML to PDF | Local | Basic text-rendered PDF | Pass — real PDF, scope disclosed by UI |
| 31 | PDF to HTML | Local | HTML containing extracted page text | Pass |
| 32 | Markdown to PDF | Local | Basic formatted PDF | Pass |
| 33 | PDF to Markdown | Local | Markdown containing extracted page text | Pass |
| 34 | SVG to PNG | Local | Rasterized PNG | Pass |
| 35 | PNG to SVG | Local | SVG wrapper containing the raster image | Pass — description accurately states wrapping |
| 36 | WEBP to JPG | Local | Decoded/re-encoded JPG or PNG | Pass |
| 37 | GIF Frame Extractor | Dependency required | ZIP of decoded animation frames | Blocked honestly — complete GIF decoder required |
| 38 | Text-to-Speech Reader | Local capability | Browser speech playback | Pass — no fake audio download |
| 39 | QR Code Reader | Browser capability | Decoded QR payload | Pass contract — BarcodeDetector support checked |
| 40 | Barcode Scanner | Browser capability | Decoded supported barcode payload | Pass contract — BarcodeDetector support checked |
| 41 | Base64 Tool | Local | Unicode-safe encode/decode result | Pass |
| 42 | URL Encoder/Decoder | Local | Encoded or decoded URL text | Pass |
| 43 | JSON Formatter | Local | Parsed pretty/minified JSON or validation error | Pass |
| 44 | Hash Generator | Local | SHA-1/256/384/512 digest | Pass — Web Crypto; fake MD5 removed |
| 45 | Text Case Converter | Local | Converted text | Pass |
| 46 | Word Counter | Local | Counts and reading estimate | Pass |
| 47 | Lorem Ipsum Generator | Local | Requested placeholder paragraphs | Pass |
| 48 | Text Difference Checker | Local | Difference result | Pass |
| 49 | SQL Formatter | Local | Formatted SQL text | Pass |
| 50 | XML to JSON | Local | Parsed JSON or XML error | Pass |
| 51 | UUID Generator | Local | UUID values | Pass |
| 52 | User Agent Parser | Local | Current browser details | Pass |
| 53 | Regex Tester | Local | Actual regex matches/errors | Pass |
| 54 | Markdown Editor | Local | Markdown editing preview/export | Pass |
| 55 | CSS Beautifier | Local | Formatted CSS text | Pass |
| 56 | JS Beautifier | Local | Formatted JavaScript text | Pass |
| 57 | HTML Beautifier | Local | Formatted HTML text | Pass |
| 58 | Cron Generator | Local | Cron expression | Pass |
| 59 | Color Converter | Local | HEX/RGB/HSL/CMYK conversion | Pass |
| 60 | EXIF Viewer | Local | Actual present EXIF fields and image dimensions | Pass — exifr parser; invented camera/GPS removed |
| 61 | Epoch Converter | Local | Epoch/date conversion | Pass |
| 62 | Remove PDF Pages | Local | PDF without selected pages | Pass — invalid/all-pages selections rejected |
| 63 | Extract PDF Pages | Local | PDF containing selected pages | Pass — strict range validation |
| 64 | Extract Images from PDF | Dependency required | ZIP of embedded images | Blocked honestly — PDF object-image extractor required |
| 65 | Crop PDF | Local | PDF with validated crop boxes | Pass |
| 66 | Add Header & Footer | Local | PDF with header/footer text | Pass |
| 67 | Sign PDF | Local | Visible signature appearance | Pass — explicitly not cryptographic signing |
| 68 | Repair PDF | Local | Normalized readable PDF | Pass — no claim to recover unreadable files |
| 69 | OCR PDF | Dependency required | Searchable OCR PDF | Blocked honestly — OCR model/service required |
| 70 | Image to PDF | Local | PDF containing uploaded images | Pass |
| 71 | PNG to PDF | Local | PDF containing PNG images | Pass |
| 72 | TXT to PDF | Local | PDF containing plain text | Pass |
| 73 | PDF to Image | Local | ZIP of rendered page images | Pass — PDF.js rasterization |
| 74 | PDF to PNG | Local | ZIP of rendered PNG pages | Pass — PDF.js rasterization |
| 75 | PDF to Excel | Dependency required | Extracted workbook/table data | Blocked honestly — table-recognition engine required |
| 76 | PDF to PPT | Dependency required | Editable presentation | Blocked honestly — presentation generator required |
| 77 | Calculator | Local | Arithmetic result | Pass |
| 78 | Scientific Calculator | Local | Scientific expression result | Pass |
| 79 | Percentage Calculator | Local | Percentage result | Pass |
| 80 | Age Calculator | Local | Calendar age result | Pass |
| 81 | Date Calculator | Local | Date addition/difference result | Pass |
| 82 | EMI Calculator | Local | EMI and totals | Pass |
| 83 | Loan Calculator | Local | Loan payment analysis | Pass |
| 84 | Interest Calculator | Local | Simple/compound interest result | Pass |
| 85 | GST Calculator | Local | Tax/net/gross result | Pass |
| 86 | SIP Calculator | Local | Estimated investment result | Pass |
| 87 | BMI Calculator | Local | BMI and category | Pass |
| 88 | Discount Calculator | Local | Discount and final price | Pass |
| 89 | Unit Converter | Local | Converted measurement | Pass |
| 90 | Currency Converter | Local | Amount using user-supplied rate | Pass — no simulated/live-rate claim |
| 91 | Time Calculator | Local | Added/subtracted duration | Pass |

## Automated verification

- `npm run lint`: JavaScript syntax checks.
- `npm test`: 91-tool registry/route contract, uniqueness, dependency mapping, shared-workspace presence, input-validation cases, simulated-success signatures, entry-point wiring, and old-brand audit.
- `npm run build`: release validation (lint plus tests) for this unbundled PHP/static application.
- PHP CLI syntax check: passed for `public_html/index.php` and `public_html/api/background-remover.php` using the local PHP runtime.
- Type checking: not applicable; this repository contains no TypeScript project or type-check configuration.

## Background Remover final QA (2026-08-08)

See `BACKGROUND_REMOVER_FINAL_QA.md` for the full final QA record. Summary:

- Required 15 categories tested: 7 fully verified, 8 verified with U2NetP quality limitations, 0 failed.
- WebGPU verified across the 15-image suite.
- WASM verified in Browser compatibility mode.
- Exact-resolution masks verified through 3840x2160 and 2160x3840.
- Mobile viewport layout verified at 430x932, 390x844, 375x667, and 320x568; physical touch/pinch remains untested.
- Brush/crop transform mapping covered by automated tests.
- Required Background Remover model/runtime assets served HTTP 200.
- Logged-out `/api/save-job.php` persistence is suppressed for Background Remover / Advanced Cutout Studio.
# Background Remover route update (2026-08-08)

Background Remover is now an isolated React + TypeScript + Vite application at `/background-remover/`. Legacy toolbox navigation hard-navigates to that path. No other tool registration, route, processing branch, authentication flow, dashboard page, or API was moved.
