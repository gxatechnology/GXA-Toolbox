# Edit PDF implementation and QA

## Product boundary

`/edit-pdf/` preserves the uploaded PDF as the document base. It fills supported AcroForm fields and writes new overlays into the existing pages. It does not extract, reflow, or pretend to rewrite static page text. Editing rewrites the PDF and can invalidate an existing certificate-backed digital signature; drawn, typed, and uploaded signatures are visual marks only.

Processing is browser-local and in-memory. The editor does not use `fetch`, XHR, IndexedDB, `localStorage`, or `sessionStorage` for PDF bytes, answers, overlay text, images, or signatures. It forwards only the established `tool_open`, `tool_start`, `tool_complete`, `tool_fail`, and `tool_download` lifecycle; history receives a generic filename and output size.

## Architecture

- `pdf-edit-core.js` is the deterministic PDF inspection/export engine. It validates the source, detects fields, maps visual coordinates through CropBox/page rotation/widget rotation, fits field text into original widgets, and produces editable or genuinely flattened output.
- `pdf-edit.js` owns the route-lazy editor UI, page preview, native form controls, overlay state, undo/redo, output preview, download, cleanup, and responsive/touch behavior.
- `pdf-edit.css` uses the existing GXA Toolbox palette and responsive shell. The editor changes from a page-plus-properties grid to one column below 992px and retains 44px primary targets.
- The existing central registry and static generator own the route, canonical URL, content, related-tool links, JSON-LD, sitemap entry, and tool counts. Generated `dist/` files are never edited manually.

Supported AcroForm inputs are single/multiline text, checkbox, radio, and single-select dropdown fields. Read-only or unsupported fields are preserved, but disable flattening. XFA, encrypted, corrupt, empty, oversized, duplicate-field-name, unsupported-character, and unfit-text inputs return explicit sanitized errors. Added overlays support text, date text, check, cross, rectangle, PNG/JPEG, typed signature, uploaded signature image, and drawn signature.

Basic overlay text uses Helvetica, Times Roman, Courier, or Times Italic and supports Latin characters that those standard PDF fonts can encode. Shapes do not redact underlying content. The chosen PDF cap is 25 MB; PNG/JPEG additions are capped at 5 MB and 16 megapixels.

## Automated coverage

`tests/edit-pdf-core.mjs` creates fixtures entirely in memory and verifies:

- five original pages, portrait/landscape, CropBox, page rotations 0/90/180/270, widget rotations, and UserUnit preservation;
- detection and round-trip export of text, multiline, checkbox, radio, and dropdown values, including dropdown export codes;
- page count/order/dimensions/artwork streams remain intact;
- output values remain editable, while flatten mode removes fields/widgets and places their appearances correctly, including transformed appearance matrices;
- complete fitted field appearances, overlay text editing/movement/sizing/alignment/deletion, separate edits on multiple pages, check/cross/vector shapes, and an embedded image;
- coordinate stability at five editor scales; and sanitized rejection of encrypted, XFA, corrupt, empty, oversized, duplicate-name, out-of-page, invalid-image, and unsupported-text cases.

`tests/edit-pdf-contract.mjs` verifies the registry/generator integration, route-lazy scripts, content, related routes, private-data analytics filtering, generic history, busy/read-only behavior, continuous input synchronization, rotated widget transforms, stale-render protection, and reset cleanup.

`tests/edit-pdf-browser.mjs` is an explicit Playwright test. It uses only generated synthetic documents, blocks Google analytics/advertising requests in its isolated context, and verifies upload, fill, editable download, reopen, flatten, flat overlays on pages 1 and 3, date/check/image/drawn and typed signatures, output preview, touch drag, undo/redo, zoom stability, reset, direct error states, and real downloaded-PDF contents. It captures evidence in `test-results/edit-pdf-browser/`.

## Runtime QA results

The real Chromium run passed at 320, 360, 375, 390, 412, 430, 768, and 1366 CSS pixels. At every width, body horizontal overflow was absent, the toolbar wrapped rather than clipping, the PDF remained visible, and selected text properties remained usable. A synthesized touch stream moved an overlay, and undo/redo restored both coordinate states. Desktop editable-form export was downloaded, reopened through the visible file input, and then flattened. The reopened flat export retained page-one and page-three additions as actual PDF page content.

Representative evidence:

- `test-results/edit-pdf-browser/desktop-form-edit.png`
- `test-results/edit-pdf-browser/desktop-form-output.png`
- `test-results/edit-pdf-browser/mobile-flat-output.png`
- `test-results/edit-pdf-browser/rotated-widgets-output.png`
- `test-results/edit-pdf-browser/reopened-page-three.png`
- `test-results/edit-pdf-browser/editor-{320,360,375,390,412,430,768,1366}.png`

This is emulated Chromium coverage, not a claim of physical-device or every-third-party-PDF certification. Complex custom AcroForm appearance scripts, XFA, encrypted inputs, arbitrary static-text rewriting, non-Latin font shaping, cryptographic signing, and secure redaction remain intentionally outside this tool.

## Manual release checklist

1. Open a representative non-sensitive AcroForm and check each supported field in the actual receiving PDF reader.
2. Export once with editable fields and once flattened; confirm values, page dimensions, rotations, and tab/print behavior.
3. Open a flat multi-page form, add text/check/date/signature/image on separate pages, preview, download, and reopen.
4. Confirm fit-width, fit-page, 100%, zoom-in, and zoom-out do not change saved placement.
5. Test a password-protected PDF through Unlock PDF first and confirm Edit PDF rejects the protected original.
6. Repeat the primary path on current Android Chrome and iOS Safari before public release.

