# Edit PDF technical plan — Phase 4C

Reviewed 2026-10-11; Edit Text continuation 2026-10-12. Local implementation only; no deployment authorization.

## Existing stack and licensing

- PDF.js 3.11.174 renders pages through `GxaWorkspace.ensurePdfJs()` and a worker. Apache-2.0: [upstream license](https://github.com/mozilla/pdf.js/blob/master/LICENSE). It provides text extraction, not a round-trip page-content editor.
- pdf-lib 1.17.1 reads/writes the original PDF, handles AcroForms and adds drawing operators. MIT, verified in `node_modules/pdf-lib/LICENSE.md` and [upstream](https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md).
- The existing qpdf WASM wrapper declares ISC; its native qpdf payload is Apache-2.0, verified in `public_html/assets/vendor/qpdf/QPDF-LICENSE.txt` and `WRAPPER-NOTICE.txt`. Both notices must be retained. It is used by existing protection/compression tools, not introduced or replaced here.
- Existing Tesseract.js 7 declares Apache-2.0 ([upstream](https://github.com/naptha/tesseract.js/blob/master/package.json)). OCR language data has separate notices. Reuse the existing lazy worker only after region/coordinate/output fidelity tests.
- No new package, paid SDK, GPL/AGPL engine or server upload is authorized or needed for the first editor increment. Preserve all existing vendor notices.

## Text-editing feasibility

PDF pages contain painting operators, positioned glyph codes, font resources, transformations and potentially nested/shared Form XObjects. Extracted PDF.js strings are not reversible references to an editable paragraph. Embedded subset fonts may lack replacement glyphs. Regex replacement of compressed streams is unsafe.

The installed pdf-lib supports changing AcroForm text, not arbitrary page text removal/editing ([documented limitations](https://github.com/Hopding/pdf-lib#limitations)). The new `pdf-text-core.js` adds a deliberately narrow tokenizer/resource validator on top of its low-level stream API. Only uniquely matched, simple ASCII Tj objects with explicit standard Type1 font/size and orthonormal text matrix qualify. It replaces only the string token in a new page-local referenced stream; original color/font/geometry operators are unchanged. Unsupported states and fonts fail closed into explicit visual replacement. See `PDF_TEXT_EDITING_AUDIT.md` for exact boundaries.

Visual replacement and English OCR-region replacement are now available. Both warn that original content remains recoverable and standard fonts are substituted. Neither a cover nor native stream rewriting is secure redaction: unused source objects may remain serialized. General native editing, font subsetting and paragraph reflow are not implemented.

## First bounded editor increment

1. In-memory page plan over original bytes: reorder, rotate, duplicate, delete and insert blank. Preserve original page references for untouched pages, dimensions, CropBox and metadata. Protect unsupported form/annotation structures instead of silently discarding them.
2. Extend added-text styling and drawing controls using real PDF operators, with matching preview metrics. Each control must have parsed-output tests.
3. Reuse one progressive main-page renderer and bounded thumbnail rendering. No full-resolution rendering of every page at once.
4. Include page state in undo/redo. No file bytes or signatures in local/session storage. Reset/navigation clears memory.
5. Reopen exports with PDF.js in the browser and pdf-lib in tests, checking pages, fields, appearances, transforms, content and actual downloads.
6. Crop/quarter-turn rotation of inserted images uses a bounded offscreen canvas, writes PNG pixels once, and shares those bytes between preview and PDF export. Preserve the original inserted asset in memory for explicit restore/undo only. Replacement uses the actual file input; no hidden upload. Tests compare decoded PDF image RGB/alpha pixels to browser preview pixels for all four rotations. Editing pre-existing PDF image XObjects remains deferred.

## Forms, OCR and export strategy

Preserve supported text/checkbox/radio/dropdown editing and explicit flattening. Do not copy/delete live form widgets without a valid field-tree strategy. New fields, date formatting, certificate signatures, searchable full-page OCR layers, original image extraction/editing, arbitrary direct text changes and secure redaction remain separate work. The implemented English OCR-region path renders one bounded page (up to 8 MP), downloads the existing Tesseract worker/model on demand, requests real blocks/line boxes, and labels replacements as visual OCR text, not original native text.

Native edits join the in-memory undo/page-plan state. Visual replacements reuse ordinary editable overlays with a separate fixed original-region cover; moving/deleting/resizing/styling/undo reuse existing controls. Text regions offer keyboard-focusable buttons plus a large labeled region selector for touch. Zoom/layout changes preserve text drafts. Reset/navigation discards original bytes, native-region caches, OCR results and text drafts. OCR cancellation stops an initialized worker; Tesseract exposes its worker handle only after model initialization, so a cancelled pending initialization is discarded/terminated on resolution before any page pixels are submitted. CDN download failure is reported without disabling editing.

The original document is the export base, not a raster rebuild. Added objects follow explicit layer order. Page operations and overlays must validate before serialization; failed exports do not produce success/download state. Existing 25 MB input, 300-overlay and bounded-canvas safeguards remain.

For separate Merge/Split/Organize workflows, pdf-lib page copying is not a live form-tree merger. These tools inspect the raw AcroForm dictionary (including XFA) and reject unsupported live fields rather than silently stripping them. Explicit flattening remains a user decision in Edit PDF; XFA needs an external compatible editor. Split validates each saved PDF by reopening it before ZIP insertion; Organize validates its complete output. They retain page content/boxes/rotation in test fixtures, not a general guarantee of bookmarks, destinations, signatures or tagged structure. No PDF engine or license change is introduced.

## Acceptance and limits

Use synthetic fixtures only in QA, never in public tools or accounts. Test original content preservation, page order/rotation/blank geometry, field-tree preservation and rejected unsafe operations, text metrics, styles, invalid values, undo/redo/reset, mobile/desktop layout and empty ad collapse. A successful Blob is insufficient. The full Phase 4C request is not complete until the remaining P0 workflows and the 95-route feature matrix are verified.

## Edit Text validation outcome - 2026-10-12

Edit Text: **YES**. Native existing text: **PARTIAL**. Visual replacement: **YES**. English OCR-region replacement: **YES**. Font preservation: **PARTIAL**. Undo/redo: **YES**. Export/reopen: **PASS**.

Lint, full tests and production build exit 0. New native/visual/OCR browser tests, the 13-group advanced Edit PDF suite and existing Edit PDF browser suite pass. Eight widths (320 through 1440), keyboard/touch, real subset fonts, scans, rotation, images/annotations and output extraction/rendering were checked. Native edits coexist with explicit supported-form flattening by applying stream edits before new form appearance streams. `ADVANCED_TOOLS_PHASE4C.md` records exact commands, artifacts and limitations. Native and visual paths are both non-redaction workflows; no arbitrary embedded-font/Unicode/reflow claim is made.
