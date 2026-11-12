# GXA Toolbox responsive UX and DOM audit

Local audit, 2026-10-30. No production deployment, database operation, commit, or push was performed. The four screenshots described in the supplied brief were not attached to this turn; the evidence below comes from local Chromium captures and DOM measurements.

## Confirmed issues and repairs

| Priority | Route / selector | Before evidence | Root cause | Repair | After evidence |
| --- | --- | --- | --- | --- | --- |
| Critical | `/organize-pdf/` `#premium-result-preview` | At 390px, the comparison grid was 995px tall inside a 440px preview wrapper; the PDF viewer painted over stats and Download. | The mobile CSS applied a fixed `height: min(54dvh, 440px)` to the **preview wrapper**, not only its iframes, while the wrapper used `overflow: visible`. | Let the preview wrapper grow with its content and clip the embedded PDF viewer to the preview. Preserve the original/output comparisons. | Wrapper 997px, comparison 995px, stats start after wrapper at 1658px, Download starts at 1821px. Close-up capture shows no overlap. |
| High | Mobile PDF/Image/Calculator menu `.header-nav .mega-menu` | At 320px, four PDF groups each had only 58px width; at 390px, 75.5px. | A later desktop four-column rule overrode earlier mobile media rules. | A later scoped `max-width: 1100px` rule provides one column, internal panel scrolling, readable 44px links, and an accordion height limit. | One column from 320px through 1024px; four columns retained at desktop widths. Browser test also checks second-tap collapse and one open category. |
| High | Mobile All Tools | From `/compress-pdf/`, clicking All Tools left the directory 1267px below the viewport at scroll position 0. | A button navigated Home and attempted a smooth scroll that did not survive the clean-document route transition after an ad request. | Use a real `/#tools-grid-anchor` link. Preserve native full-document navigation when ads require it, and scroll to the rendered directory after hydration. | At 390px, URL hash is `#tools-grid-anchor`, scroll position is 1111px, and the directory starts 155px below the fixed header/filter region. |
| Medium | Mobile drawer keyboard lifecycle | The drawer had no focus trap or return-focus behavior; Enter/Space had an extra manual toggle handler in addition to native button click. | Incomplete drawer state handling and duplicate keyboard activation path. | Add `aria-controls`, trap Tab within toggle/drawer, restore focus after Escape/X, and rely on native Enter/Space button activation. | Playwright verifies accordion open/close, one open category, Escape focus restoration, and inactive closed backdrop. |
| Medium | Shared result/Download panel | Generic status copy was repeated above the preview, inside the fallback file card, and in the Download card. | Three separate template strings stated the same completion fact. | Keep the completion heading; make preview and stats semantic sections; use a compact file card and file-type-specific Download title. Preserve necessary Adjust settings / Start Over actions. | Organize PDF shows a distinct PDF preview, compact stats, and a separate “Download your PDF” panel. |

## Other layout checks

- The homepage marquee/search had already been corrected in pending local changes. The existing browser suite passed at 320, 375, 390, 430, 768, 1024, 1440 and 1920px: no marquee/search intersection or horizontal overflow, search interaction works, and reduced-motion stops animation. No additional marquee source change was needed in this task.
- The Compress PDF empty upload workspace had 32px of separation before the guide at mobile widths and 48px at tablet/desktop widths. No new upload/How-to spacing change was needed.
- The existing result advertising system still owns the after-tool slot. The browser ad suite verified 390/768/1280/1920px formats (320×50 / 468×60 / 728×90), one request per result, centered fixture creatives, clean no-fill collapse, and two real downloads. A mocked creative is **not** evidence of live provider fill.
- No page-level horizontal overflow was detected at the 14 widths in the new DOM suite. The PDF editor/viewer may vary by operating system; the test checks its containing DOM geometry and a Chromium screenshot.

## Browser evidence and limitations

The new `tests/responsive-ux-dom-browser.mjs` exercises generated `dist/` pages and records before/after measurements under `test-results/responsive-ux-dom/` (ignored test output). It tested navigation and upload/guide geometry at 320, 360, 375, 390, 412, 430, 600, 768, 820, 1024, 1280, 1440, 1600 and 1920px. It processed a real three-page PDF in Organize PDF at 390px, downloaded the output, reset, and checked result containment. The existing result and marquee suites cover additional workflows and responsive widths. This is representative browser verification, **not** a claim that all 95 tools were individually retested in this task. Physical Android/iOS devices and live Adsterra creative fill were not verified.

Before/after close-up captures: `test-results/responsive-ux-dom/before/organize-pdf-result-390.png` and `test-results/responsive-ux-dom/after/organize-pdf-result-panel-390.png`. Detailed measurements are in `docs/GXA_RESPONSIVE_UX_DOM_RESULTS.json` and the ignored test-run JSON.

## Release notes

The working tree already contained pending homepage marquee, ad-result layout, Background Remover, and test changes before this task. Those changes were preserved. New source edits here are limited to shared navigation/result markup in `public_html/assets/app.js`, responsive CSS in `public_html/assets/style.css`, the corrected navigation contract, and this DOM browser suite/documentation. No tool processing engine, route registry, ad unit key, eligibility policy, auth, admin, or migration was changed.

## Executed validation

- `npm run lint` — passed.
- `npm test` — passed; isolated PostgreSQL auth integration intentionally skipped because `RUN_POSTGRES_INTEGRATION` was not enabled.
- `npm run build` — passed with exit code 0 after the final source edit. Vite warned that a pre-existing non-module `tool-content.js` script is not bundled; this did not fail the build.
- `node tests/responsive-ux-dom-browser.mjs` — passed 16 DOM records, real Organize PDF processing/download/reset, accordion/focus/resize checks.
- `node tests/home-marquee-layout-browser.mjs` — passed eight responsive widths, search interaction, reduced-motion and overflow checks.
- `node tests/result-download-layout-browser.mjs` — passed eight responsive checks, one collapsed no-fill and two real downloads. Creative fill was a local fixture.
- `node tests/adsterra-browser.mjs` — passed 149 checks, including 14 excluded routes, responsive result fixtures, document navigation, failures and CSP. It made no live ad requests.
- `git diff --check` — passed; Git emitted line-ending warnings only.
