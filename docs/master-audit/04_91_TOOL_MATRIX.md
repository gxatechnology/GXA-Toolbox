# Complete Tool Matrix (92 Registered Tools)

The requested filename is retained for compatibility, but the central registry contains **92**, not 91, tools. This report follows source truth.

## Field model

Every row supplies all requested fields, compacted into grouped columns:

1. Number; 2. ID; 3. name; 4. category; 5. description; 6. route; 7. input; 8. output; 9. method; 10. engine; 11. browser API; 12. JS library; 13. WASM; 14. Worker; 15. Function; 16. database; 17. external API; 18. network during processing; 19. file local; 20. enforced/practical limit; 21. mobile; 22. desktop; 23. download; 24. preview; 25. copy; 26. share; 27. undo/redo; 28. status; 29. known limitation; 30. privacy classification.

Common values used below:

- `B` = fully working browser path; `W` = fully working WASM-primary path; `L` = working with browser limitation; `X` = not currently feasible.
- `local` means uploaded bytes are not sent to a GXA Function/API. A tool may still fetch a script, WASM, model, font, or OCR language asset.
- All rows have `Function: no`, `DB: no`, and `external processing API: no` for the primary processing path. Signed-in history/event metadata is a product feature, not a file-processing engine.
- All working rows support desktop; mobile is supported within documented resource/capability constraints.
- “Preview” includes a result view for text/calculator tools. “Download/copy/share/undo” are tool-specific; `—` means not applicable or not exposed.

## Detailed 92-row matrix

| # | ID / route | Name · category · description | Input → output | Method / engine / APIs | Runtime flags | Limit and platform | Actions (D/P/C/S/U) | Status, limitation and privacy |
|---:|---|---|---|---|---|---|---|---|
| 1 | `merge-pdf` `/merge-pdf/` | Merge PDF · PDF · combine ordered documents | 2+ PDF → PDF | page copy; pdf-lib | JS; no WASM; optional worker | 100 MB/file; mobile/desktop | Y/Y/—/Y/Y | **B**; memory grows with aggregate bytes; local |
| 2 | `organize-pdf` `/organize-pdf/` | Organize PDF · PDF · reorder/rotate/remove/watermark/blank pages | PDF + actions → PDF | PDF.js previews + pdf-lib | PDF.js Worker | thumbnail memory; mobile/desktop | Y/Y/—/Y/Y | **B**; large PDFs need lazy thumbnails; local |
| 3 | `compress-image` `/compress-image/` | Compress Image · Image · quality-controlled compression | JPG/PNG/WEBP → image/ZIP | Canvas codecs + JSZip | JS; optional OffscreenCanvas | decoded-pixel budget; mobile/desktop | Y/Y/—/Y/Y | **B**; codec/browser quality differs; local |
| 4 | `resize-image` `/resize-image/` | Resize Image · Image · exact/percentage dimensions | JPG/PNG/WEBP → image/ZIP | createImageBitmap/Image + Canvas | JS; optional worker | decoded source+target pixels | Y/Y/—/Y/Y | **B**; browser codec support governs input; local |
| 5 | `crop-image` `/crop-image/` | Crop Image · Image · manual transform/crop/export | JPG/PNG/WEBP → image | Cropper.js + Canvas | main-thread interaction | 50 MB plus pixel budget | Y/Y/—/Y/Y | **B**; touch precision/device memory; local |
| 6 | `image-ocr` `/image-ocr/` | Image OCR · Image · extract English text | JPG/JPEG/PNG/WEBP → TXT/text | browser decode + Tesseract.js | WASM core; dedicated OCR Worker; first-use CDN assets | 20 MB, 24 MP; mobile/desktop | Y/Y/Y/Y/— | **L**; OCR accuracy, English UI and asset fetch; file local |
| 7 | `background-remover` `/background-remover/` | Background Remover · Image · AI cutout + refinement | JPG/PNG/WEBP → transparent/composed PNG | React + ONNX Runtime Web + U2NetP + Canvas | WASM/WebGPU; local model/runtime | 30 MB, 48 MP; capable mobile/desktop | Y/Y/—/Y/Y | **W**; heavy model/tensor memory; file/model local after load |
| 8 | `password-generator` `/password-generator/` | Password Generator · Utility · random secrets/strength | rules → password text | Web Crypto `getRandomValues` | native | low; all platforms | —/Y/Y/Y/— | **B**; no password storage; local |
| 9 | `barcode-generator` `/barcode-generator/` | QR & Barcode · Utility · generate QR/CODE128 | text/URL/style → PNG/SVG | QRCode.js + JsBarcode | JS | low; all platforms | Y/Y/Y/Y/— | **B**; generator format scope; local |
| 10 | `color-extractor` `/color-extractor/` | Color Extractor · Utility · palette sampling | image → colors | Canvas ImageData | native/JS | pixel budget; mobile/desktop | —/Y/Y/Y/— | **B**; sampling is approximate; local |
| 11 | `zip-manager` `/zip-manager/` | ZIP Manager · ZIP · create archives | files → ZIP | JSZip | JS; worker recommended at scale | aggregate buffer limit; mobile/desktop | Y/Y/—/Y/Y | **B**; memory compression cost; local |
| 12 | `split-pdf` `/split-pdf/` | Split PDF · PDF · ranges/individual pages | PDF + ranges → PDF/ZIP | pdf-lib + JSZip | JS | file/page cap; mobile/desktop | Y/Y/—/Y/Y | **B**; aggregate output memory; local |
| 13 | `protect-pdf` `/protect-pdf/` | Protect PDF · PDF · AES-256 password encryption | PDF + password → encrypted PDF | qpdf CLI | qpdf WASM + dedicated Worker | 25 MB; mobile/desktop | Y/Y/—/Y/— | **W**; one UI password used for qpdf user/owner values; local |
| 14 | `unlock-pdf` `/unlock-pdf/` | Unlock PDF · PDF · authorized decryption | encrypted PDF + password → PDF | qpdf CLI | qpdf WASM + dedicated Worker | 25 MB; mobile/desktop | Y/Y/—/Y/— | **W**; correct password required; local |
| 15 | `pdf-to-jpg` `/pdf-to-jpg/` | PDF to JPG · PDF · rasterize pages | PDF → JPG/PNG/ZIP | PDF.js + Canvas + JSZip | PDF.js Worker | DPI/page pixel budget | Y/Y/—/Y/— | **B**; high DPI is memory-heavy; local |
| 16 | `jpg-to-pdf` `/jpg-to-pdf/` | JPG to PDF · PDF · merge images to pages | JPG/PNG/WEBP → PDF | Canvas normalization + pdf-lib | JS | image-count/pixel cap | Y/Y/—/Y/Y | **B**; raster input stays raster; local |
| 17 | `word-to-pdf` `/word-to-pdf/` | Word to PDF · PDF · semantic DOCX/text conversion | DOCX/TXT → PDF | Mammoth + pdf-lib paginator | lazy JS | 25 MB, 5M chars | Y/Y/—/Y/— | **L**; not native Word pagination; script/font limits; local |
| 18 | `pdf-to-word` `/pdf-to-word/` | PDF to Text/RTF · PDF · selectable-text extraction | text PDF → TXT/RTF | PDF.js textContent + serializer | PDF.js Worker | page/text budget | Y/Y/Y/Y/— | **L**; no DOCX/layout reconstruction; local |
| 19 | `epub-to-pdf` `/epub-to-pdf/` | EPUB to PDF · Convert · bounded reflow | EPUB → PDF | JSZip + DOMParser + pdf-lib | lazy JS | 30 MB, 500 spine items, 5M chars | Y/Y/—/Y/— | **L**; fixed layout/CSS/script/font fidelity; local |
| 20 | `pdf-to-epub` `/pdf-to-epub/` | PDF to EPUB · Convert · EPUB 3 package | text PDF → EPUB | PDF.js + JSZip | PDF.js Worker | page/text budget | Y/Y/—/Y/— | **L**; original page layout not preserved; local |
| 21 | `gif-maker` `/gif-maker/` | GIF Maker · Convert · animated sequence | images + timing → GIF | Canvas + gifenc | dedicated GIF Worker | 24M total pixels | Y/Y/—/Y/Y | **B**; quantization/frame caps affect quality; local |
| 22 | `zip-extractor` `/zip-extractor/` | ZIP Extractor · ZIP · inspect/extract | ZIP → files | JSZip + CRC/path checks | JS; worker recommended at scale | compressed/inflated size caps | Y/Y/—/Y/— | **B**; ZIP only; archive memory cost; local |
| 23 | `compress-pdf` `/compress-pdf/` | Optimize PDF · PDF · structural reserialization | PDF → PDF | pdf-lib save | JS | 100 MB/file practical | Y/Y/—/Y/— | **L**; no image downsampling; may not shrink; local |
| 24 | `rotate-pdf` `/rotate-pdf/` | Rotate PDF · PDF · selected/all-page rotation | PDF + angle → PDF | pdf-lib | JS | file/page cap | Y/Y/—/Y/Y | **B**; standard rotation only; local |
| 25 | `watermark-pdf` `/watermark-pdf/` | Add Watermark · PDF · text/image/symbol placement | PDF + watermark → PDF | pdf-lib + Canvas decode | JS | preview/page memory | Y/Y/—/Y/Y | **B**; font/image constraints; local |
| 26 | `pagenumber-pdf` `/pagenumber-pdf/` | Add Page Numbers · PDF · tokenized numbering | PDF + settings → PDF | pdf-lib | JS | file/page cap | Y/Y/—/Y/Y | **B**; built-in font coverage; local |
| 27 | `pdf-metadata` `/pdf-metadata/` | PDF Metadata Editor · PDF · standard fields | PDF + metadata → PDF | PDF.js read + pdf-lib write | PDF.js Worker | file cap | Y/Y/Y/Y/Y | **B**; standard fields only; local |
| 28 | `excel-to-pdf` `/excel-to-pdf/` | Excel to PDF · Convert · workbook tables | XLSX/CSV → PDF | SheetJS + pdf-lib | lazy JS | 15 MB, 40 sheets, 300K cells | Y/Y/—/Y/— | **L**; no Excel print/formula fidelity; local |
| 29 | `ppt-to-pdf` `/ppt-to-pdf/` | PPT to PDF · Convert · faithful presentation conversion | PPT/PPTX → PDF | no suitable renderer | none | unavailable | —/—/—/—/— | **X**; dedicated full renderer/service required; no file transmitted |
| 30 | `pdf-to-text` `/pdf-to-text/` | PDF to Text · Convert · text extraction | text PDF → TXT | PDF.js textContent | PDF.js Worker | page/text budget | Y/Y/Y/Y/— | **L**; scanned pages require OCR; local |
| 31 | `html-to-pdf` `/html-to-pdf/` | HTML to PDF · Convert · controlled reflow | HTML/text → PDF | DOMParser + pdf-lib | JS | input/character budget | Y/Y/—/Y/— | **L**; not a full print/CSS/JS engine; local |
| 32 | `pdf-to-html` `/pdf-to-html/` | PDF to HTML · Convert · safe text HTML | text PDF → HTML | PDF.js + escaped serializer | PDF.js Worker | page/text budget | Y/Y/Y/Y/— | **L**; no exact visual layout; local |
| 33 | `markdown-to-pdf` `/markdown-to-pdf/` | Markdown to PDF · Convert · supported subset | Markdown → PDF | native parser + pdf-lib | JS | text budget | Y/Y/—/Y/— | **L**; extensions/embedded HTML limited; local |
| 34 | `pdf-to-markdown` `/pdf-to-markdown/` | PDF to Markdown · Convert · structural heuristics | text PDF → Markdown | PDF.js | PDF.js Worker | page/text budget | Y/Y/Y/Y/— | **L**; headings/tables heuristic; local |
| 35 | `svg-to-png` `/svg-to-png/` | SVG to PNG · Convert · rasterize vector | SVG → PNG | safe image decode + Canvas | native | target-dimension cap | Y/Y/—/Y/— | **B**; browser SVG support; scripts not executed; local |
| 36 | `png-to-svg` `/png-to-svg/` | PNG to SVG · Convert · raster wrapper | PNG → SVG | FileReader/Data URL + SVG serialization | native | image-size cap | Y/Y/Y/Y/— | **L**; no vector tracing; local |
| 37 | `webp-to-jpg` `/webp-to-jpg/` | WEBP to JPG · Convert · browser codec conversion | WEBP → JPG/PNG | createImageBitmap/Image + Canvas | native | decoded-pixel cap | Y/Y/—/Y/— | **B**; WEBP decoder required; local |
| 38 | `gif-to-png` `/gif-to-png/` | GIF Frame Extractor · Convert · composited frames | GIF → PNG ZIP | custom GIF89a decoder + Canvas + JSZip | JS; optional worker | 120 frames, 24M pixels | Y/Y/—/Y/— | **B**; bounded codec coverage; local |
| 39 | `text-to-speech` `/text-to-speech/` | Text-to-Speech Reader · Utility · spoken playback | text → speech audio playback | SpeechSynthesis | native browser service | browser voice limits | —/Y/Y/—/Y | **L**; voices/availability vary, no audio file; text local in app path |
| 40 | `qr-reader` `/qr-reader/` | QR Code Reader · Utility · decode image | image → text | BarcodeDetector + createImageBitmap | native capability | supported browsers only | —/Y/Y/Y/— | **L**; no bundled ZXing fallback; local |
| 41 | `barcode-reader` `/barcode-reader/` | Barcode Scanner · Utility · decode barcode | image → value | BarcodeDetector + createImageBitmap | native capability | supported formats/browsers | —/Y/Y/Y/— | **L**; platform coverage varies; local |
| 42 | `base64-tool` `/base64-tool/` | Base64 Tool · Utility · encode/decode | text/file/Base64 → Base64/text | TextEncoder, FileReader, atob/btoa | native | memory; Base64 +33% | Y/Y/Y/Y/Y | **B**; large files expand memory; local |
| 43 | `url-tool` `/url-tool/` | URL Encoder/Decoder · Utility · percent conversion | text/URL → text | URI encode/decode APIs | native | low | —/Y/Y/Y/Y | **B**; component semantics; local |
| 44 | `json-tool` `/json-tool/` | JSON Formatter · Utility · pretty/minify | JSON → JSON | JSON.parse/stringify | native | input-memory cap | Y/Y/Y/Y/Y | **B**; strict JSON only; local |
| 45 | `hash-tool` `/hash-tool/` | Hash Generator · Utility · SHA digest | text/file → hex digest | Web Crypto `subtle.digest` | native async | file ArrayBuffer memory | Y/Y/Y/Y/— | **B**; no streaming digest; local |
| 46 | `case-converter` `/case-converter/` | Text Case Converter · Utility · five transforms | text → text | string/regex/Intl | native | low | Y/Y/Y/Y/Y | **B**; language-specific casing varies; local |
| 47 | `word-counter` `/word-counter/` | Word Counter · Utility · counts/read time | text → metrics | Intl.Segmenter + fallback | native | text-memory cap | —/Y/Y/Y/— | **B**; segmentation language differences; local |
| 48 | `lorem-ipsum` `/lorem-ipsum/` | Lorem Ipsum Generator · Utility · placeholder copy | options → text | native generator | native | low | Y/Y/Y/Y/Y | **B**; fixed source vocabulary; local |
| 49 | `diff-checker` `/diff-checker/` | Diff Checker · Utility · highlighted comparison | two texts → diff | project comparison logic | JS | large-text CPU | —/Y/Y/Y/Y | **B**; not optimized for huge inputs; local |
| 50 | `sql-formatter` `/sql-formatter/` | SQL Formatter · Utility · lightweight layout | SQL → SQL | project tokenizer/regex | JS | low | Y/Y/Y/Y/Y | **L**; dialect grammar incomplete; local |
| 51 | `xml-to-json` `/xml-to-json/` | XML to JSON Converter · Utility · tree conversion | XML → JSON | DOMParser + serializer | native | document-memory cap | Y/Y/Y/Y/Y | **B**; mapping conventions/complex XML vary; local |
| 52 | `uuid-generator` `/uuid-generator/` | UUID Generator · Utility · UUID v4 batch | count → UUIDs | crypto.randomUUID/fallback | native | low | Y/Y/Y/Y/— | **B**; v4 only; local |
| 53 | `user-agent` `/user-agent/` | User Agent Parser · Utility · current browser facts | navigator context → report | Navigator/Client Hints | native | low | —/Y/Y/Y/— | **L**; UA reduction limits detail; local |
| 54 | `regex-tester` `/regex-tester/` | Regex Tester · Utility · ECMAScript matching | pattern/flags/text → matches | RegExp | native | pathological CPU risk | —/Y/Y/Y/Y | **B**; ECMAScript syntax only; local |
| 55 | `markdown-editor` `/markdown-editor/` | Markdown Editor · Utility · live preview | Markdown → HTML preview | project safe parser | JS | text/DOM size | Y/Y/Y/Y/Y | **L**; subset/extensions limited; local |
| 56 | `css-beautifier` `/css-beautifier/` | CSS Formatter · Utility · beautify/minify | CSS → CSS | project tokenizer/regex | JS | low | Y/Y/Y/Y/Y | **L**; grammar edge cases; local |
| 57 | `js-beautifier` `/js-beautifier/` | JS Formatter · Utility · beautify/minify text | JS → JS text | project tokenizer/regex | JS; input not executed | text-size cap | Y/Y/Y/Y/Y | **L**; not AST preserving; local |
| 58 | `html-beautifier` `/html-beautifier/` | HTML Formatter · Utility · markup layout | HTML → HTML text | text/DOM formatting | JS | text-size cap | Y/Y/Y/Y/Y | **L**; malformed/embedded languages; local |
| 59 | `cron-generator` `/cron-generator/` | Cron Expression Helper · Utility · build/explain | fields/expression → cron/text | validated project model | JS | low | —/Y/Y/Y/Y | **L**; standard five-field dialect only; local |
| 60 | `color-converter` `/color-converter/` | Color Converter · Utility · HEX/RGB/HSL/CMYK | color → values | math/parser | native | low | —/Y/Y/Y/— | **B**; supported color spaces only; local |
| 61 | `exif-viewer` `/exif-viewer/` | EXIF Metadata Viewer · Utility · inspect/clean | image → metadata/clean image | exifr + Canvas | lazy JS | image/pixel cap | Y/Y/Y/Y/— | **B**; format metadata support varies; sensitive GPS stays local |
| 62 | `timestamp-converter` `/timestamp-converter/` | Epoch Converter · Utility · epoch/date conversion | epoch/date → values | Date + Intl | native | low | —/Y/Y/Y/— | **B**; timezone/date-range constraints; local |
| 63 | `remove-pdf-pages` `/remove-pdf-pages/` | Remove PDF Pages · PDF · selected deletion | PDF + range → PDF | PDF.js preview + pdf-lib | PDF.js Worker | page/thumbnail cap | Y/Y/—/Y/Y | **B**; cannot remove all pages; local |
| 64 | `extract-pdf-pages` `/extract-pdf-pages/` | Extract PDF Pages · PDF · ordered extraction | PDF + range → PDF | PDF.js preview + pdf-lib | PDF.js Worker | page/thumbnail cap | Y/Y/—/Y/Y | **B**; standard pages only; local |
| 65 | `extract-images-pdf` `/extract-images-pdf/` | Extract Images · PDF · embedded raster extraction | PDF → images/manifest ZIP | PDF.js object store + Canvas + JSZip | PDF.js Worker | 30 MB, 100 pages, 12MP/image, 36MP total | Y/Y/—/Y/— | **L**; masks/vectors/private PDF.js cases; local |
| 66 | `crop-pdf` `/crop-pdf/` | Crop PDF · PDF · page-box crop | PDF + crop region → PDF | PDF.js preview + pdf-lib | PDF.js Worker | preview/page cap | Y/Y/—/Y/Y | **B**; adjusts page boxes, not content deletion; local |
| 67 | `header-footer-pdf` `/header-footer-pdf/` | Add Header & Footer · PDF · tokenized text | PDF + settings → PDF | pdf-lib | JS | page cap | Y/Y/—/Y/Y | **B**; built-in font coverage; local |
| 68 | `sign-pdf` `/sign-pdf/` | Sign PDF · PDF · visible signature appearance | PDF + drawn/typed/image mark → PDF | Canvas + pdf-lib | JS | image/page memory | Y/Y/—/Y/Y | **L**; not cryptographic certificate signing; local |
| 69 | `repair-pdf` `/repair-pdf/` | Repair PDF · PDF · normalize readable structure | readable PDF → PDF | pdf-lib load/resave | JS | file-memory cap | Y/Y/—/Y/— | **L**; cannot repair files parser cannot open; local |
| 70 | `ocr-pdf` `/ocr-pdf/` | OCR PDF · PDF · scanned-page text | scanned PDF → TXT | PDF.js + Tesseract.js | PDF Worker + OCR WASM/Worker; first-use assets | 30 MB, 20 pages, 30M rendered pixels | Y/Y/Y/Y/— | **L**; English/text-only/accuracy limits; file local |
| 71 | `image-to-pdf` `/image-to-pdf/` | Image to PDF · Convert · ordered multi-image PDF | JPG/PNG/WEBP → PDF | Canvas normalization + pdf-lib | JS | count/pixel cap | Y/Y/—/Y/Y | **B**; raster pages; local |
| 72 | `png-to-pdf` `/png-to-pdf/` | PNG to PDF · Convert · PNG page embedding | PNG → PDF | pdf-lib | JS | count/pixel cap | Y/Y/—/Y/Y | **B**; raster pages; local |
| 73 | `txt-to-pdf` `/txt-to-pdf/` | TXT to PDF · Convert · plain-text pagination | TXT → PDF | TextDecoder + pdf-lib | JS | text budget | Y/Y/—/Y/— | **B**; plain text/built-in font scope; local |
| 74 | `pdf-to-image` `/pdf-to-image/` | PDF to Image · Convert · raster page batch | PDF → JPG/PNG/ZIP | PDF.js + Canvas + JSZip | PDF.js Worker | DPI/page pixels | Y/Y/—/Y/— | **B**; high-resolution memory; local |
| 75 | `pdf-to-png` `/pdf-to-png/` | PDF to PNG · Convert · lossless page raster | PDF → PNG/ZIP | PDF.js + Canvas + JSZip | PDF.js Worker | DPI/page pixels | Y/Y/—/Y/— | **B**; output size; local |
| 76 | `pdf-to-excel` `/pdf-to-excel/` | PDF to Excel · Convert · table heuristics | text/table PDF → XLSX | PDF.js positions + SheetJS | PDF.js Worker | 30 MB, 100 pages, 200K items | Y/Y/—/Y/— | **L**; complex/scanned tables require recognition; local |
| 77 | `pdf-to-ppt` `/pdf-to-ppt/` | PDF to PPT · Convert · page-image slides | PDF → PPTX | PDF.js + Canvas + PptxGenJS | PDF.js Worker | 30 MB/pages, 30M rendered pixels | Y/Y/—/Y/— | **L**; slides are images, not editable reconstruction; local |
| 78 | `calculator` `/calculator/` | Simple Calculator · Calculator · arithmetic | numbers/operators → result | validated JS math | native | low; all platforms | —/Y/Y/—/Y | **B**; basic arithmetic scope; local |
| 79 | `scientific-calculator` `/scientific-calculator/` | Scientific Calculator · Calculator · advanced math | expression/functions → result | Math + parser | native | low | —/Y/Y/—/Y | **B**; numerical precision conventions; local |
| 80 | `percentage-calculator` `/percentage-calculator/` | Percentage Calculator · Calculator · percentage modes | numbers → results | arithmetic formulas | native | low | —/Y/Y/—/Y | **B**; deterministic inputs; local |
| 81 | `age-calculator` `/age-calculator/` | Age Calculator · Calculator · calendar age | dates → age metrics | Date/calendar logic | native | low | —/Y/Y/—/Y | **B**; timezone/calendar edge cases; local |
| 82 | `date-calculator` `/date-calculator/` | Date Calculator · Calculator · add/difference | dates/duration → result | Date API | native | low | —/Y/Y/—/Y | **B**; locale/timezone rules; local |
| 83 | `emi-calculator` `/emi-calculator/` | EMI Calculator · Calculator · payment breakdown | principal/rate/tenure → EMI/chart | amortization formula + UI | native | low | —/Y/Y/—/Y | **B**; estimate, not financial advice; local |
| 84 | `loan-calculator` `/loan-calculator/` | Loan Calculator · Calculator · amortization | loan inputs → schedule/results | finance formulas | native | table scales with tenure | —/Y/Y/—/Y | **B**; assumptions/rounding; local |
| 85 | `interest-calculator` `/interest-calculator/` | Interest Calculator · Calculator · simple/compound | inputs → interest/results | finance formulas | native | low | —/Y/Y/—/Y | **B**; model assumptions; local |
| 86 | `gst-calculator` `/gst-calculator/` | GST Calculator · Calculator · net/gross/tax | price/rate/mode → result | arithmetic formulas | native | low | —/Y/Y/—/Y | **B**; calculation only, no tax advice; local |
| 87 | `sip-calculator` `/sip-calculator/` | SIP Calculator · Calculator · projected value | contribution/rate/period → estimate | finance formulas | native | low | —/Y/Y/—/Y | **B**; projected, not guaranteed returns; local |
| 88 | `bmi-calculator` `/bmi-calculator/` | BMI Calculator · Calculator · BMI/range | height/weight → BMI | arithmetic formulas | native | low | —/Y/Y/—/Y | **B**; screening estimate, not diagnosis; local |
| 89 | `discount-calculator` `/discount-calculator/` | Discount Calculator · Calculator · sale price/saving | prices/rates → result | arithmetic formulas | native | low | —/Y/Y/—/Y | **B**; deterministic; local |
| 90 | `unit-converter` `/unit-converter/` | Unit Converter · Calculator · measurement conversion | value/units → value | conversion constants | native | low | —/Y/Y/—/Y | **B**; supported unit catalog only; local |
| 91 | `currency-converter` `/currency-converter/` | Currency Converter · Calculator · user-rate conversion | value/currencies/manual rate → value | arithmetic | native | low | —/Y/Y/—/Y | **B**; no live exchange-rate claim; local |
| 92 | `time-calculator` `/time-calculator/` | Time Calculator · Calculator · duration arithmetic | time/duration → result | arithmetic/time logic | native | low | —/Y/Y/—/Y | **B**; duration vs timezone semantics; local |

## Executive summary

- **92 registered tools**: PDF 22, Image 5, Utility/Developer 27, ZIP 2, Convert 21, Calculator 15.
- **91 working client-side workflows** and **one deliberate blocker**.
- Status totals: **59 B**, **3 W**, **29 L**, **1 X**.
- Dedicated Worker workflows: Protect PDF, Unlock PDF, GIF Maker, PDF OCR and Image OCR. PDF.js supplies shared Worker execution to PDF-reading routes.
- No primary file-processing tool depends on a Netlify Function, database, or external conversion API.
- Local processing is the accurate claim; “zero network” is not, because the page and some route-specific engines/assets must load.
