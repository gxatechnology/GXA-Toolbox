# Engine and Technology Stack

## Processing-engine inventory

Counts below are primary/workflow counts, not exclusive library-usage totals; one tool can use several engines.

| Engine | Version | License | Purpose / representative tools | Class | Bundle/load model | Network/privacy/mobile |
|---|---|---|---|---|---|---|
| Native browser APIs | browser | Platform | Calculators, text tools, Web Crypto, SpeechSynthesis, FileReader, DOMParser, Intl/Date | Browser | Built in | Local; capability differences apply |
| Canvas / ImageData / createImageBitmap | browser | Platform | Image resize/compress/crop/color, PDF raster outputs, signatures | Browser | Built in | Decoded pixels dominate memory; mobile caps matter |
| pdf-lib | 1.17.1 | MIT | PDF creation, page copy, edits, metadata, watermark, numbering | Browser JS | Initial CDN on main shell | File stays local; CDN needed if uncached |
| PDF.js | 3.11.174 | Apache-2.0 | PDF preview, rendering and text/position extraction | Worker JS | Route-lazy CDN + worker | Local document; page rendering can be memory-heavy |
| JSZip | 3.10.1 | MIT OR GPL-3.0-or-later | ZIP create/extract, multi-output archives, EPUB packaging | Browser JS | Initial CDN | Local; expanded-size/ZIP-bomb budgets required; license choice needs review |
| qpdf + qpdf WASM wrapper | wrapper 0.3.0 | Apache-2.0 / ISC | Protect PDF, Unlock PDF | Worker + WASM | Route-lazy local vendored assets | 25 MB cap; WASM filesystem duplicates buffers; local |
| ONNX Runtime Web | declared 1.23 / resolved and BG 1.27 | MIT | Background Remover inference | WASM/WebGPU | Dedicated BG bundle; local runtime/model | ~24.3 MB WASM + ~4.6 MB model; heavy mobile memory |
| U2NetP model | project asset | Model license requires confirmation | Foreground segmentation | ML model | Local route asset | No image upload; model provenance/license needs retained documentation |
| Tesseract.js | 7.0 | Apache-2.0 | Image OCR, PDF OCR | Worker + WASM | Route lazy; core/lang fetched first use | Image/PDF local; external runtime/data availability required |
| Mammoth | 1.12.1 | BSD-2-Clause | DOCX semantic text extraction | Browser JS | Vendored/lazy | No Word pagination; local file |
| SheetJS CE | vendored | Apache-2.0 | XLSX/CSV read and XLSX generation | Browser JS | Vendored/lazy | Large workbook memory; no Excel print fidelity |
| PptxGenJS | vendored | MIT | PDF-page images to PPTX | Browser JS | Vendored/lazy | Local; produces image slides, not editable reconstruction |
| gifenc | 1.0.3 | MIT | Animated GIF encoding | Worker JS | Vendored/lazy | 24M-pixel cap; local |
| Custom GIF87a/GIF89a decoder | project code | Project | GIF frame extraction/disposal composition | Browser JS | Route-local | Local; 120-frame/24M-pixel cap |
| Cropper.js | pinned runtime source | MIT | Manual Crop Image UI | Browser JS | Lazy CDN with fallback | Touch-capable; local image |
| QRCode.js / JsBarcode | runtime libraries | MIT | QR and barcode generation | Browser JS | Lazy/runtime | Local payload |
| BarcodeDetector | browser | Platform | QR and barcode reading | Browser capability | Built in | Local; limited browser availability |
| exifr | runtime library | MIT | EXIF/GPS metadata extraction | Browser JS | Lazy CDN | Local; metadata may be sensitive |
| html2canvas | 1.4.1 | MIT | Selected visual capture/export flows | Browser JS | Lazy CDN | Can be memory-intensive |
| React / React DOM | 19.2.8 | MIT | Background Remover UI | Client framework | Dedicated route bundle | Not loaded by main app |
| Zustand | 5.0.14 | MIT | Background Remover state | Client library | Dedicated route bundle | Local state |
| Netlify Identity | 1.2.0 | MIT | User auth/recovery/invitation/JWT | Hosted identity + client | Public auth client | Network required; credentials handled by provider |
| Netlify Functions | platform | Platform | Profile/history/admin/tool-event APIs | Serverless | On request | Metadata reaches server/database; files do not in verified paths |
| `@netlify/database` | 1.1.0 | MIT | Tagged-SQL PostgreSQL access | Server | Function bundle | Server-side data only |

## Totals

| Metric | Result |
|---|---:|
| Fully working browser classification | 59 |
| Fully working WASM classification | 3 |
| Browser-limited working classification | 29 |
| Blocked | 1 |
| Working client-side workflows | 91 |
| Dedicated Worker workflows | 5 |
| Serverless file-processing workflows | 0 |
| Database-backed product features | Profiles, history/jobs, analytics/events and admin aggregates; not file bytes |
| AI/ML workflows | 3: one segmentation tool + two OCR workflows |

## Initial versus on-demand payload

Initial main-shell local assets total approximately **970,813 raw bytes**: about 760,406 bytes of local JavaScript and 210,407 bytes of CSS. Remote global scripts include pdf-lib, JSZip and Lucide. Background Remover is isolated from the main shell. PDF.js, QR/barcode, exifr, Cropper, html2canvas, Mammoth, SheetJS, Tesseract, PptxGenJS, qpdf and GIF Worker components are route/action loaded.

The Background Remover's built application is approximately 386 KB JS and 22 KB CSS before compression. Its largest runtime assets—approximately 24.3 MB WASM and 4.6 MB ONNX model—are processing assets, not normal homepage preloads.

## License note

This inventory is not legal advice. JSZip's dual license selection, U2NetP model provenance/license, Tesseract language data, Google Fonts and all vendored attribution files should be confirmed and preserved before commercial redistribution.
