# GXA Toolbox PDF Studio

## Shared workspace

Existing PDF routes open directly in the shared PDF Studio shell. PDF.js is loaded only after a PDF preview is requested. The desktop viewer uses a left thumbnail rail, central rendered page, sticky action panel, top controls, and bottom status. On phones, thumbnails become a horizontal rail and settings open as a labelled drawer.

Page thumbnails are lazy-rendered and capped at 60 visible thumbnail canvases for large files. Full-resolution pages are rendered one at a time. Page selection is synchronized to the route's real page-range input. The Organize route can drag thumbnail order; the resulting numeric order is passed to the real pdf-lib page-copy operation.

## Route map

| Existing route(s) | Studio mode | Processing/output | Status / limitation |
|---|---|---|---|
| `merge-pdf` | Merge | pdf-lib page copy into a valid PDF | Functional; file queue is reorderable |
| `organize-pdf` | Organize | Visual order/selection, rotation, text watermark, valid PDF | Partial: blank-page insertion and duplication are not exposed |
| `split-pdf` | Split | Every page, grouped ranges, or every N pages into a validated ZIP | Functional |
| `remove-pdf-pages` | Remove | Visual/range selection, valid retained-page PDF | Functional; zero-page output is rejected |
| `extract-pdf-pages` | Extract | Visual/range selection into one valid PDF | Functional |
| `rotate-pdf` | Rotate | Selected/all pages, 90/180/270 degrees | Functional |
| `crop-pdf` | Manual crop | Draggable eight-handle crop overlay mapped to PDF points and `setCropBox` | Functional; shared rectangle applies to selected/all pages |
| `compress-pdf` | Compress | Honest pdf-lib object-stream reserialization | Partial: no image downsampling; no-savings output is rejected |
| `watermark-pdf` | Add Watermark | Text, image/logo, and built-in icon/symbol watermarks; position, opacity, rotation, page targets, and optional tiling | Local `pdf-lib` output; source PDF is unchanged |
| `pagenumber-pdf` | Page numbers | Position, start, prefix, suffix, size, skip first, selection | Functional |
| `header-footer-pdf` | Header/footer | Tokens, alignment, size, selection, valid PDF | Functional; tokens include page, total, date, filename |
| `sign-pdf` | Signature appearance | Typed, drawn, or uploaded raster signature flattened into a selected page | Partial: not certificate signing; fixed placement; annotation shapes are not complete |
| `pdf-metadata` | Metadata | Read existing standard fields; write title, author, subject, keywords | Functional; unsupported fields remain read-only |
| `pdf-to-image`, `pdf-to-jpg`, `pdf-to-png` | PDF raster export | PDF.js pages to JPG/PNG inside ZIP | Functional; fixed route scale rather than arbitrary DPI |
| `image-to-pdf`, `jpg-to-pdf`, `png-to-pdf` | Image to PDF | Reorderable images embedded into valid pages | Functional |
| `pdf-to-text` | Searchable text extraction | PDF.js selectable-text extraction to TXT | Functional for text PDFs; scanned PDFs require OCR |
| `pdf-to-word` | Text/RTF extraction | PDF.js selectable text to TXT/RTF | Partial: does not preserve Word layout |
| `repair-pdf` | Normalize readable PDF | pdf-lib load and reserialize | Partial: cannot recover unreadable/corrupt structures |
| `protect-pdf`, `unlock-pdf` | Password processing | qpdf WebAssembly AES-256 encryption / authorized decryption | Functional in isolated worker; 25 MB browser cap |
| `ocr-pdf` | OCR | PDF.js page stream to Tesseract worker, extracted TXT | Functional with English model download; 20-page/30M-pixel cap; not searchable-PDF output |
| `extract-images-pdf` | Embedded image extraction | Supported PDF.js raster objects to PNG plus manifest ZIP | Functional with limits; masks, vectors, and unusual/private PDF.js objects may not extract |
| `word-to-pdf`, `excel-to-pdf` | Semantic Office import | Mammoth/SheetJS data to paginated PDF | Functional with explicit semantic/table and built-in-font limitations |
| `ppt-to-pdf` | Presentation import | No fabricated output | Faithful PPT/PPTX renderer remains unavailable in this deployment |
| `pdf-to-excel` | PDF text/table export | Positioned-text heuristic to valid XLSX | Functional for selectable text/simple tables; not layout reconstruction |
| `pdf-to-ppt` | PDF slide export | One rendered page image per valid PPTX slide | Functional within page/pixel caps; slides are not editable reconstructions |

## Output validation

Before a successful completion state, local PDF output must have a `%PDF-` header and `%%EOF` trailer. ZIP output must parse through JSZip and contain entries. PDF fixtures additionally verify expected page counts, while live browser tests open generated output with the existing PDF.js viewer.

## Genuine remaining scope

Continuous virtualized full-page scrolling, custom named split groups, image watermark positioning, arbitrary annotation objects, editable bookmarks, certificate-based signatures, native Word/Excel/PPT layout fidelity, searchable-PDF OCR layers, and complete extraction of every PDF image/mask/vector type remain genuine limitations. No placeholder controls or fabricated output are shown for these capabilities.
