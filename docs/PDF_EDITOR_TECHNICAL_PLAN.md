# Edit PDF technical plan — Phase 4C

Reviewed 2026-10-11. Local implementation only; no deployment authorization.

## Existing stack and licensing

- PDF.js 3.11.174 renders pages through `GxaWorkspace.ensurePdfJs()` and a worker. Apache-2.0: [upstream license](https://github.com/mozilla/pdf.js/blob/master/LICENSE). It provides text extraction, not a round-trip page-content editor.
- pdf-lib 1.17.1 reads/writes the original PDF, handles AcroForms and adds drawing operators. MIT, verified in `node_modules/pdf-lib/LICENSE.md` and [upstream](https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md).
- The existing qpdf WASM wrapper declares ISC; its native qpdf payload is Apache-2.0, verified in `public_html/assets/vendor/qpdf/QPDF-LICENSE.txt` and `WRAPPER-NOTICE.txt`. Both notices must be retained. It is used by existing protection/compression tools, not introduced or replaced here.
- Existing Tesseract.js 7 declares Apache-2.0 ([upstream](https://github.com/naptha/tesseract.js/blob/master/package.json)). OCR language data has separate notices. Reuse the existing lazy worker only after region/coordinate/output fidelity tests.
- No new package, paid SDK, GPL/AGPL engine or server upload is authorized or needed for the first editor increment. Preserve all existing vendor notices.

## Text-editing feasibility

PDF pages contain painting operators, positioned glyph codes, font resources, transformations and potentially nested/shared Form XObjects. Extracted PDF.js strings are not reversible references to an editable paragraph. Embedded subset fonts may lack replacement glyphs. Regex replacement of compressed streams is unsafe.

The installed pdf-lib supports changing AcroForm text, not arbitrary page text removal/editing ([documented limitations](https://github.com/Hopding/pdf-lib#limitations)). Keep genuine existing field editing. General direct text rewriting needs a separately validated content-stream/font engine; do not present a white rectangle as direct editing. A future explicitly named visual-replacement mode must warn that underlying content remains recoverable and that fonts are substituted. No secure-redaction claim is permitted.

## First bounded editor increment

1. In-memory page plan over original bytes: reorder, rotate, duplicate, delete and insert blank. Preserve original page references for untouched pages, dimensions, CropBox and metadata. Protect unsupported form/annotation structures instead of silently discarding them.
2. Extend added-text styling and drawing controls using real PDF operators, with matching preview metrics. Each control must have parsed-output tests.
3. Reuse one progressive main-page renderer and bounded thumbnail rendering. No full-resolution rendering of every page at once.
4. Include page state in undo/redo. No file bytes or signatures in local/session storage. Reset/navigation clears memory.
5. Reopen exports with PDF.js in the browser and pdf-lib in tests, checking pages, fields, appearances, transforms, content and actual downloads.
6. Crop/quarter-turn rotation of inserted images uses a bounded offscreen canvas, writes PNG pixels once, and shares those bytes between preview and PDF export. Preserve the original inserted asset in memory for explicit restore/undo only. Replacement uses the actual file input; no hidden upload. Tests compare decoded PDF image RGB/alpha pixels to browser preview pixels for all four rotations. Editing pre-existing PDF image XObjects remains deferred.

## Forms, OCR and export strategy

Preserve supported text/checkbox/radio/dropdown editing and explicit flattening. Do not copy/delete live form widgets without a valid field-tree strategy. New fields, date formatting, certificate signatures, OCR-region replacement, searchable OCR layers, original image extraction/editing, arbitrary direct text changes and secure redaction remain separate work until independently verified. OCR output must be labeled reconstructed; it must not be described as the original editable text.

The original document is the export base, not a raster rebuild. Added objects follow explicit layer order. Page operations and overlays must validate before serialization; failed exports do not produce success/download state. Existing 25 MB input, 300-overlay and bounded-canvas safeguards remain.

For separate Merge/Split/Organize workflows, pdf-lib page copying is not a live form-tree merger. These tools inspect the raw AcroForm dictionary (including XFA) and reject unsupported live fields rather than silently stripping them. Explicit flattening remains a user decision in Edit PDF; XFA needs an external compatible editor. Split validates each saved PDF by reopening it before ZIP insertion; Organize validates its complete output. They retain page content/boxes/rotation in test fixtures, not a general guarantee of bookmarks, destinations, signatures or tagged structure. No PDF engine or license change is introduced.

## Acceptance and limits

Use synthetic fixtures only in QA, never in public tools or accounts. Test original content preservation, page order/rotation/blank geometry, field-tree preservation and rejected unsafe operations, text metrics, styles, invalid values, undo/redo/reset, mobile/desktop layout and empty ad collapse. A successful Blob is insufficient. The full Phase 4C request is not complete until the remaining P0 workflows and the 95-route feature matrix are verified.
