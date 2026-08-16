# Performance and Mobile Audit

## Payload snapshot

| Asset group | Approximate raw size | Load behavior |
|---|---:|---|
| Main local JavaScript | 760,406 B | Initial public shell modules |
| Main CSS | 210,407 B | Initial render stylesheet |
| Main local JS + CSS | **970,813 B** | Before compression |
| `assets/app.js` alone | 607,212 B | Monolithic core runtime |
| Background Remover JS | 386,137 B | Dedicated route only |
| Background Remover CSS | 22,138 B | Dedicated route only |
| ORT asyncify WASM | 24,254,953 B | Background processing asset |
| U2NetP ONNX model | 4,574,267 B | Background processing asset |

Initial third-party scripts also include pdf-lib, JSZip and Lucide. PDF.js, QR/barcode, exifr, Cropper, html2canvas, Mammoth, SheetJS, Tesseract, PptxGenJS, qpdf and GIF components are lazy/route/action loaded.

## Performance strengths

- Heavy Background Remover assets are isolated from the homepage.
- PDF.js uses a Worker and is loaded only for PDF-reading workflows.
- qpdf, GIF encoding and Tesseract use dedicated Workers for responsiveness.
- Generated route shells are cacheable static files.
- Hashed Background Remover bundles and large runtime assets have explicit caching rules.
- Several PDF/OCR/PPT paths process pages sequentially instead of retaining every page canvas.
- Route-specific size, page, pixel, sheet, cell and character limits exist.

## Risks and opportunities

1. The main app/style surface is large for mobile and `app.js` remains monolithic.
2. Global remote scripts delay startup and increase supply-chain/network dependency.
3. Google Fonts requests a broad family/weight surface; reduce to used weights or self-host subsets.
4. Main stable filenames rely on explicit cache/version handling rather than content hashes.
5. Worker/WASM/model assets can take significant download and compile time on low-end devices.
6. Canvas RGBA memory, archive expansion, workbook parsing and output duplication can exceed mobile memory even when source files look modest.
7. Model/runtime files with long immutable caching require content-hashed names when replaced.

## Resource caps verified

- Generic file cap: 100 MB.
- Crop Image: 50 MB.
- Image OCR: 20 MB and 24 megapixels.
- Background Remover: 30 MB and 48 megapixels.
- qpdf Protect/Unlock: 25 MB.
- OCR PDF: 30 MB, 20 pages and 30M rendered pixels.
- Extract Images: 30 MB, 100 pages, 12MP/image and 36MP total.
- PDF to Excel: 30 MB, 100 pages and 200K positioned items.
- PDF to PPT: 30 MB/page budget and 30M rendered pixels.
- Word: 25 MB and 5M characters.
- EPUB: 30 MB, 500 spine items and 5M characters.
- Excel: 15 MB, 40 sheets and 300K cells.
- GIF workflows: 24M total pixels; frame extractor also caps at 120 frames.

## Responsive verification

| Area | Desktop/laptop | Tablet | Mobile |
|---|---|---|---|
| Header/navigation | Full brand and mega menus | Compact/hybrid | Full “GXA Toolbox” brand + search/theme/drawer |
| Tool directory | Multi-column cards | Adaptive columns | Single/adaptive compact cards and scroll/wrap categories |
| Search | Wide field | Full available width | 100% width, labelled, no icon-placeholder overlap |
| Tool workspace | Preview with side/tool panels where useful | Hybrid | Stacked preview and bottom/inline controls |
| Upload | Drop + file picker | Touch/file picker | Native file input remains primary action |
| Modals | Centered | Bounded | Viewport-bounded sheet/internal scrolling architecture |
| Background Remover | Canvas + desktop panels | Hybrid | Canvas + bottom toolbar/sheets |
| Dashboard/admin | Multi-panel | Responsive | Stacked forms/cards |

Rendered local verification was performed at 1366×768 and 390×844 for representative home, PDF, OCR, Background Remover and admin pages. No document/body horizontal overflow was detected. At 390 px, the opened drawer exposed all major navigation and account/support actions and locked body scrolling.

The repository contains responsive contracts and prior target coverage for 320–1440 widths, but this audit did not manually render every requested size or exercise every touch gesture. The following remain manual QA requirements: 1920×1080, 1536×864, 768×1024, 360×800, soft-keyboard behavior, pinch/pan/crop/erase gestures, real downloads and low-memory devices.

## Priority performance work

1. Split core `app.js` by route/category while retaining registry/static-route behavior.
2. Render the initial shell before optional auth/session network completion.
3. Pin/self-host initial CDN libraries and reduce global libraries to homepage needs.
4. Add performance budgets for compressed JS/CSS, model fetch, LCP, INP and memory-heavy fixture runs.
5. Add a real browser performance suite on representative mobile hardware profiles.
