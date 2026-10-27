# GXA Toolbox result/download layout audit

Generated from the central 95-tool registry by `scripts/generate-result-download-audit.mjs`.

## Outcome

- Registered tools audited: **95**
- Post-processing result workflows updated: **55**
- Intentionally excluded: **40** (38 direct/live utilities, Background Remover direct editor export, and dependency-blocked PPT to PDF)
- Popunder: **off**
- Smartlink: **off**
- Social Bar: **on**
- Existing seven display formats and route eligibility policy: **preserved**

The shared result order is success, preview, useful output details, a result-ready advertisement candidate, and a labeled download/export section. The provider request is not sent until the enclosing result is ready. Download access has no countdown, forced view, click requirement, or artificial delay. No-fill uses the existing bounded provider lifecycle and collapses the slot; the download section remains independent.

## Inventory

| Tool | Route | Category | Result/download pattern | Scope | Reason / final behavior |
| --- | --- | --- | --- | --- | --- |
| Merge PDF | /merge-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Organize PDF | /organize-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Compress Image | /compress-image/ | image | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Resize Image | /resize-image/ | image | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Image Converter | /image-converter/ | image | Specialized image result | Updated | Preview and verified metadata → gated result ad → labeled download section. |
| GPS Map Camera – Geotag Photo | /gps-map-camera/ | image | Specialized photo export | Updated | Result metadata → gated result ad → labeled download section. |
| Crop Image | /crop-image/ | image | Specialized crop result | Updated | Preview and output details → gated result ad → download/edit actions. |
| Image OCR | /image-ocr/ | image | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Background Remover | /background-remover/ | image | Dedicated React editor export | Excluded | Export remains in the editor dialog; inserting an ad into that critical workflow would obstruct the canvas/export UX. |
| Password Generator | /password-generator/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| QR & Barcode | /barcode-generator/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Color Extractor | /color-extractor/ | utility | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| ZIP Manager | /zip-manager/ | zip | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Split PDF | /split-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Protect PDF | /protect-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Unlock PDF | /unlock-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to JPG | /pdf-to-jpg/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| JPG to PDF | /jpg-to-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Word to PDF | /word-to-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to Text/RTF | /pdf-to-word/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| EPUB to PDF | /epub-to-pdf/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to EPUB | /pdf-to-epub/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| GIF Maker | /gif-maker/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| ZIP Extractor | /zip-extractor/ | zip | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Compress PDF | /compress-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Edit PDF | /edit-pdf/ | pdf | Specialized PDF editor result | Updated | Generated preview → gated result ad → labeled download section. |
| Rotate PDF | /rotate-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Add Watermark | /watermark-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Add Page Numbers | /pagenumber-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF Metadata Editor | /pdf-metadata/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Excel to PDF | /excel-to-pdf/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PPT to PDF | /ppt-to-pdf/ | convert | Dependency-blocked | Excluded | Faithful presentation renderer is unavailable; no successful result/download screen is exposed. |
| PDF to Text | /pdf-to-text/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| HTML to PDF | /html-to-pdf/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to HTML | /pdf-to-html/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Markdown to PDF | /markdown-to-pdf/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to Markdown | /pdf-to-markdown/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| SVG to PNG | /svg-to-png/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PNG to SVG | /png-to-svg/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| WEBP to JPG | /webp-to-jpg/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| GIF Frame Extractor | /gif-to-png/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Text-to-Speech Reader | /text-to-speech/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| QR Code Reader | /qr-reader/ | utility | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Barcode Scanner | /barcode-reader/ | utility | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Base64 Tool | /base64-tool/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| URL Encoder/Decoder | /url-tool/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| JSON Formatter | /json-tool/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Hash Generator | /hash-tool/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Text Case Converter | /case-converter/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Word Counter | /word-counter/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Lorem Ipsum Generator | /lorem-ipsum/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Diff Checker | /diff-checker/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| SQL Formatter | /sql-formatter/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| XML to JSON Converter | /xml-to-json/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| UUID Generator | /uuid-generator/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Browser Information | /user-agent/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Regex Tester | /regex-tester/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Markdown Editor | /markdown-editor/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| CSS Formatter | /css-beautifier/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| JS Formatter | /js-beautifier/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| HTML Formatter | /html-beautifier/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Cron Expression Helper | /cron-generator/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Color Converter | /color-converter/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| EXIF Metadata Viewer | /exif-viewer/ | utility | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Epoch Converter | /timestamp-converter/ | utility | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Remove PDF Pages | /remove-pdf-pages/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Extract PDF Pages | /extract-pdf-pages/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Extract Images | /extract-images-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Crop PDF | /crop-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Add Header & Footer | /header-footer-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Sign PDF | /sign-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Repair PDF | /repair-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| OCR PDF | /ocr-pdf/ | pdf | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Image to PDF | /image-to-pdf/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PNG to PDF | /png-to-pdf/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| TXT to PDF | /txt-to-pdf/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to Image | /pdf-to-image/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to PNG | /pdf-to-png/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to Excel | /pdf-to-excel/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| PDF to PPT | /pdf-to-ppt/ | convert | Shared processed-file result | Updated | Success and preview/statistics → gated result ad → labeled download/start-over actions. |
| Simple Calculator | /calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Scientific Calculator | /scientific-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Percentage Calculator | /percentage-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Age Calculator | /age-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Date Calculator | /date-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| EMI Calculator | /emi-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Loan Calculator | /loan-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Interest Calculator | /interest-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| GST Calculator | /gst-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| SIP Calculator | /sip-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| BMI Calculator | /bmi-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Discount Calculator | /discount-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Unit Converter | /unit-converter/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Currency Converter | /currency-converter/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |
| Time Calculator | /time-calculator/ | calculator | Direct/live output | Excluded | No intermediate processed-file result screen; existing direct copy/download behavior is retained. |

## Placement and responsive behavior

- The result placement is central-flow content and does not replace desktop left/right rails.
- Standard, crop, Image Converter, GPS Map Camera, and Edit PDF result views use the same shared advertisement-placeholder renderer.
- Mobile has one normal-flow download action, rather than separate sticky and desktop duplicate buttons.
- Advertisement labels, eligibility, approved-unit selection, lazy loading, fill detection, and collapse behavior remain owned by the central ad runtime.
- The dedicated React Background Remover remains a direct-export exception to protect its canvas and export dialog.

## Verification boundary

Browser suites use clearly identified local provider fixtures to verify layout and lifecycle. They do not claim a fixture is a genuine provider creative. Actual Adsterra fill remains provider-, geography-, inventory-, consent-, and blocker-dependent.
