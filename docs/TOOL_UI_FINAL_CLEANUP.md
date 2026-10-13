# Tool UI consistency cleanup

Local work only. Nothing committed, pushed or deployed. Engines, authentication, database, route registry, advertising eligibility/density and tracking IDs are unchanged.

## Changes

- Shared tool header spacing, H1 line-height, description width, icon sizing and responsive Favorite alignment. Non-upload tools no longer start 24px lower than upload tools.
- Edit PDF, Image Converter and GPS Map Camera now consume one specialized-editor header renderer with category, icon, breadcrumb and the existing Favorite action.
- Background Remover retains its React architecture; its upload screen gains a breadcrumb, compact left-aligned heading and `Select image` label. It deliberately does not introduce a separate favorite persistence implementation.
- Four redundant initial status prompts removed: Crop Image, Edit PDF, Image Converter and GPS Map Camera. Reset no longer restores the duplicate prompts. Existing progress, errors, result messages and live regions remain.
- Crop Image's empty panel follows the light/dark site surface tokens instead of hardcoded dark colors. Loaded canvas geometry is unchanged.
- Four upload presentations share empty-state width/height/padding tokens: generic upload, Crop Image, Image Converter and Edit PDF. The existing disclosure architecture covers 54 upload routes. Desktop upload areas stay within the practical 300–360px target where their content permits.
- General/multiple uploads use `Select files`; single PDF uploads use `Select PDF`; single-image uploads use `Select image`. Real file inputs and handlers remain.
- The shared client and static guide renderers omit a paragraph only when it repeats its own step heading, ignoring final sentence punctuation. This removes 374 duplicate paragraphs across 95 routes without removing the instruction, altering content data or rewriting SEO metadata.

## Architecture

Simple tools retain the existing shared upload/input → settings/processing → preview/result → download/reset sequence. Advanced editors retain their larger canvas, toolbar and specialized controls. Shared presentation tokens do not override loaded document/image geometry or engine state. Ads stay outside interaction/result controls; the network configuration is unchanged.

## Audit scope and counts

The route-by-route table is in `TOOL_UI_FINAL_AUDIT.md`. Baseline evidence: 95 routes × 10 widths = 950 observations. All routes were directly loaded; the ten representative tools were refreshed at 390px. Before/after screenshots cover ten requested tools at 390, 1440 and 1920 (30 per phase).

- Total routes audited: **95**.
- Routes with UI issues: **95**, counting the source-confirmed repeated guide paragraphs; five routes also had distinct missing header/breadcrumb or duplicate initial-status issues.
- Routes fixed: **95** for repeated guide presentation; five distinct structural/empty-state problem routes corrected.
- Duplicate empty states removed: **4**; repeated guide paragraphs separately: **374**.
- Upload components normalized: **4**, serving the existing 54-route upload-disclosure family. Background Remover also received upload-label normalization.
- Header/breadcrumb structural issues fixed: **4 routes** (three specialized main-app pages and Background Remover), plus shared alignment/spacing for normal tool pages.

Final layout failures: **0 mobile, 0 tablet/desktop** across 950 after observations, with no header overlaps, duplicate instructions or browser page errors. Geometry audits are not a claim that every processing mode of all 95 engines was manually exercised. **SAFE TO DEPLOY: YES for the locally tested UI changes, subject to owner visual approval and the limitations below.** No deployment was performed. The final all-route matrix preceded the focused PDF-field fix; the full Edit PDF browser suite was rerun after that fix.

## Tests and evidence

| Validation | Actual result |
| --- | --- |
| `npm run build` (includes `npm run lint`, `npm test`) | PASS, exit 0 on final source; Background Remover TypeScript/Vite and full repository suite passed |
| `npm run test:ui-final` | PASS, exit 0 |
| All-route before matrix | 950 observations across 95 routes; no overflow/page errors |
| All-route final after matrix | PASS, exit 0; 950 observations, zero overflow, header overlaps, duplicate instructions or page errors |
| `node tests/upload-area-lifecycle-browser.mjs` | PASS, exit 0; 24 upload/preview/reset/re-upload checks plus two-file drag/drop merge/process/download/reopen = 25 |
| `node tests/ad-layout-browser.mjs` | PASS, exit 0; 111 checks including no-fill collapse, filled-ad geometry, eligibility, real PDF output, GST and JSON |
| `node tests/image-converter-browser.mjs` | PASS, exit 0; 16 real conversions, signatures/decoder reopen, seven mobile and six desktop widths |
| `node tests/pdf-page-tools-advanced-browser.mjs` | PASS on rerun, exit 0; 23 grouped Split/Organize checks, actual downloads/reopened files and eight populated widths |
| `node tests/edit-pdf-browser.mjs` | Final regression PASS, exit 0; field retention/focus during resize, undo/redo, real form/editable/flattened exports, overlays, image edits, touch drag, zoom, reset and eight widths |
| Generated HTML repeated-heading/paragraph check | PASS across 95 generated pages; zero remaining identical pairs |
| `git diff --check` | PASS, exit 0; LF/CRLF notices only |

The isolated PostgreSQL integration remains intentionally opt-in; it was not run against production. Existing non-module `tool-content.js` Vite warning remains nonfatal. Initial responsive test failure during reset was a pre-disclosure-frame measurement; assertions are retained after waiting for that frame. PDF touch geometry likewise waits for the existing delayed resize render. One rerun hit a CDN-dependent page-load timeout; the suite now uses the existing public-dependency cache and DOM-ready navigation. No engine output assertion was removed or loosened.

The browser suites block live ads and Google tracking. The filled-ad suite uses clearly labeled local intercepted creatives, never real impressions or clicks. Background Remover lifecycle QA validates actual image decode/preview and loading cancellation, not full model inference. No real user files/accounts are used.

Two old browser assumptions were updated without removing assertions: single-PDF button naming and the obsolete expectation of exactly one total ad container (the after-tool unit is still asserted unique, all unfilled slots collapsed, and total density bounded). Disclosure and PDF resize/redraw measurements now wait for scheduled layout updates before taking geometry.

An intermittent Edit PDF multiline export assertion prompted a deeper investigation. Canvas resize called `renderFields()`, which replaced the sidebar controls even for the same document/page, disconnecting the focused input. A new regression reproduced that disconnect before the fix. The renderer now retains those controls during same-page redraws and synchronizes restored values without resetting an unchanged value/caret. New documents/pages still rebuild the controls. The regression verifies control identity, focus, draft value and undo/redo; the final complete export suite passed afterward. PDF processing/export algorithms were not changed. This establishes a concrete UI defect and its fix, rather than relying only on a successful retry of the intermittent assertion.

## Files edited

- `public_html/assets/app.js`: header renderer, upload labels, empty crop status and duplicate guide rendering.
- `public_html/assets/style.css`: shared tokens, header/Favorite layout and empty-state theme/spacing.
- `public_html/assets/image-converter.js`, `gps-map-camera.js`: initial/reset prompt copy only.
- `public_html/assets/pdf-edit.js`: initial/reset copy, PDF upload label, and retention of focused sidebar fields during same-page canvas redraws; processing/export algorithms unchanged.
- `background-remover-app/src/components/UploadScreen.tsx`, `src/styles/global.css`: upload-screen identity and typography only; `src/components/ToolContentGuide.tsx` applies the same duplicate-step presentation rule in React.
- `scripts/generate-seo-site.mjs`: static guide paragraph deduplication matching the client.
- `scripts/report-tool-ui-final.mjs`: reproducible 95-route report from browser evidence and content registry.
- `tests/tool-ui-final-contract.mjs`, `tests/tool-ui-final-browser.mjs`: new source and all-route layout checks.
- `tests/edit-pdf-browser.mjs`, `tests/pdf-page-tools-advanced-browser.mjs`, `tests/upload-area-lifecycle-browser.mjs`, `tests/ad-layout-browser.mjs`: updated UI labels, safe provider blocking, scheduled-layout measurement and current ad-policy assertions.
- `package.json`: explicit UI contract/browser commands.
- `docs/TOOL_UI_FINAL_AUDIT.md`, `docs/TOOL_UI_FINAL_CLEANUP.md`: requested reports.

The standard build also refreshes generated audit/count artifacts, the local identity bundle, and hashed Background Remover assets/index references. No generated production HTML was manually patched.

## Limitations

Physical phones, soft keyboards, provider ad creatives and every combination of tool settings were not manually tested. The independent React editor retains its existing result architecture. No revenue, indexing or complete-engine certification is implied by a visual cleanup. Owner screenshot review remains recommended before any deployment.
