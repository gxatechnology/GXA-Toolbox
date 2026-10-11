# Advanced tools Phase 4C — verified PDF increments, IN PROGRESS

Date: 2026-10-11. Local repository only. No commit, push or deployment. This is **not** completion of Phase 4C or its P0 gate.

## Counts and scope

- Registry inventoried: 95 routes. Existing core descriptions, engines, prior output evidence, limitations and remaining advanced-review work are listed in `ADVANCED_TOOL_FEATURE_MATRIX.md`.
- Tools materially upgraded so far: **4 (Edit PDF, Merge PDF, Split PDF, Organize PDF)**.
- Tools certified fully advanced under the complete request: **0**.
- Partially advanced tools with bounded increments: **4**.
- Other tools awaiting advanced review/upgrade: **91**. This is not a count of broken tools.
- Indexable tool pages: **81**. Ads-eligible tools: **81**. Noindex/ad-free tools: **14**. Unchanged; no inferred quality promotions.

The prior Phase 4A ledger had 68 routes with selected output evidence, not 68 complete certifications. That evidence is retained with its limitations and dates; route-loading tests are not relabeled as real-output verification.

## Audit findings and implementation

1. The existing Edit PDF engine was a real form/overlay editor, not an arbitrary static-text editor. Its page strip used numbers only, without thumbnails or page editing. Added a page plan against original bytes, with early validation, sequential small thumbnails near the visible strip, and real reorder/rotate/duplicate/delete/blank-page output.
2. Existing AcroForm data and widgets must not be silently orphaned. Reordering/rotating keeps original page references; duplication/deletion of pages with annotations is rejected. Supported forms can first be explicitly exported flattened and reopened. Untouched original painting operators, page dimensions and CropBox are preserved in tests. Deletion is **not** secure erasure; orphan object data, bookmarks and links are not scrubbed.
3. Basic text/shape controls lacked requested style depth. Added 12 standard font variants (bold/italic combinations), text underline and line spacing, object opacity, ellipse/line/arrow/highlight/underline/strike area marks, shape fill/stroke width, overlay front/back ordering and duplication. Each added setting has an actual parsed-PDF regression; browser controls produce downloadable/reopened output.
4. Page changes were absent from undo/redo. The history now includes the lightweight page plan and remaps overlays when pages move/duplicate/delete. Original bytes remain one in-memory source; no autosave, new local-storage writes, account mutations or reusable signature persistence.
5. Advanced controls are under native details disclosures after input. The existing shell/design system, forms, visual signatures, downloads and mobile architecture are preserved. Keyboard page movement is explicit rather than a mouse-only drag interaction.
6. Inserted PNG/JPEG images now have percentage crop, 0/90/180/270-degree clockwise rotation, replacement and restore-original actions. Preview and export use the same transformed PNG pixels, including alpha. A replacement preserves placement, opacity and paint order; resizing preserves its new aspect ratio. Source pixels remain in memory for undo; no storage/upload is added. Pixel-by-pixel reopened PDF tests verify each rotation and transparency, invalid operations, restore and undo/redo. These controls do not extract or edit images embedded in the original PDF.
7. Merge PDF previously copied complete documents only and did not reopen its output. Added per-file page selections (including omissions and explicit duplicates), relative quarter-turn rotation, a 2,000-output-page memory bound and page-count reopen validation. Settings use in-memory File identity rather than filename/index, so same-name files retain their own selections through queue changes and history snapshots. Empty, invalid, encrypted and structurally malformed inputs fail clearly. Output names always have a PDF extension.
8. The merge engine does not preserve live field trees across documents. It now rejects AcroForm/XFA sources instead of silently losing behavior. Explicitly flatten supported AcroForms in Edit PDF first; XFA needs an external compatible editor. This is a disclosed safety restriction, not full form-merge support. Existing digital signatures, cross-document bookmarks and tagged-PDF structures are not certified.
9. Visual review found shared PDF preview toolbar text shrinking into adjacent controls on mobile. Legacy studio-page selectors did not match the current shared preview shell. Added a component-specific `pdf-preview-controls` class: children retain intrinsic label width, with 44px buttons inside the existing scrollable toolbar. The first selector-only attempt failed the strengthened test and was corrected; the new check passes all eight populated widths. No page-wide overflow hiding was added.

## PDF editor limitations / deferred work

### Split / Organize continuation

- Split previously treated an unknown mode as range mode and did not reopen generated PDFs. It now validates modes, integer N, physical ranges and non-empty groups. Legacy comma-separated ranges retain their meaning; semicolons allow ordered non-contiguous/repeated selections within an output (`3,1,1;2-4`). A textual file/page plan uses the same planner as export and can navigate to each group's first source page. This is explicitly not a rendered final-output preview.
- Organize previously silently dropped invalid blank counts/positions and replaced source rotation. It now rejects invalid values, adds quarter turns to a specified set of source pages, preserves existing orientation, and validates output page count by reopening. Repeated copies have independent page dictionaries, avoiding duplicate watermarks from pdf-lib's shared-copy cache.
- Reordering the first 60 thumbnails previously discarded later pages. Visual reordering now retains the full document tail, and retains manually entered duplicate/omitted selections. Alt+Left/Right provides keyboard movement. A disclosed first-60 thumbnail limit remains; Next and text selections cover later pages.
- Native touch QA exposed lost pointer capture on thumbnail DOM moves and scroll-snap/anchoring target shifts. Reordering now keeps the original drag target, restores capture after actual moves, retains scroll position, suspends snapping during the gesture and rolls cancelled gestures back. Horizontal gestures reorder while vertical gestures can scroll. Split plan input listeners are detached when replacing/resetting previews; stale detached PDF loads are abandoned.
- Browser QA found no repeat-processing action after export and stale preview/settings after reset. Split/Organize now have an explicit **Adjust settings** button, retaining input/options but revoking the previous downloadable result. **Start Over** rerenders their clean workspace. Other tools' reset architecture is unchanged.
- Shared page-copy safety: 25 MB input (validated before preview as well as at processing), 2,000 source/output pages, maximum 500 split files, N=1–500, 4,000-character range limit, and 0–50 inserted blanks. Malformed/encrypted sources fail clearly. AcroForm/XFA sources are rejected, not silently flattened; users may explicitly flatten supported forms in Edit PDF. Blanks use unrotated media dimensions, have no watermark; optional watermark text is standard Latin-script only.
- Remaining limits: no certified document-level bookmarks/destinations/tag structure/signatures or live form-tree preservation; no secure redaction; no final-plan rendering, per-copy independent rotation UI, cancellable worker ZIP export or physical-device certification. No new engine, license, backend, environment variable or schema change.

Continuation validation: the fresh production build (including lint and full tests) passed with exit 0. Source/dist byte hashes match for all four changed production assets. All 46 advanced PDF browser groups and the existing Edit PDF browser suite pass. See the validation log and release limitations below; Phase 4C remains incomplete.

### Edit PDF

See `PDF_EDITOR_TECHNICAL_PLAN.md` for installed engines, upstream license references and feasibility.

- Arbitrary original text-stream rewriting, font-subset reuse, recovered text colors and original paragraph reflow: not implemented. Direct changes to supported real AcroForm fields remain supported. No rectangle is presented as direct editing.
- Explicit selected-text visual replacement, OCR-derived region overlays/searchable layers, editing original embedded images, freehand markup, sticky notes/comments, new form fields and certificate signatures: pending.
- Rotate a page before adding overlays on it; this increment refuses to rotate existing overlay geometry rather than silently misplacing it. Other page operations preserve/remap overlay page associations.
- Existing 25 MB input and 300-overlay limits; now reject more than 500 source/planned pages explicitly. Thumbnails are at most 96×124 pixels and render sequentially, separate from the capped main-page canvas.
- Inserted image source/edited files are limited to 5 MB and 16 megapixels. Cropping/rotation re-encodes the inserted pixels as PNG. Original-image restore is in-memory only. This is not an arbitrary source-PDF image editor or a secure-redaction workflow.
- Standard Latin-script fonts only; no arbitrary Unicode shaping, exact original-font substitution guarantee or secure redaction. Added drawing marks are PDF painting operators, not editable native comment annotations.
- Deletion/duplication of annotated pages is deliberately restricted. Bookmarks/links referencing deleted pages require review. Untouched content preservation is not a claim of full PDF/A, tagged-PDF or signature conformance.

## Remaining P0 and other families

Finish the outstanding Edit PDF features where safely feasible and remaining Merge/Split/Organize fidelity work, then Compress, Protect/Unlock, OCR and Office conversions, image-to-PDF, image editors and Background Remover. The full route-specific queue is in the 95-row matrix. No tool route has been disabled or removed.

Faithful Office layout/pagination and arbitrary source-PDF content editing may require a separately reviewed rendering service or SDK. No new server upload, paid library, GPL/AGPL engine or commercial licensing dependency has been added. No feature is claimed to require a paid engine exclusively; permissive alternatives still need capability/license/output evaluation. Existing qpdf and OCR remain in place.

## Advertising, privacy and publication

Central `adsterra` / `adsense` / `off` switch, seller authorization, GTM/GA4 identifiers, publication gates, SEO metadata architecture, authentication, database, admin and tool analytics are unchanged. Tests block live ad requests. Fixtures live only in ignored QA output, not production content.

Existing hidden/loading/failed ad candidates must have zero visible container height/border/placeholder text. The editor remains entirely separate from the after-guide ad placement. Browser failure/no-fill and three-network contracts are rerun, not bypassed.

## Validation log

- `npm run test:phase4c`: passed. Real reopened PDFs verify page plan, content/CropBox/rotation, independent duplicate pages, blank dimensions, invalid plans, preserved form values/widget page mapping, guarded annotation deletion/duplication, 12 font variants, line spacing/underline, opacity, fill/stroke and paint order. Merge tests verify selected/repeated pages, relative rotations, reverse order, default all-pages behavior, MIME/reopen, malformed/encrypted/form sources and memory bounds; image crop geometry has boundary tests.
- `tests/pdf-page-tools-advanced.mjs`: passed, 5 grouped real-engine checks. ZIP CRC/entry names, all three split modes, overlapping/non-contiguous/repeated groups, preserved operators/CropBox/rotation, targeted relative rotations, independent repeated-page watermark, blank geometry/position, MIME, invalid/missing/oversized/corrupt/encrypted/AcroForm/XFA inputs and page/file limits. The previous 15 real PDF output checks also pass with no assertion removed.
- `npm run test:edit-pdf:browser`: passed. Existing real AcroForm values/appearances/flattening, text/date/check/signatures/images, touch drag, undo/redo, zoom, UserUnit/widget rotation, invalid files and reset privacy; eight widths.
- Edit PDF browser: passed, 13 grouped checks. Real downloads/reopen, page management/history, form restrictions/reordering, advanced styles and marks, actual paint-order changes, inserted-image crop/rotation/replacement/restore/alpha, 320/360/375/390/412/430/768/1440 populated layouts, keyboard add/undo, invalid input/reset/retry. Export rendered through PDF.js and image inspected.
- Final `npm run test:phase4c:browser`: **passed, exit 0; 46 grouped checks** (13 Edit PDF + 10 Merge + 23 Split/Organize). Merge includes toolbar labels, picker/processing/download/reopen, duplicate filenames, touch/keyboard reorder, per-file selection/rotation and reset/retry. Split/Organize verify native file-picker hooks, oversized rejection before preview, every-page/every-N/custom ZIP outputs, plan-to-source navigation, native Chromium touch drag/cancel, touch selection, keyboard order, the 61-page retention case, explicit repeated pages, selected rotations, blanks, retry/reset defaults, actual collapsed ad candidates and eight populated widths. Tests block live ads; no real impressions. Screenshots wait for existing header transitions/toast dismissal, not hidden test CSS.
- Final `npm run build`: **passed, exit 0**, after the production changes, including its `npm run lint` and `npm test` commands, TypeScript/Vite, all repository contracts, SEO/publication/ads and existing processing tests, plus 6 Background Remover Vitest files / 10 tests.
- Final `node tests/tool-functionality-phase4a/browser.mjs`: **passed, exit 0**. All 95 routes × eight widths; real EMI and ZIP workflows also pass. This is route/layout evidence, not 95 advanced-workflow certifications.
- Final `npm run test:ads:browser`: **passed, exit 0**, 134 checks, including all 14 excluded routes, native fixture behavior, seven responsive widths, document navigation, script failure/no-fill collapse and production CSP. No live ad requests.
- `git diff --check`: **passed, exit 0**. Windows line-ending notices are warnings, not whitespace errors.
- PostgreSQL isolated integration is intentionally opt-in and skipped by normal tests; no production database/OAuth certification. Vite's existing classic `tool-content.js` warning is non-fatal; negative fixtures deliberately emit sanitized failure logs.

QA artifacts: `test-results/edit-pdf-advanced/` contains downloaded PDFs, `export-rendered.png`, `mobile-page-controls.png` and `results.json`. `test-results/merge-pdf-advanced/` contains reopened merge/retry downloads, `merge-options-mobile.png`, `pdf-toolbar-mobile.png` and results. `test-results/pdf-page-tools-advanced/` contains four ZIP exports, organized/retry/touch PDF exports, `split-plan-mobile.png`, `organize-settings-mobile.png` and `results.json`; both mobile screenshots were visually inspected. Synthetic documents/images are test inputs only. No real accounts, location, user history or live ad impressions are created.

## Files changed in this increment

Production: `public_html/assets/pdf-edit-core.js`, `pdf-edit.js`, `pdf-edit.css`; Merge-specific sections in `app.js`, scoped queue/PDF-toolbar rules in `style.css`, the PDF toolbar class in `tool-workspace.js`; Edit PDF and Merge entries in `tool-content.js`.

Continuation: Split/Organize-only controls, validated page planners/processors and result retry/reset in `public_html/assets/app.js`; output-plan preview, page-order/pointer handling and plan listener cleanup in `public_html/assets/tool-workspace.js`; scoped plan/control styles in `public_html/assets/style.css`; truthful Split/Organize entries in `public_html/assets/tool-content.js`. No authentication/database/provider configuration changes.

Tests/scripts: `tests/edit-pdf-advanced.mjs`, `tests/edit-pdf-advanced-browser.mjs`, `tests/merge-pdf-advanced.mjs`, `tests/merge-pdf-advanced-browser.mjs`, `tests/edit-pdf-contract.mjs` (thumbnail cleanup in existing reset fixture), `tests/edit-pdf-browser.mjs` (block live Adsterra during QA), `scripts/audit-phase4c.mjs`, `package.json` (new contracts included in existing posttest).

Continuation tests: `tests/pdf-page-tools-advanced.mjs`, `tests/pdf-page-tools-advanced-browser.mjs`; `tests/tool-functionality-phase4a/pdf-output.mjs` adds the shared helper functions to its existing execution harness without removing assertions. The two new suites are included in `test:phase4c` / `test:phase4c:browser`. The matrix generator and both feature/functionality reports reflect four partial upgrades, not full phase completion.

`tests/edit-pdf-advanced-browser.mjs` also waits for editor readiness before its keyboard-undo assertion; the original assertion remains. An initial concurrent regression run sent the shortcut before readiness and failed; the corrected synchronization passed on rerun. No Edit PDF production behavior was changed in this continuation.

Documentation: this report, `PDF_EDITOR_TECHNICAL_PLAN.md`, `ADVANCED_TOOL_FEATURE_MATRIX.md`, and `TOOL_FUNCTIONALITY_MATRIX.md`. Existing build-generated audit artifacts refresh normally; many unrelated worktree edits predate this request and are preserved.

## Release blockers

Phase 4C/P0 incomplete; remaining advanced-control/output and compatibility work cannot be certified. Firefox/Safari/physical devices, live OAuth/database/provider services and real Adsterra creative fill are not validated. Existing content draft approval and advertising consent/provider checks from earlier reports still apply. No new environment variable, database migration or manual Netlify/Google reconfiguration is required for this bounded increment.
