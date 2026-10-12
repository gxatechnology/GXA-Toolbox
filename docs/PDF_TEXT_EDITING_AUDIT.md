# Edit PDF text engine audit

2026-10-12. Local only. Scope: Edit PDF; existing shared tool engines and routes remain intact.

## Existing stack and findings

- `pdf-edit.js` renders original/preview pages through the shared PDF.js loader, previously exposing only AcroForm controls and added overlays. PDF.js `getTextContent()` supplies text runs, text matrices, width, height, direction and a font-name lookup. Its font styles expose ascent/descent and approximate family; these are not editable original font programs or a mapping back to stream offsets.
- `pdf-edit-core.js` uses pdf-lib to load/rewrite documents, preserve page geometry, update forms, organize pages and draw overlays. pdf-lib exposes decoded raw streams and resource dictionaries, but no general native page-text editor. Text fields are not ordinary page text.
- Font size/rotation/coordinates are recoverable from PDF.js matrices for hit targets. Color, spacing, glyph encoding, text state and embedded/subset font reuse need original PDF operators/resources. A subset cannot safely encode arbitrary new characters just because its existing text is extractable.
- Broad search/replace of decoded stream text would corrupt strings, kerning arrays, encodings or unrelated shared streams. A white cover plus new text is visual replacement, not native editing or secure redaction.

## Bounded implementation

`pdf-text-core.js` adds a tokenized, conservative native path: one printable ASCII Tj run per BT/ET block, explicit Tf and orthonormal Tm, one of twelve non-embedded standard Type1 fonts with compatible encoding. Existing token bytes are replaced in a new page-local stream; font resource, matrix, color and all untouched operators remain. Unknown state, transforms, custom/subset/CID/Type3 fonts, character spacing, text clipping, graphics states, marked content, inline images and multi-show/kerning blocks are declined. Unsupported pages remain available for explicit visual replacement. This is PARTIAL native support, not arbitrary PDF editing or paragraph reflow.

The Edit Text controller uses PDF.js regions and uniquely matches an eligible run's text/baseline to the original parsed stream. It does not assume extracted Unicode alone proves native editability. Native replacements are validated again against the original page plan on every export.

Visual replacement uses a separately retained mask and a normal editable text overlay. It preserves the original underlying content; the UI warns that copying/searching can still recover it. Standard-font substitutes are disclosed. OCR runs only on explicit request, on one bounded rendered page, with English Tesseract blocks; image-only regions are labeled OCR visual replacement, never native text. Worker/model resources download on demand; page pixels stay in the browser. Text never enters analytics or storage.

## References

- [pdf-lib limitations](https://github.com/Hopding/pdf-lib#limitations): no general native text editing API outside fields.
- [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/api.js.html): text-content items and font styles.
- [Tesseract API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md): recognize output options and worker lifecycle. Blocks must be explicitly requested.

## Implemented capability and limits

| Requirement | Result |
|---|---|
| Edit Text toolbar, selectable bounds, Apply/Cancel | YES |
| Native existing-text editing | PARTIAL: guarded ASCII/standard-font objects only |
| Explicit visual replacement | YES: fixed original-region cover plus editable replacement |
| OCR replacement | YES: real English OCR line regions, visual replacement |
| Font preservation | PARTIAL: original standard font on native path; disclosed substitute otherwise |
| Undo/redo | YES: native state and visual replacements |
| Export/reopen | PASS in native, subset-font visual, rotated, multipage, scanned and mixed-image fixtures |

Native replacements preserve the original font resource, size, color and text matrix, not paragraph alignment/reflow. Longer text can overlap neighbouring content and must be reviewed. Embedded/subset fonts, glyph positioning arrays, custom encodings, transformations/graphics states, clipping and marked content are deliberately not guessed. Page-level conservative rejection can decline otherwise simple text on a page containing complex unrelated painting operators. Native replacement is also **not secure redaction**: unused original stream objects can remain in the file.

Visual replacement uses a solid, user-selected cover color, not background reconstruction. Original text is still extractable and original scan pixels remain. Replacement text has editable position, dimensions, alignment, color and standard bold/italic fonts. It does not reproduce arbitrary typography or complex Unicode shaping. Rotation of the original native text is preserved; rotated visual fallback needs manual layout review.

Limits: 25 MB source, 500 planned pages, 300 overlays and 300 native replacements; native inspection caps decoded page streams at 4 MB and 200,000 tokens. Selection shows at most 1,500 PDF text regions or 1,000 OCR lines per page. OCR renders up to 8 MP and has bounded initialization/recognition timeouts. Cancellation races pending work and clears the temporary canvas; a not-yet-initialized Tesseract worker can only be terminated when its public handle becomes available. No page pixels are sent to that worker after cancellation.

The browser evidence is installed Chrome with emulated touch, not physical Android/iOS or Firefox/Safari certification. English OCR depends on model downloads and scan quality. This is a usable bounded implementation, not completion of every deferred Phase 4C feature.

## Files changed for this Edit PDF continuation

- `public_html/assets/pdf-text-core.js` (new): tokenized native safety checks and stream replacement.
- `public_html/assets/pdf-text-editor.js` (new): selection, draft/apply/cancel, visual fallback, OCR lifecycle.
- `public_html/assets/pdf-edit-core.js`: native export integration, cover rendering, native-before-form-flatten sequencing.
- `public_html/assets/pdf-edit.js`: toolbar, native history/page remapping, masks/properties, lifecycle integration; corrected the existing preview scroll helper's browser-global reference.
- `public_html/assets/pdf-edit.css`: scoped text selection/properties styling.
- `public_html/assets/app.js`: Edit PDF description and lazy module loading only in this continuation.
- `public_html/assets/tool-content.js`: Edit PDF capabilities, limitations, privacy and FAQ only.
- `tests/pdf-text-editing.mjs`, `tests/pdf-text-editing-browser.mjs` (new): native/export, fallback, OCR, failure recovery, responsive and keyboard coverage.
- `tests/edit-pdf-contract.mjs`: current truthful copy, route-lazy modules and text-state reset assertion.
- `package.json`: include native contracts in the existing test chain and add `test:pdf-text:browser`.
- `scripts/audit-phase4c.mjs`: maintain the updated Edit PDF matrix row at its source.
- `docs/PDF_TEXT_EDITING_AUDIT.md`, `docs/PDF_EDITOR_TECHNICAL_PLAN.md`, `docs/ADVANCED_TOOLS_PHASE4C.md`, `docs/ADVANCED_TOOL_FEATURE_MATRIX.md`.
- `docs/ADSENSE_CONTENT_AUDIT.md`: build-generated Edit PDF word-count change only.

Earlier uncommitted ad/workspace-layout changes were preserved, not expanded into other tools. No new dependencies, backend, database, environment variables, publication-policy changes or external settings. Nothing committed, pushed or deployed.

Validation command results and QA artifact locations are in `ADVANCED_TOOLS_PHASE4C.md`.
