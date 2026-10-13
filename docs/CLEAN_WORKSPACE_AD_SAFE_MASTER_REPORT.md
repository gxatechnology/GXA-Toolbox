# Clean workspace and ad-safe normalization

Local implementation only. No commit, push or deployment was performed.

## Scope and architecture

- The existing Phase 3 disclosure controller remains the shared presentation adapter. Validators, processing engines and their file/result state remain authoritative.
- Main-app upload/editor pages expose `data-workspace-state`: empty, loaded, processing, result or error. The existing `data-disclosure` upload/ready attribute remains backward compatible. React Background Remover retains its own idle/error/processing/editing lifecycle; editing represents an actual generated cutout, not a placeholder result.
- Calculators, generators and text/developer utilities retain their initial inputs. HTML-to-PDF remains a hybrid text/file utility; hiding its text input before file upload would break its workflow.
- GPS location/output settings wait for a successfully decoded photo. Camera capture stays available initially. Errors remain outside hidden settings, and its map resizes when revealed.
- Edit PDF uses an accessible branded file input and real drag/drop handler. After a valid PDF loads, the initial upload card is hidden and a compact Replace PDF action uses the existing replacement confirmation/validation path.
- Optional import inputs retain the real native file input and event handlers, with a branded visual surface, keyboard focus indication and selected-file count.
- Single-file upload wording, including SVG, no longer falls through to plural wording. Long MIME identifiers are replaced visually by accepted extension badges; actual accept/validation rules are unchanged.
- Favorite sits beside the title group rather than being pushed to the far right. Shared spacing tokens and smaller mobile padding keep empty cards compact without capping/clipping loaded editors.
- Background Remover capabilities move below the upload action. Its processing engine, model, editor and export implementation are unchanged.
- Its header Download control is now rendered only in the editing/result phase, not as a disabled action before upload.
- A real processing failure now has a persistent inline alert that clears on reset, new file selection or retry. The tiny Compress PDF fixture correctly refuses an ineffective compression; this is not simulated success or a changed compression algorithm.

## Audit and counts

The complete 95-route inventory is in `TOOL_WORKSPACE_MASTER_AUDIT.md`. Raw before/after observations and screenshots are under `test-results/workspace-master/`.

| Metric | Result |
| --- | --- |
| Total routes audited | 95 |
| Upload-based routes, including advanced editors | 56 |
| Advanced editors (subset of upload-based routes) | 8 |
| Routes with premature empty-state settings | 1: GPS Map Camera |
| Routes with visible native file inputs before changes | 9 |
| Single/multi upload labels corrected | 10, including hybrid HTML-to-PDF |
| Routes with measured geometry inconsistency | 52 exceeded the approximate 320px mobile empty-area target before changes |
| Over-height mobile upload areas reduced | 52; these are measured target exceedances, not a claim that all were giant/square |
| Thin banner-like photo workspaces fixed | No confirmed baseline instance; optional native inputs are not photo workspaces |
| Title/Favorite alignment | 94 main-app headers; React header retained |
| Ad-safe placement changes | 0 network/policy changes; shared layout checked with filled fixtures |
| Mobile failures | 0 in the 950-observation matrix and executed representative suites |
| Desktop failures | 0 in the 950-observation matrix and executed representative suites |
| Functional regressions | 0 observed in executed suites; not a claim of every possible tool option |
| Safe to deploy | YES for the tested local changes, subject to owner review; no deployment performed |

The nine native-input routes include optional import controls on text utilities. Supplemental logo/signature/watermark inputs use the same wrapper when shown. The GPS baseline geometry probe selected its logo input, not its photo drop area; that number is explicitly excluded from claims about thin photo upload cards.

All 52 baseline mobile-height exceedances were reduced to at most 320px in the final matrix. The newly branded Edit PDF card is 326px at 320px viewport width (304px at 390px); its useful limit/privacy text is allowed to wrap rather than being clipped to meet an arbitrary hard cap. No horizontal overflow is introduced. This small deliberate exception is within the requested approximate sizing, not hidden by overflow CSS.

## Ad safety

No provider IDs, switches, density limits, route policy, CSP or ad scripts were changed. Existing 81 eligible / 14 excluded tool policy remains. Ads remain outside tool interaction/results. Existing responsive rail logic is retained instead of forcing rails into insufficient space. Filled-ad tests use intercepted test creatives and verify ordering, no overlap, no-fill collapse, no duplicate units and stable upload width. The final optional GPS and Background Remover reruns explicitly block Adsterra as well as Google tracking. Their earlier runs did not explicitly block Adsterra, so no claim about zero provider requests is made for those earlier runs. No ad clicks were performed.

## Validation log

- Build includes `npm run lint` and the full `npm test` lifecycle, React TypeScript/Vite, engine contracts, SEO, auth, ad and publication-policy checks.
- 95 routes × 10 widths: 320, 360, 390, 430, 768, 1024, 1280, 1440, 1600, 1920. This is layout/disclosure coverage, not every engine option on every route.
- Eight shared-tool state flows: Compress PDF, Merge PDF, Split PDF, PNG to PDF, SVG to PNG, Resize Image, Compress Image, OCR PDF. Real processing and downloaded bytes, including expected compression refusal/reset recovery.
- Upload lifecycle: 25 real picker/preview/reset/re-upload and drag/drop checks, including Crop Image downloads and Background Remover cancellation.
- Edit PDF: form entry, resize/focus retention, editable/flattened export/reopen, touch, undo/redo, image constraints, rotation, zoom, reset, plus upload-card disclosure and cancelled replacement.
- Image Converter: 16 actual conversions/reopen, seven mobile and six desktop widths.
- GPS Map Camera: actual JPEG/EXIF generation/reopen; synthetic camera/geolocation responses; seven mobile and six desktop widths.
- Background Remover: actual bundled ONNX/WASM inference and full-resolution alpha PNG export; invalid-file rejection. Upload reset/cancel separately tested.
- Advertising: 111 checks including real Compress PDF output, GST/JSON, responsive placements and 14 excluded routes. Additional upload-width stability assertion added for this phase.
- Final advertising rerun: PASS, exit 0, including the new before/after-fill workspace-width assertion.
- Final Edit PDF rerun: PASS, exit 0, including hidden initial upload card, Replace PDF picker, cancellation preserving the document, all original export and touch assertions. Its old upload helper was updated to use Replace PDF once a document is loaded; no export assertion was removed.
- Shared-tool state suite: PASS, exit 0, all eight routes, real downloads, plus a genuine already-compressed error and reset recovery.
- Final all-route matrix: PASS, exit 0; 950 observations, zero overflow, header overlaps, duplicate initial prompts or page errors. The later React header-only adjustment is verified separately at the same ten widths and with actual inference/export.
- Screenshot evidence: 72 before/after images across 12 representative routes at 390, 1440 and 1920px, including all seven requested tools (42 requested comparison images). Background Remover after images are refreshed by the focused header regression.
- New source contract: five-state projection, inline error recovery, SVG singular label, custom PDF upload and shared tokens.

Final production build: **PASS, exit 0**, including `npm run lint` and the full `npm test` lifecycle. Both new and existing UI source contracts: **PASS, exit 0**. Final React empty-header regression: **PASS at all ten widths**; real WASM inference/export regression: **PASS**. `git diff --check`: **PASS, exit 0** (line-ending notices only). PostgreSQL integration remains opt-in and was not run against production. Existing Vite classic-script warning is nonfatal.

## Files changed in this phase

- `public_html/assets/app.js`
- `public_html/assets/tool-ux.js`
- `public_html/assets/style.css`
- `public_html/assets/pdf-edit.js`
- `public_html/assets/pdf-edit.css`
- `public_html/assets/gps-map-camera.js`
- `background-remover-app/src/components/UploadScreen.tsx`
- `background-remover-app/src/components/Header.tsx`
- `background-remover-app/src/styles/global.css`
- `tests/tool-ui-final-browser.mjs`
- `tests/edit-pdf-browser.mjs`
- `tests/gps-map-camera-browser.mjs`
- `tests/ad-layout-browser.mjs`
- `tests/clean-workspace-browser.mjs`
- `tests/clean-workspace-contract.mjs`
- `tests/background-upload-disclosure-browser.mjs`
- `tests/tool-functionality-phase4a/background-browser.mjs`: explicit provider blocking only.
- `scripts/report-workspace-master.mjs`
- These two master reports.
- Standard build-generated Background Remover hashed JS/CSS and index references. Generated pages are not manually patched.

## Limitations

Chromium desktop/touch emulation only; physical devices, iOS Safari, soft keyboards and live ad creatives were not tested. The full route matrix measures empty/input layouts. Representative processing suites, not all processing combinations of all 95 tools, establish functional coverage. No production accounts, database records, provider settings or deployment configuration were changed.
