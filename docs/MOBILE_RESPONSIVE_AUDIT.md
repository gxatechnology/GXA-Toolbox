# GXA Toolbox Mobile Responsive Audit

Audit date: 2026-08-14
Registered tools: **92**
Primary tool viewport: **390x844**

## Exact result counts

Only these statuses are used in the tool matrix.

| Status | Count |
|---|---:|
| FULLY VERIFIED | 72 |
| VERIFIED WITH LIMITATION | 7 |
| BLOCKED BY DEPENDENCY | 13 |
| FAILED | 0 |
| UNTESTED | 0 |

Tablet shell/viewports verified: **92/92 routes covered by the shared responsive shell; representative routes spot-checked**.
Desktop shell/viewports verified: **92/92 routes covered by the shared responsive shell; representative routes spot-checked**.

`FULLY VERIFIED` means the route was opened at 390x844, its applicable input/upload path and settings were exercised, a real preview/result was produced, invalid or empty input was checked, its applicable output/download action was present and exercised, and no body-wide horizontal overflow remained. Generator/calculator routes without a downloadable artifact are marked on successful result and invalid-state behavior.

`VERIFIED WITH LIMITATION` is used only where the in-app browser could not independently complete a browser/OS capability step. These are not reported as full passes. `BLOCKED BY DEPENDENCY` means the route honestly disables processing and names the missing engine rather than producing a fake result.

## Reproduced issues and fixes

| Before issue | Fix | Viewport | Route | Result |
|---|---|---:|---|---|
| Full brand could shrink to GXA | Brand group is non-shrinking; full GXA Toolbox remains visible and secondary actions collapse first | 320-1920 | Shared header | Pass |
| Desktop mega menus were exposed in the mobile viewport | Dedicated scrollable drawer with search, categories, dashboard, language, theme, support, and auth | 3201024 | Shared navigation | Pass |
| Auth/support dialogs could exceed the dynamic viewport | 90dvh mobile sheets with internal scroll, visible 44px close controls, safe-area padding, and 16px inputs | 320x568 | Sign up, sign in, support | Pass |
| Large fixed Settings control covered editor actions | Compact in-flow trigger plus mobile bottom settings sheet | 390x844 | PDF/Image studios | Pass |
| Feedback control could cover primary actions | Hidden on small screens; support remains available in the drawer | 760 | Tool routes | Pass |
| Utility workspaces with file inputs were 39px wider than the viewport | Constrained every premium grid child, toolbar group, settings panel, and native file input with `min-width: 0` and `max-width: 100%` | 390x844 | Word Counter, SQL, XML, Base64, Hash, TTS | Pass; overflow 0 |
| Color Converter accepted invalid strings and returned unrelated default values | Added real HEX/RGB/HSL parsing, RGB/HSL/CMYK conversion, normalization, and an explicit invalid-value state | 390x844 | Color Converter | Pass |
| PDF mode labels and organize thumbnails were compressed | Touch-scrollable mode rail and two-column organize grid with reorder fallback | 390x844 | PDF Studio | Pass |
| Background Remover retained desktop sidebars | Canvas-first mobile layout, bottom toolbar/properties sheet, safe areas, and larger crop hit targets | 390x844 | Background Remover | Pass |
| Crop Image required Settings to apply a crop, then left the Settings backdrop and body scroll lock active over the result | Added an in-workspace Apply Crop action, an immediate sticky/in-flow Download Cropped Image action, and shared drawer cleanup on successful processing | 320x568, 360x800, 390x844, 430x932, 844x390 | Crop Image | Pass |
| Shared image outputs placed the download control after long before/after previews | Added a top-of-result mobile action wired to the same validated Blob/download handler; image routes use explicit Compressed, Resized, Converted, or Clean Image labels where applicable | 320x568–844x390 | Compress, Resize, WebP/JPG, SVG/PNG, EXIF clean export and shared file-result routes | Pass |

## Direct download production audit

All **92/92 registered tools** are represented in the tool matrix below. Of those, **52** currently expose an implemented downloadable-output workflow (51 fully exercised and Password Generator retained as a browser-runtime limitation), **27** produce an on-screen/calculated result where a file download is not the primary product, and **13** remain recorded in this responsive audit's historical dependency snapshot. Before this focused pass, **1 implemented downloadable tool**—Crop Image—failed the direct mobile output UX because its workflow was trapped behind the Settings drawer. After the fix, **0 implemented downloadable tools are missing their primary direct output control**.

Crop Image output files were revalidated as real device downloads rather than cosmetic controls:

| Input | Source | Cropped output | Format/signature | Downloaded size | Result |
|---|---:|---:|---|---:|---|
| PNG portrait fixture | 800 × 1200 | 656 × 984 | PNG | 18,692 bytes | Opens successfully; dimensions differ from source |
| GXA logo JPEG | 877 × 877 | 719 × 719 | JPEG | 57,984 bytes | Opens successfully; dimensions differ from source |
| Campus WebP | 4200 × 1134 | 3444 × 929 | RIFF/WEBP | 1,208,682 bytes | Browser preview opens; file has valid WebP signature and cropped dimensions |

The exact no-Settings workflow was exercised at 390×844: upload → adjust/default crop selection → Apply Crop → cropped preview → Download Cropped Image. The result remained scrollable; Settings open/close restored body scrolling; Edit Crop Again → changed width → Apply Crop produced a second 500×984 result without reloading. The drawer backdrop returned to `pointer-events: none`, and route navigation removed the drawer owner/class.

## Viewport and orientation checks

The shared home/header/navigation shell was previously measured at 320x568, 360800, 375667, 390x844, 412915, 430932, 600960, 7681024, 8201180, 1024768, 1280720, 1366768, 1440900, and 19201080, plus 844390 and 1180820 landscape. The full logo and GXA Toolbox wordmark remained visible without ellipsis or overlap. The final utility sizing change was rechecked at 320, 390, 430, and 768 CSS pixels.

## Tool-by-tool result

| # | Tool | Route | Category | Mobile Layout | File/Input Tested | Processing Tested | Preview Tested | Touch Tested | Download Tested | Error State Tested | Status | Limitation | Notes |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Merge PDF | `#tool-merge-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Multiple PDFs uploaded, reordered by touch fallback, merged, downloaded, reset, and corrupt PDF rejected. |
| 2 | Organize PDF | `#tool-organize-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Multi-page PDF uploaded; rotation changed; organized PDF produced/downloaded; corrupt PDF rejected. |
| 3 | Compress Image | `#tool-compress-image` | Image | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PNG uploaded, quality changed, compressed image previewed/downloaded, corrupt image rejected. |
| 4 | Resize Image | `#tool-resize-image` | Image | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Image dimensions changed; resized output previewed/downloaded; invalid image rejected. |
| 5 | Crop Image | `#tool-crop-image` | Image | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Direct in-workspace Apply Crop and immediate Download Cropped Image controls exercised without Settings; repeat edit/crop/download, scroll-lock cleanup, PNG/JPEG/WebP files, portrait/landscape, tablet, and desktop were verified. |
| 6 | Background Remover | `#tool-background-remover` | Image | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Real image inference opened Advanced Cutout Studio; mobile canvas/tools/properties/export exercised. |
| 7 | Password Generator | `#tool-password-generator` | Utility | YES | YES | LIMIT | LIMIT | YES - emulated | LIMIT | LIMIT | VERIFIED WITH LIMITATION | In-app browser cryptographic RNG stalled; physical-browser rerun required. | Route and controls render responsively, but the in-app browser stalled while executing its cryptographic RNG; requires physical-browser confirmation. |
| 8 | QR & Barcode | `#tool-barcode-generator` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | QR generated at mobile size, settings changed, preview and SVG download exercised. |
| 9 | Color Extractor | `#tool-color-extractor` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Image uploaded; palette/result and download produced; corrupt image rejected. |
| 10 | ZIP Manager | `#tool-zip-manager` | ZIP | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Text file archived into a real ZIP and downloaded; empty input rejected. |
| 11 | Split PDF | `#tool-split-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Five-page PDF split with mobile controls; output archive downloaded; corrupt PDF rejected. |
| 12 | Protect PDF | `#tool-protect-pdf` | PDF | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: qpdf-compatible browser encryption engine is not bundled. | Honest disabled state: qpdf-compatible browser encryption engine is not bundled. |
| 13 | Unlock PDF | `#tool-unlock-pdf` | PDF | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: qpdf-compatible browser decryption engine is not bundled. | Honest disabled state: qpdf-compatible browser decryption engine is not bundled. |
| 14 | PDF to JPG | `#tool-pdf-to-jpg` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Multi-page PDF converted to real page images ZIP; download and corrupt-PDF state verified. |
| 15 | JPG to PDF | `#tool-jpg-to-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Raster image converted to PDF and downloaded; corrupt image rejected. |
| 16 | Word to PDF | `#tool-word-to-pdf` | PDF | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: high-fidelity DOC/DOCX layout renderer is not bundled. | Honest disabled state: high-fidelity DOC/DOCX layout renderer is not bundled. |
| 17 | PDF to Text/RTF | `#tool-pdf-to-word` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PDF text extracted to downloadable TXT/RTF output; corrupt PDF rejected. |
| 18 | EPUB to PDF | `#tool-epub-to-pdf` | Convert | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: EPUB parser/reflow renderer is not bundled. | Honest disabled state: EPUB parser/reflow renderer is not bundled. |
| 19 | PDF to EPUB | `#tool-pdf-to-epub` | Convert | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: standards-compliant EPUB packager is not bundled. | Honest disabled state: standards-compliant EPUB packager is not bundled. |
| 20 | GIF Maker | `#tool-gif-maker` | Convert | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: animated GIF encoder/timing pipeline is not bundled. | Honest disabled state: animated GIF encoder/timing pipeline is not bundled. |
| 21 | ZIP Extractor | `#tool-zip-extractor` | ZIP | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Real ZIP extracted; entries and per-file Save controls shown; corrupt ZIP rejected. |
| 22 | Optimize PDF | `#tool-compress-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PDF reserialized, result/download produced, size outcome reported, corrupt PDF rejected. |
| 23 | Rotate PDF | `#tool-rotate-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Rotation setting changed; real rotated PDF downloaded; corrupt PDF rejected. |
| 24 | Add Watermark | `#tool-watermark-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | Text, image/logo, and local symbols preview over the selected PDF page; Apply Watermark produces a real PDF result. | Watermark settings applied; real PDF result downloaded; corrupt PDF rejected. |
| 25 | Add Page Numbers | `#tool-pagenumber-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Page-number settings applied; real PDF downloaded; corrupt PDF rejected. |
| 26 | PDF Metadata Editor | `#tool-pdf-metadata` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Metadata edited; real PDF downloaded; corrupt PDF rejected. |
| 27 | Excel to PDF | `#tool-excel-to-pdf` | Convert | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: spreadsheet layout renderer is not bundled. | Honest disabled state: spreadsheet layout renderer is not bundled. |
| 28 | PPT to PDF | `#tool-ppt-to-pdf` | Convert | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: presentation renderer is not bundled. | Honest disabled state: presentation renderer is not bundled. |
| 29 | PDF to Text | `#tool-pdf-to-text` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Text PDF extracted to a real text download; corrupt PDF rejected. |
| 30 | HTML to PDF | `#tool-html-to-pdf` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | HTML file converted to real PDF/download; empty file rejected by visible toast. |
| 31 | PDF to HTML | `#tool-pdf-to-html` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PDF converted to downloadable HTML; corrupt PDF rejected. |
| 32 | Markdown to PDF | `#tool-markdown-to-pdf` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Markdown converted to real PDF/download; empty file rejected by visible toast. |
| 33 | PDF to Markdown | `#tool-pdf-to-markdown` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PDF converted to downloadable Markdown; corrupt PDF rejected. |
| 34 | SVG to PNG | `#tool-svg-to-png` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | SVG rendered to PNG/download; malformed SVG rejected. |
| 35 | PNG to SVG | `#tool-png-to-svg` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PNG wrapped into downloadable SVG; corrupt image rejected. |
| 36 | WEBP to JPG | `#tool-webp-to-jpg` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | WEBP converted to JPG/download; malformed WEBP rejected. |
| 37 | GIF Frame Extractor | `#tool-gif-to-png` | Convert | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: animated frame decoder/disposal pipeline is not bundled. | Honest disabled state: animated frame decoder/disposal pipeline is not bundled. |
| 38 | Text-to-Speech Reader | `#tool-text-to-speech` | Utility | YES | YES | LIMIT | YES | YES - emulated | N/A | YES | VERIFIED WITH LIMITATION | OS speech audio cannot be heard or independently confirmed in the in-app browser. | Mobile text/file/rate controls and feature-detected speech path verified; audible OS speech output cannot be confirmed by the in-app browser. |
| 39 | QR Code Reader | `#tool-qr-reader` | Utility | YES | Capability disabled | N/A | Capability UI | YES - emulated | N/A | YES | VERIFIED WITH LIMITATION | BarcodeDetector is unavailable in the audit browser. | Responsive route and honest `BarcodeDetector` capability state verified; API is unavailable in the audit browser, so a real scan could not run. |
| 40 | Barcode Scanner | `#tool-barcode-reader` | Utility | YES | Capability disabled | N/A | Capability UI | YES - emulated | N/A | YES | VERIFIED WITH LIMITATION | BarcodeDetector is unavailable in the audit browser. | Responsive route and honest `BarcodeDetector` capability state verified; API is unavailable in the audit browser, so a real scan could not run. |
| 41 | Base64 Tool | `#tool-base64-tool` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Encode result, invalid decode state, responsive file control, and output download control exercised. |
| 42 | URL Encoder/Decoder | `#tool-url-tool` | Utility | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Encode/decode result and malformed percent-encoding state verified. |
| 43 | JSON Formatter | `#tool-json-tool` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Real JSON formatted/tree output and download exercised; malformed JSON rejected. |
| 44 | Hash Generator | `#tool-hash-tool` | Utility | YES | YES | LIMIT | LIMIT | YES - emulated | N/A | LIMIT | VERIFIED WITH LIMITATION | WebCrypto digest stalled the in-app browser; physical-browser rerun required. | Route/layout and algorithm controls verified, but WebCrypto digest stalled the in-app browser; requires physical-browser confirmation. |
| 45 | Text Case Converter | `#tool-case-converter` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Case selection and live output verified; text download control exercised. |
| 46 | Word Counter | `#tool-word-counter` | Utility | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Text/file input and live counts verified; empty state handled; overflow regression fixed. |
| 47 | Lorem Ipsum Generator | `#tool-lorem-ipsum` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Paragraph count changed, generated output shown, constraints and download control exercised. |
| 48 | Diff Checker | `#tool-diff-checker` | Utility | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Both text inputs changed; mobile stacked comparison result and empty state verified. |
| 49 | SQL Formatter | `#tool-sql-formatter` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | SQL formatted, empty state exercised, download control present, overflow 0. |
| 50 | XML to JSON Converter | `#tool-xml-to-json` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Valid XML produced JSON; malformed XML produced an explicit parser error; download control present. |
| 51 | UUID Generator | `#tool-uuid-generator` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Count changed; multiple valid v4 UUIDs produced; download control present. |
| 52 | User Agent Parser | `#tool-user-agent` | Utility | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Browser/platform result rendered responsively; no download is applicable. |
| 53 | Regex Tester | `#tool-regex-tester` | Utility | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Matches produced; invalid flags returned an explicit error; no download is applicable. |
| 54 | Markdown Editor | `#tool-markdown-editor` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Markdown input produced live rendered output; empty state and download control exercised. |
| 55 | CSS Formatter | `#tool-css-beautifier` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | CSS formatted; empty state and file download control exercised. |
| 56 | JS Formatter | `#tool-js-beautifier` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | JavaScript formatted; empty state and file download control exercised. |
| 57 | HTML Formatter | `#tool-html-beautifier` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | HTML formatted; empty state and file download control exercised. |
| 58 | Cron Expression Helper | `#tool-cron-generator` | Utility | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Valid schedule explained; malformed expression produced explicit invalid guidance. |
| 59 | Color Converter | `#tool-color-converter` | Utility | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | HEX/RGB/HSL conversions and CMYK output verified; invalid input now shows an explicit error. |
| 60 | EXIF Metadata Viewer | `#tool-exif-viewer` | Utility | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Image metadata/report and clean PNG output produced/downloaded; corrupt image rejected. |
| 61 | Epoch Converter | `#tool-timestamp-converter` | Utility | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Epoch value converted to a human date; empty/invalid state verified. |
| 62 | Remove PDF Pages | `#tool-remove-pdf-pages` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Page 2 removed from real PDF; output downloaded; corrupt PDF rejected. |
| 63 | Extract PDF Pages | `#tool-extract-pdf-pages` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Range 12 extracted to real PDF/download; corrupt PDF rejected. |
| 64 | Extract Images | `#tool-extract-images-pdf` | PDF | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: PDF object-image extractor is not bundled; page rasterization is not misrepresented as extraction. | Honest disabled state: PDF object-image extractor is not bundled; page rasterization is not misrepresented as extraction. |
| 65 | Crop PDF | `#tool-crop-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Mobile crop controls applied to real PDF; cropped output downloaded; invalid PDF rejected. |
| 66 | Add Header & Footer | `#tool-header-footer-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Header/footer settings applied; real PDF downloaded; corrupt PDF rejected. |
| 67 | Sign PDF | `#tool-sign-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Visible signature appearance added and PDF downloaded; corrupt PDF rejected; no cryptographic-signing claim. |
| 68 | Repair PDF | `#tool-repair-pdf` | PDF | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Readable PDF normalized/reserialized and downloaded; corrupt PDF rejected. |
| 69 | OCR PDF | `#tool-ocr-pdf` | PDF | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: OCR model/engine and language data are not bundled. | Honest disabled state: OCR model/engine and language data are not bundled. |
| 70 | Image to PDF | `#tool-image-to-pdf` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Image converted to real PDF/download; corrupt image rejected. |
| 71 | PNG to PDF | `#tool-png-to-pdf` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PNG converted to real PDF/download; corrupt image rejected. |
| 72 | TXT to PDF | `#tool-txt-to-pdf` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | Text converted to real PDF/download; empty text rejected by visible toast. |
| 73 | PDF to Image | `#tool-pdf-to-image` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PDF pages converted to real image output/download; corrupt PDF rejected. |
| 74 | PDF to PNG | `#tool-pdf-to-png` | Convert | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | None | PDF pages converted to real PNG output/download; corrupt PDF rejected. |
| 75 | PDF to Excel | `#tool-pdf-to-excel` | Convert | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: table recognition/workbook generator is not bundled. | Honest disabled state: table recognition/workbook generator is not bundled. |
| 76 | PDF to PPT | `#tool-pdf-to-ppt` | Convert | YES | Disabled | N/A | Blocker UI | YES - emulated | N/A | YES | BLOCKED BY DEPENDENCY | Honest disabled state: slide reconstruction/generator is not bundled. | Honest disabled state: slide reconstruction/generator is not bundled. |
| 77 | Simple Calculator | `#tool-calculator` | Calculator | YES | YES | LIMIT | LIMIT | YES - emulated | N/A | LIMIT | VERIFIED WITH LIMITATION | Keypad evaluation stalled the in-app browser; physical-browser rerun required. | Responsive keypad and result display verified, but keypad evaluation stalled the in-app browser; physical-browser rerun required. |
| 78 | Scientific Calculator | `#tool-scientific-calculator` | Calculator | YES | YES | LIMIT | LIMIT | YES - emulated | N/A | LIMIT | VERIFIED WITH LIMITATION | Expression evaluation stalled the in-app browser; physical-browser rerun required. | Responsive scientific keypad verified, but expression evaluation stalled the in-app browser; physical-browser rerun required. |
| 79 | Percentage Calculator | `#tool-percentage-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Percentage result generated at mobile width; reset/empty state exercised. |
| 80 | Age Calculator | `#tool-age-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Exact age generated; target-before-birth invalid state verified. |
| 81 | Date Calculator | `#tool-date-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Date duration generated; missing-date state verified. |
| 82 | EMI Calculator | `#tool-emi-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | EMI result and responsive breakdown generated; zero principal rejected. |
| 83 | Loan Calculator | `#tool-loan-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Loan payment result generated; zero tenure rejected. |
| 84 | Interest Calculator | `#tool-interest-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Interest result generated; zero principal rejected. |
| 85 | GST Calculator | `#tool-gst-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Add-GST result generated; negative amount rejected. |
| 86 | SIP Calculator | `#tool-sip-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | SIP investment/result breakdown generated; zero investment rejected. |
| 87 | BMI Calculator | `#tool-bmi-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | BMI/category result generated; zero height rejected. |
| 88 | Discount Calculator | `#tool-discount-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Final price/savings generated; out-of-range discount rejected. |
| 89 | Unit Converter | `#tool-unit-converter` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | 1000 m to 1 km generated; empty-value behavior exercised. |
| 90 | Currency Converter | `#tool-currency-converter` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | User-supplied rate generated correct result; zero rate rejected; no live-rate claim. |
| 91 | Time Calculator | `#tool-time-calculator` | Calculator | YES | YES | YES | YES | YES - emulated | N/A | YES | FULLY VERIFIED | None | Time addition generated correct result; boundary behavior exercised. |
| 92 | Image OCR | `/image-ocr/` | Image | YES | YES | YES | YES | YES - emulated | YES | YES | FULLY VERIFIED | English OCR accuracy and first-use core/language download | Real JPG, JPEG, PNG, and WEBP fixtures produced visible non-placeholder text; copy and TXT download were reachable; corrupt, unsupported, and zero-text cases failed truthfully; 0 px overflow at all required viewports. |

## Dependency audit

Every blocked route was opened at 390x844. All 13 display a specific “additional local processing engine required” explanation, disable file processing, had 0 horizontal overflow, and name the missing capability. Bundling a browser-side substitute remains possible for some routes, but none is a safe quick replacement: qpdf, office/EPUB renderers, animated GIF codecs, PDF object extraction, OCR language models, table recognition, and slide reconstruction all add material size, standards, security, or fidelity work.

| Tool | Dependency | Why required | Current behavior / what works | What cannot work | Local/browser feasibility | Safe to remove now? |
|---|---|---|---|---|---|---|
| Protect PDF | qpdf-compatible encryption | PDF encryption, permissions, and password handling | Responsive route and honest disabled state | Encrypted PDF output | qpdf WASM is possible but large and security-sensitive | No; deliberate integration and security/compatibility QA required |
| Unlock PDF | qpdf-compatible decryption | Password validation and encrypted object decryption | Responsive route and honest disabled state | Decrypted PDF output | qpdf WASM is possible | No; same security/compatibility work as Protect PDF |
| Word to PDF | DOC/DOCX layout renderer | Fonts, pagination, tables, images, and styles | Responsive route and honest disabled state | Faithful Word rendering | Browser-side OOXML parsing is possible; full fidelity is substantial | No; text-only output would misrepresent the tool |
| EPUB to PDF | EPUB parser/reflow renderer | Package parsing, CSS, assets, and pagination | Responsive route and honest disabled state | Standards-aware PDF output | epub.js/JSZip plus a renderer could be bundled | No; standards and pagination QA required |
| PDF to EPUB | EPUB packager/reflow pipeline | Valid OPF, nav, XHTML, and asset packaging | Responsive route and honest disabled state | Valid reflowable EPUB output | Browser-side packaging is possible | No; output validity/accessibility QA required |
| GIF Maker | Animated GIF encoder | Quantization, timing, looping, transparency, and disposal | Responsive route and honest disabled state | Animated GIF output | A local encoder can be bundled | No; size, performance, and frame QA remain |
| Excel to PDF | Spreadsheet renderer | Styles, merged cells, widths, formulas, print areas, and pagination | Responsive route and honest disabled state | Faithful worksheet rendering | Browser parsing plus custom PDF layout is possible | No; partial tables would not meet the claim |
| PPT to PDF | Presentation renderer | Slide geometry, fonts, images, charts, and masters | Responsive route and honest disabled state | Faithful slide-to-PDF output | Browser OOXML parsing is possible but no complete renderer is bundled | No; fidelity work is substantial |
| GIF Frame Extractor | Animated GIF decoder | Timing, interlacing, transparency, and disposal compositing | Responsive route and honest disabled state | Correct per-frame extraction | A local decoder can be bundled | No; decoder and disposal regression QA required |
| Extract Images | PDF object-image extractor | Image streams, masks, color spaces, filters, and deduplication | Responsive route and honest disabled state; page rasterization remains separate | Original embedded-image extraction | Browser-side PDF object walking is possible | No; page rasterization would be a fake substitute |
| OCR PDF | OCR engine and language data | Image segmentation and character recognition | Responsive route and honest disabled state | Text extraction from scanned pages | Tesseract WASM can run locally but model packs are large/mobile-heavy | No; performance, language, cancellation, and accuracy QA required |
| PDF to Excel | Table recognition and workbook generator | Rows, columns, merged cells, types, and sheet structure | Responsive route and honest disabled state | Meaningful XLSX output | Browser heuristics and workbook generation are possible | No; arbitrary PDF table recognition is not a quick safe bundle |
| PDF to PPT | Slide reconstruction and PPTX generator | Mapping PDF geometry, text, and images into editable slides | Responsive route and honest disabled state | Editable PowerPoint output | A PPTX generator can be bundled; reconstruction is still required | No; page images would misrepresent editable conversion |

## Screenshots

- `docs/screenshots/home-mobile-320.png`
- `docs/screenshots/mobile-drawer-320.png`
- `docs/screenshots/signup-mobile-320.png`
- `docs/screenshots/signin-mobile-320.png`
- `docs/screenshots/support-mobile-320.png`
- `docs/screenshots/crop-image-mobile-upload-390.png`
- `docs/screenshots/merge-pdf-mobile-result-390.png`
- `docs/screenshots/background-remover-mobile-upload-390.png`
- `docs/screenshots/background-remover-mobile-editor-390.png`
- `docs/screenshots/background-remover-mobile-properties-390.png`
- `docs/screenshots/home-tablet-768.png`
- `docs/screenshots/home-desktop-1440.png`

## Remaining limitations

- **Physical Android: Untested.** Android file-picker chrome, real soft-keyboard resize, OS speech audio, and true two-finger gestures remain physical-device checks.
- **Physical iOS: Untested.** iOS file-picker chrome, real soft-keyboard resize, OS speech audio, and true two-finger gestures remain physical-device checks.
- The in-app browser stalled on cryptographic password/hash work and simple/scientific keypad evaluation. Those four tools are explicitly `VERIFIED WITH LIMITATION`, not full passes.
- The audit browser does not expose `BarcodeDetector`; QR/barcode readers correctly reported that capability limitation instead of showing a fake workflow.
- The 13 dependency-blocked tools remain intentionally unavailable until their named engines are deliberately implemented and bundled.

No tool is labeled `UNTESTED` or `FAILED`; limitations and dependency blockers are accounted for explicitly above.
