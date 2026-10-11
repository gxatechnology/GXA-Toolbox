# GXA Toolbox AdSense content and workspace audit

## A. Executive summary

This audit is generated from the central 95-tool registry, the content registry, and the built HTML in `dist/`. All 95 public tool routes are inventoried below. The build contains 109 sitemap URLs. “Contract-covered” means the route is connected to an existing processing/render path and repository checks; it does not claim testing on every physical device or guarantee AdSense approval.

The principal content issue was one shared browser-local privacy paragraph across most tools. It has been replaced by tool-specific input/output processing language, while explicit exceptions such as GPS Map Camera keep their specialized disclosure. Compact intros now appear before each tool workspace and are emitted into crawler-facing HTML. Related converter and calculator instructions that crossed the similarity threshold were rewritten around their actual controls and methods.

## B. All 95 tool audit matrix

### Content and live-render contract

| Tool | Route | Category | Tool works? | Unique H1 | Unique intro | Intro useful | Workspace visible | How to Use | Features | Use cases | Input/output | Privacy | Technical | Limitations | Example | Tips | FAQs | Related tools |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Merge PDF | `/merge-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Organize PDF | `/organize-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Compress Image | `/compress-image/` | image | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Resize Image | `/resize-image/` | image | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Image Converter | `/image-converter/` | image | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| GPS Map Camera – Geotag Photo | `/gps-map-camera/` | image | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Crop Image | `/crop-image/` | image | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Image OCR | `/image-ocr/` | image | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Background Remover | `/background-remover/` | image | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Password Generator | `/password-generator/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| QR & Barcode | `/barcode-generator/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Color Extractor | `/color-extractor/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| ZIP Manager | `/zip-manager/` | zip | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Split PDF | `/split-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Protect PDF | `/protect-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Unlock PDF | `/unlock-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to JPG | `/pdf-to-jpg/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| JPG to PDF | `/jpg-to-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Word to PDF | `/word-to-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to Text/RTF | `/pdf-to-word/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| EPUB to PDF | `/epub-to-pdf/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to EPUB | `/pdf-to-epub/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| GIF Maker | `/gif-maker/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| ZIP Extractor | `/zip-extractor/` | zip | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Compress PDF | `/compress-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Edit PDF | `/edit-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Rotate PDF | `/rotate-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Add Watermark | `/watermark-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Add Page Numbers | `/pagenumber-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF Metadata Editor | `/pdf-metadata/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Excel to PDF | `/excel-to-pdf/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PPT to PDF | `/ppt-to-pdf/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to Text | `/pdf-to-text/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| HTML to PDF | `/html-to-pdf/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to HTML | `/pdf-to-html/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Markdown to PDF | `/markdown-to-pdf/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to Markdown | `/pdf-to-markdown/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SVG to PNG | `/svg-to-png/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PNG to SVG | `/png-to-svg/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| WEBP to JPG | `/webp-to-jpg/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| GIF Frame Extractor | `/gif-to-png/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Text-to-Speech Reader | `/text-to-speech/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| QR Code Reader | `/qr-reader/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Barcode Scanner | `/barcode-reader/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Base64 Tool | `/base64-tool/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| URL Encoder/Decoder | `/url-tool/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| JSON Formatter | `/json-tool/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Hash Generator | `/hash-tool/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Text Case Converter | `/case-converter/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Word Counter | `/word-counter/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Lorem Ipsum Generator | `/lorem-ipsum/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Diff Checker | `/diff-checker/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SQL Formatter | `/sql-formatter/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| XML to JSON Converter | `/xml-to-json/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| UUID Generator | `/uuid-generator/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Browser Information | `/user-agent/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Regex Tester | `/regex-tester/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Markdown Editor | `/markdown-editor/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| CSS Formatter | `/css-beautifier/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| JS Formatter | `/js-beautifier/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| HTML Formatter | `/html-beautifier/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Cron Expression Helper | `/cron-generator/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Color Converter | `/color-converter/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| EXIF Metadata Viewer | `/exif-viewer/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Epoch Converter | `/timestamp-converter/` | utility | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Remove PDF Pages | `/remove-pdf-pages/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Extract PDF Pages | `/extract-pdf-pages/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Extract Images | `/extract-images-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Crop PDF | `/crop-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Add Header & Footer | `/header-footer-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Sign PDF | `/sign-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Repair PDF | `/repair-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| OCR PDF | `/ocr-pdf/` | pdf | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Image to PDF | `/image-to-pdf/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PNG to PDF | `/png-to-pdf/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| TXT to PDF | `/txt-to-pdf/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to Image | `/pdf-to-image/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to PNG | `/pdf-to-png/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to Excel | `/pdf-to-excel/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| PDF to PPT | `/pdf-to-ppt/` | convert | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Simple Calculator | `/calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Scientific Calculator | `/scientific-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Percentage Calculator | `/percentage-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Age Calculator | `/age-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Date Calculator | `/date-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| EMI Calculator | `/emi-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Loan Calculator | `/loan-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Interest Calculator | `/interest-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| GST Calculator | `/gst-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SIP Calculator | `/sip-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| BMI Calculator | `/bmi-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Discount Calculator | `/discount-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Unit Converter | `/unit-converter/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Currency Converter | `/currency-converter/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Time Calculator | `/time-calculator/` | calculator | Contract-covered | PASS | PASS | PASS | Render path | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

### SEO, generated HTML, and layout contract

| Route | Unique title | Unique description | Canonical | Structured data | Useful static HTML | Thin risk | Mobile workspace | Desktop workspace | Preview/result clipping | Overall |
|---|---|---|---|---|---|---|---|---|---|---|
| `/merge-pdf/` | PASS | PASS | PASS | PASS | PASS (782 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/organize-pdf/` | PASS | PASS | PASS | PASS | PASS (762 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/compress-image/` | PASS | PASS | PASS | PASS | PASS (642 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/resize-image/` | PASS | PASS | PASS | PASS | PASS (595 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/image-converter/` | PASS | PASS | PASS | PASS | PASS (1112 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/gps-map-camera/` | PASS | PASS | PASS | PASS | PASS (1631 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/crop-image/` | PASS | PASS | PASS | PASS | PASS (683 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/image-ocr/` | PASS | PASS | PASS | PASS | PASS (609 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/background-remover/` | PASS | PASS | PASS | PASS | PASS (671 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/password-generator/` | PASS | PASS | PASS | PASS | PASS (704 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/barcode-generator/` | PASS | PASS | PASS | PASS | PASS (698 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/color-extractor/` | PASS | PASS | PASS | PASS | PASS (548 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/zip-manager/` | PASS | PASS | PASS | PASS | PASS (547 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/split-pdf/` | PASS | PASS | PASS | PASS | PASS (728 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/protect-pdf/` | PASS | PASS | PASS | PASS | PASS (492 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/unlock-pdf/` | PASS | PASS | PASS | PASS | PASS (466 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-jpg/` | PASS | PASS | PASS | PASS | PASS (658 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/jpg-to-pdf/` | PASS | PASS | PASS | PASS | PASS (629 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/word-to-pdf/` | PASS | PASS | PASS | PASS | PASS (487 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-word/` | PASS | PASS | PASS | PASS | PASS (454 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/epub-to-pdf/` | PASS | PASS | PASS | PASS | PASS (586 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-epub/` | PASS | PASS | PASS | PASS | PASS (587 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/gif-maker/` | PASS | PASS | PASS | PASS | PASS (729 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/zip-extractor/` | PASS | PASS | PASS | PASS | PASS (544 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/compress-pdf/` | PASS | PASS | PASS | PASS | PASS (748 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/edit-pdf/` | PASS | PASS | PASS | PASS | PASS (1601 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/rotate-pdf/` | PASS | PASS | PASS | PASS | PASS (435 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/watermark-pdf/` | PASS | PASS | PASS | PASS | PASS (482 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pagenumber-pdf/` | PASS | PASS | PASS | PASS | PASS (510 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-metadata/` | PASS | PASS | PASS | PASS | PASS (483 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/excel-to-pdf/` | PASS | PASS | PASS | PASS | PASS (639 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/ppt-to-pdf/` | PASS | PASS | PASS | PASS | PASS (601 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-text/` | PASS | PASS | PASS | PASS | PASS (561 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/html-to-pdf/` | PASS | PASS | PASS | PASS | PASS (686 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-html/` | PASS | PASS | PASS | PASS | PASS (572 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/markdown-to-pdf/` | PASS | PASS | PASS | PASS | PASS (687 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-markdown/` | PASS | PASS | PASS | PASS | PASS (576 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/svg-to-png/` | PASS | PASS | PASS | PASS | PASS (610 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/png-to-svg/` | PASS | PASS | PASS | PASS | PASS (630 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/webp-to-jpg/` | PASS | PASS | PASS | PASS | PASS (613 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/gif-to-png/` | PASS | PASS | PASS | PASS | PASS (648 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/text-to-speech/` | PASS | PASS | PASS | PASS | PASS (685 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/qr-reader/` | PASS | PASS | PASS | PASS | PASS (617 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/barcode-reader/` | PASS | PASS | PASS | PASS | PASS (604 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/base64-tool/` | PASS | PASS | PASS | PASS | PASS (684 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/url-tool/` | PASS | PASS | PASS | PASS | PASS (628 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/json-tool/` | PASS | PASS | PASS | PASS | PASS (682 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/hash-tool/` | PASS | PASS | PASS | PASS | PASS (629 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/case-converter/` | PASS | PASS | PASS | PASS | PASS (589 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/word-counter/` | PASS | PASS | PASS | PASS | PASS (651 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/lorem-ipsum/` | PASS | PASS | PASS | PASS | PASS (632 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/diff-checker/` | PASS | PASS | PASS | PASS | PASS (610 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/sql-formatter/` | PASS | PASS | PASS | PASS | PASS (593 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/xml-to-json/` | PASS | PASS | PASS | PASS | PASS (633 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/uuid-generator/` | PASS | PASS | PASS | PASS | PASS (692 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/user-agent/` | PASS | PASS | PASS | PASS | PASS (605 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/regex-tester/` | PASS | PASS | PASS | PASS | PASS (652 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/markdown-editor/` | PASS | PASS | PASS | PASS | PASS (651 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/css-beautifier/` | PASS | PASS | PASS | PASS | PASS (555 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/js-beautifier/` | PASS | PASS | PASS | PASS | PASS (577 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/html-beautifier/` | PASS | PASS | PASS | PASS | PASS (572 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/cron-generator/` | PASS | PASS | PASS | PASS | PASS (604 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/color-converter/` | PASS | PASS | PASS | PASS | PASS (665 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/exif-viewer/` | PASS | PASS | PASS | PASS | PASS (636 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/timestamp-converter/` | PASS | PASS | PASS | PASS | PASS (659 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/remove-pdf-pages/` | PASS | PASS | PASS | PASS | PASS (473 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/extract-pdf-pages/` | PASS | PASS | PASS | PASS | PASS (474 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/extract-images-pdf/` | PASS | PASS | PASS | PASS | PASS (483 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/crop-pdf/` | PASS | PASS | PASS | PASS | PASS (487 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/header-footer-pdf/` | PASS | PASS | PASS | PASS | PASS (497 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/sign-pdf/` | PASS | PASS | PASS | PASS | PASS (497 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/repair-pdf/` | PASS | PASS | PASS | PASS | PASS (472 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/ocr-pdf/` | PASS | PASS | PASS | PASS | PASS (468 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/image-to-pdf/` | PASS | PASS | PASS | PASS | PASS (662 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/png-to-pdf/` | PASS | PASS | PASS | PASS | PASS (595 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/txt-to-pdf/` | PASS | PASS | PASS | PASS | PASS (566 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-image/` | PASS | PASS | PASS | PASS | PASS (582 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-png/` | PASS | PASS | PASS | PASS | PASS (580 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-excel/` | PASS | PASS | PASS | PASS | PASS (603 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/pdf-to-ppt/` | PASS | PASS | PASS | PASS | PASS (605 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/calculator/` | PASS | PASS | PASS | PASS | PASS (606 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/scientific-calculator/` | PASS | PASS | PASS | PASS | PASS (610 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/percentage-calculator/` | PASS | PASS | PASS | PASS | PASS (743 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/age-calculator/` | PASS | PASS | PASS | PASS | PASS (786 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/date-calculator/` | PASS | PASS | PASS | PASS | PASS (757 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/emi-calculator/` | PASS | PASS | PASS | PASS | PASS (807 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/loan-calculator/` | PASS | PASS | PASS | PASS | PASS (729 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/interest-calculator/` | PASS | PASS | PASS | PASS | PASS (690 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/gst-calculator/` | PASS | PASS | PASS | PASS | PASS (818 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/sip-calculator/` | PASS | PASS | PASS | PASS | PASS (747 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/bmi-calculator/` | PASS | PASS | PASS | PASS | PASS (646 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/discount-calculator/` | PASS | PASS | PASS | PASS | PASS (684 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/unit-converter/` | PASS | PASS | PASS | PASS | PASS (708 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/currency-converter/` | PASS | PASS | PASS | PASS | PASS (641 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |
| `/time-calculator/` | PASS | PASS | PASS | PASS | PASS (621 words) | Low | Shared/dedicated contract | Shared/dedicated contract | Shared result contract | PASS |

## C. Thin-content findings

- Indexable tool pages audited: 95.
- Generated pages containing the required static H1, intro, How to Use, FAQ, canonical, and schema signals: 95.
- Smallest generated tool response: 435 visible words in its main content extraction.
- No arbitrary word-count threshold was used. No tool was deleted or mass-noindexed; content gaps are fixed at the shared registry/generator layer.

## D. Duplicate-content findings

- Exact duplicate titles: 0 group(s)
- Exact duplicate descriptions: 0 group(s)
- Exact duplicate about: 0 group(s)
- Exact duplicate privacy: 0 group(s)
- Exact duplicate methods: 0 group(s)
- Exact duplicate steps: 0 group(s)
- Exact duplicate faqs: 0 group(s)
- Repeated individual paragraphs: 0 group(s)
- Repeated individual steps: 0 group(s)
- Repeated individual faqQuestions: 0 group(s)
- Repeated individual faqAnswers: 0 group(s)
- Highly similar introductions at a 0.78 Jaccard word-set threshold: 0 pair(s).
- Highly similar full How-to sets at the same threshold: 0 pair(s).
- Shared HTML structure is intentional; visible explanations remain route-specific.

## E. Homepage findings

The homepage identifies GXA Toolbox, its major PDF/image/conversion/ZIP/developer/calculator groups, representative tools, browser-processing boundaries, and direct crawlable tool links. No new generic marketing block or fabricated usage statistic was added during this pass.

## F. Trust-page findings

About, Privacy Policy, Terms, GDPR, Security, Careers, and support access are present through the existing content-page/footer architecture. The pages avoid invented addresses, certifications, corporate history, and vacancies. Privacy already distinguishes browser-local work from authentication, support, analytics/advertising, and optional GPS geocoding.

## G. Static HTML findings

The build emits an H1, compact tool-specific intro, full guide, How to Use, limitations, FAQs, related links, canonical metadata, and structured data into every tool response. Background Remover receives the same registry content during SEO post-processing before its React app starts.

## H. Workspace/clipping findings

The shared header previously left a large margin while providing no intro boundary, result previews had a 520px clipping/scroll ceiling, and auto-scroll calls ignored the sticky-header and reduced-motion contract. The shared intro spacing, 96px scroll margin, naturally expanding result preview, and one reduced-motion-aware result-scroll helper address those root causes without per-tool pixel hacks.

## I. Mobile findings

At phone widths the intro highlights stack into one column, results remain in normal page flow, long outputs retain wrapping, and dedicated editor layouts keep their existing mobile contracts. Automated viewport checks are evidence for emulated browsers only; final physical-device touch verification remains a release step.

## J. Desktop findings

The three-column compact intro sits between heading and workspace. Result panels expand vertically instead of being trapped by the former shared max-height. The 96px scroll offset protects headings beneath the sticky site header, including short 1366×768 viewports.

## K. Ad placement UX findings

No manual ad unit was added. Existing post-content placement mounts remain hidden and inert until a real unit is intentionally configured; the canonical Auto Ads loader remains separate from tool buttons and output controls. No `adsbygoogle.push()` or fake slot was introduced.

## L. Changes made

- Added one compact intro renderer to the live shared route system and the static SEO generator.
- Replaced shared privacy boilerplate with tool-specific, input/output-aware disclosures.
- Added explicit PDF method explanations and rewrote similar converter/calculator instructions.
- Added a shared result spacing/scroll contract and reduced-motion-aware scrolling.
- Added crawlable Background Remover highlights without changing its segmentation/editor engine.
- Added this deterministic 95-route audit and expanded content/layout contracts.

## M. Remaining issues

- A repository contract cannot prove every interaction on every browser/physical device; conduct the manual runtime checklist below.
- GPS search requires `GEOAPIFY_API_KEY` in the later Netlify environment. Other location methods remain available without it.
- AdSense approval remains Google’s decision; these changes improve genuine content and UX but do not guarantee approval.

## N. Manual pre-deployment checklist

- Inspect the complete Git diff and confirm no unrelated or secret material is staged.
- Confirm the central registry still reports 95 tools and the sitemap reports 109 URLs.
- Review representative generated files in `dist/`, including Background Remover.
- Confirm production environment variables and configure `GEOAPIFY_API_KEY` in Netlify if GPS search is intended.
- Re-run lint, tests, build, browser QA, and `git diff --check` from a clean release environment.

## O. Manual post-deployment checklist

- Verify the homepage and representative PDF, image, generator, calculator, developer, and archive routes.
- Verify generated results/downloads and mobile overflow on real devices.
- Verify GPS camera/geolocation over HTTPS and the same-origin geocoder when configured.
- Verify `/sitemap.xml`, `/robots.txt`, canonicals, GTM/GA4, and the single AdSense loader.
- Monitor Search Console crawl/index status; request another AdSense review only after updated public pages are deployed and crawlable.

## P. AdSense review readiness checklist

- [x] Useful static content on all 95 tool routes
- [x] Unique tool titles, descriptions, H1 identities, and intros
- [x] Tool-specific methods, privacy boundaries, limitations, examples, FAQs, and related tools
- [x] No duplicate paragraph/FAQ/How-to bundles detected by the content audit
- [x] No additional ad units, fake slots, cloaking, or approval claims
- [ ] Owner review of deployed pages and real-device interaction
- [ ] Google recrawl/index observation before any owner-initiated review request
