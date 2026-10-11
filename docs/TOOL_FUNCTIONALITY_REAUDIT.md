# Phase 4A tool functionality matrix — IN PROGRESS

Snapshot: 2026-10-05. All 95 registered routes are listed below. This is an evidence ledger, **not a completed 95-tool certification**. A route-loading/width pass is not proof of processing correctness. No tool is newly labelled FULLY WORKING until its entire requested workflow, invalid/edge cases and compatibility are reviewed.

Current publication flags are read from `public_html/assets/tool-quality.js`: 81 indexable/ads-eligible tools, 14 review routes. They are existing policy, not a claim that all 81 passed Phase 4A. No additional route has been promoted or removed in this checkpoint.

Chromium touch emulation is the browser used. Firefox, Safari, physical devices, speech voices, native BarcodeDetector, live Geoapify and real production authentication/database are not certified by this ledger. “Pending” is a deliberate unfinished-audit marker, not a broken-tool assertion. Format/browser classifications are provisional scope restrictions, not full verification results.

Evidence files: `tests/tool-functionality-phase4a/`, existing suites cited below, and ignored generated artifacts in `test-results/tool-functionality-phase4a/` and `test-results/ux-phase3/`. See `ADSENSE_PHASE4A_FUNCTIONALITY.md` for executed command results and outstanding work.

## Re-audit inventory

| Tool | Route | Category | Classification | Evidence / remaining work |
|---|---|---|---|---|
| Merge PDF | /merge-pdf/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; Browser upload/process/download/reset; output reopened; full interaction/compatibility coverage still pending. |
| Organize PDF | /organize-pdf/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Compress Image | /compress-image/ | image | Final classification pending | Browser upload/process/download/reset; output reopened; full interaction/compatibility coverage still pending. |
| Resize Image | /resize-image/ | image | Final classification pending | Browser upload/process/download/reset; output reopened; full interaction/compatibility coverage still pending. |
| Image Converter | /image-converter/ | image | FORMAT-LIMITED (provisional) | Browser upload/process/download/reset; output reopened; Existing output/contract suite rerun; full interaction/compatibility coverage still pending. |
| GPS Map Camera – Geotag Photo | /gps-map-camera/ | image | BROWSER-LIMITED (provisional) | Existing output/contract suite rerun; full interaction/compatibility coverage still pending. |
| Crop Image | /crop-image/ | image | Final classification pending | Browser upload/process/download/reset; output reopened; full interaction/compatibility coverage still pending. |
| Image OCR | /image-ocr/ | image | FORMAT-LIMITED (provisional) | Browser upload/process/download/reset; output reopened; full interaction/compatibility coverage still pending. |
| Background Remover | /background-remover/ | image | BROWSER-LIMITED (provisional) | Actual ONNX WASM inference and transparent PNG export; full interaction/compatibility coverage still pending. |
| Password Generator | /password-generator/ | utility | Final classification pending | Production generator: lengths 8/16/64, required character sets, 90 distinct regenerations and unchecked-set fallback; full interaction/compatibility coverage still pending. |
| QR & Barcode | /barcode-generator/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Color Extractor | /color-extractor/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| ZIP Manager | /zip-manager/ | zip | Final classification pending | Archive engine: duplicate/Unicode bytes and CRC; full interaction/compatibility coverage still pending. |
| Split PDF | /split-pdf/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Protect PDF | /protect-pdf/ | pdf | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Unlock PDF | /unlock-pdf/ | pdf | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| PDF to JPG | /pdf-to-jpg/ | pdf | Final classification pending | Browser upload/process/download/reset; output reopened; full interaction/compatibility coverage still pending. |
| JPG to PDF | /jpg-to-pdf/ | pdf | Final classification pending | Browser upload/process/download/reset; output reopened; full interaction/compatibility coverage still pending. |
| Word to PDF | /word-to-pdf/ | pdf | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| PDF to Text/RTF | /pdf-to-word/ | pdf | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| EPUB to PDF | /epub-to-pdf/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| PDF to EPUB | /pdf-to-epub/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| GIF Maker | /gif-maker/ | convert | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| ZIP Extractor | /zip-extractor/ | zip | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Compress PDF | /compress-pdf/ | pdf | Final classification pending | Existing output/contract suite rerun; full interaction/compatibility coverage still pending. |
| Edit PDF | /edit-pdf/ | pdf | FORMAT-LIMITED (provisional) | Existing output/contract suite rerun; full interaction/compatibility coverage still pending. |
| Rotate PDF | /rotate-pdf/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Add Watermark | /watermark-pdf/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Add Page Numbers | /pagenumber-pdf/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| PDF Metadata Editor | /pdf-metadata/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Excel to PDF | /excel-to-pdf/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| PPT to PDF | /ppt-to-pdf/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| PDF to Text | /pdf-to-text/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| HTML to PDF | /html-to-pdf/ | convert | FORMAT-LIMITED (provisional) | Existing output/contract suite rerun; full interaction/compatibility coverage still pending. |
| PDF to HTML | /pdf-to-html/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| Markdown to PDF | /markdown-to-pdf/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| PDF to Markdown | /pdf-to-markdown/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| SVG to PNG | /svg-to-png/ | convert | Final classification pending | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| PNG to SVG | /png-to-svg/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| WEBP to JPG | /webp-to-jpg/ | convert | Final classification pending | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| GIF Frame Extractor | /gif-to-png/ | convert | Final classification pending | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| Text-to-Speech Reader | /text-to-speech/ | utility | BROWSER-LIMITED (provisional) | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| QR Code Reader | /qr-reader/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Barcode Scanner | /barcode-reader/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Base64 Tool | /base64-tool/ | utility | Final classification pending | UTF-8 text, binary/Base64-file imports, real reopened TXT download, invalid input, text replacement and stale-import rejection; eight populated-result widths passed; remaining full compatibility/edge coverage pending. |
| URL Encoder/Decoder | /url-tool/ | utility | Final classification pending | Production UTF-8 percent encode/decode, invalid percent input and inert hostile output; full interaction/compatibility coverage still pending. |
| JSON Formatter | /json-tool/ | utility | Final classification pending | Production scalar/object/array round trips, invalid JSON, inert Unicode and 100KB input retention; full interaction/compatibility coverage still pending. |
| Hash Generator | /hash-tool/ | utility | Final classification pending | Independent SHA-1/256/384/512 engine digests; live empty/whitespace/Unicode browser checks; eight populated-result widths passed; remaining full compatibility/edge coverage pending. |
| Text Case Converter | /case-converter/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Word Counter | /word-counter/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Lorem Ipsum Generator | /lorem-ipsum/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Diff Checker | /diff-checker/ | utility | Final classification pending | Production changed-line count and inert hostile Unicode output; full interaction/compatibility coverage still pending. |
| SQL Formatter | /sql-formatter/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| XML to JSON Converter | /xml-to-json/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| UUID Generator | /uuid-generator/ | utility | Final classification pending | Production 100 UUIDs: count/version/variant/uniqueness and invalid-count rejection; existing secure fallback tests; full interaction/compatibility coverage still pending. |
| Browser Information | /user-agent/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Regex Tester | /regex-tester/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Markdown Editor | /markdown-editor/ | utility | FORMAT-LIMITED (provisional) | Production heading/bold render and literal hostile HTML; limited Markdown scope; full interaction/compatibility coverage still pending. |
| CSS Formatter | /css-beautifier/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| JS Formatter | /js-beautifier/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| HTML Formatter | /html-beautifier/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Cron Expression Helper | /cron-generator/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Color Converter | /color-converter/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| EXIF Metadata Viewer | /exif-viewer/ | utility | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Epoch Converter | /timestamp-converter/ | utility | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Remove PDF Pages | /remove-pdf-pages/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Extract PDF Pages | /extract-pdf-pages/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Extract Images | /extract-images-pdf/ | pdf | FORMAT-LIMITED (provisional) | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Crop PDF | /crop-pdf/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Add Header & Footer | /header-footer-pdf/ | pdf | Final classification pending | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Sign PDF | /sign-pdf/ | pdf | FORMAT-LIMITED (provisional) | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| Repair PDF | /repair-pdf/ | pdf | FORMAT-LIMITED (provisional) | PDF engine: reopened pages/operators; invalid input; full interaction/compatibility coverage still pending. |
| OCR PDF | /ocr-pdf/ | pdf | FORMAT-LIMITED (provisional) | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| Image to PDF | /image-to-pdf/ | convert | Final classification pending | Browser upload/process/download/reset; output reopened; full interaction/compatibility coverage still pending. |
| PNG to PDF | /png-to-pdf/ | convert | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| TXT to PDF | /txt-to-pdf/ | convert | Final classification pending | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| PDF to Image | /pdf-to-image/ | convert | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| PDF to PNG | /pdf-to-png/ | convert | Final classification pending | Per-tool output/edge verification pending; full interaction/compatibility coverage still pending. |
| PDF to Excel | /pdf-to-excel/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| PDF to PPT | /pdf-to-ppt/ | convert | FORMAT-LIMITED (provisional) | Browser conversion engine; output structure/content checked; full interaction/compatibility coverage still pending. |
| Simple Calculator | /calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Scientific Calculator | /scientific-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Percentage Calculator | /percentage-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Age Calculator | /age-calculator/ | calculator | Final classification pending | Month-end/leap/year-bound engine tests and touch Calculate in two timezones; eight populated-result widths passed; remaining full compatibility/edge coverage pending. |
| Date Calculator | /date-calculator/ | calculator | Final classification pending | Reversed durations/clamped offsets/invalid dates; touch operation changes in two timezones; eight populated-result widths passed; remaining full compatibility/edge coverage pending. |
| EMI Calculator | /emi-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Loan Calculator | /loan-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Interest Calculator | /interest-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| GST Calculator | /gst-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| SIP Calculator | /sip-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| BMI Calculator | /bmi-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Discount Calculator | /discount-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Unit Converter | /unit-converter/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Currency Converter | /currency-converter/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |
| Time Calculator | /time-calculator/ | calculator | Final classification pending | Calculator/epoch numeric regressions; full interaction/compatibility coverage still pending. |

## Priority remaining verification

- Complete happy/error/reset/download checks for routes with no new output evidence, especially ZIP Extractor, all developer utilities, readers/generators, OCR PDF, protect/unlock and image extraction.
- Expand sampled conversion tests to difficult/multi-file/Unicode inputs, document format loss precisely and compare exported content rather than only package presence.
- Finish calculator boundary/overflow/calendar testing; current normal-case numeric tests are not exhaustive.
- Independently verify specialized editors' brush/pinch/crop/error paths across browser families. Geoapify provider responses in GPS tests are controlled fixtures, not live service evidence.
- Review publication flags only after the corresponding full functional evidence exists. Do not preserve 81 as a target and do not treat this interim report as deployment approval.

