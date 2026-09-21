# Tool browsing design audit and implementation

Date: 2026-09-22. Scope: the existing public tool directory, related-tool cards, personal shortcuts and command-search illustrations. The central registry contains **95 tools**. No tool definitions, routes, processing engines, authentication, database, tracking or SEO metadata were changed by this task.

## Pre-implementation audit: top 10 weaknesses

The existing renderer, stylesheet, source templates and generated site were inspected before editing. Baseline screenshots were captured at 1440px and 390px.

| # | Observed weakness | Implemented improvement |
|---|---|---|
| 1 | Desktop cards were approximately 317px tall, with multiple disconnected vertical gaps. | A single linked content layout, consolidated copy, and an aligned footer reduce the first row to approximately 250px. |
| 2 | Five narrow desktop columns encouraged awkward title wrapping. | Four generous columns at 1180px+, three at 900px+, two at 600px+, and a compact list below 600px. Tool titles remain fully visible. |
| 3 | Mobile cards used a desktop-style vertical stack with excessive unused space (approximately 237px for the first card). | An illustration beside the title/description, with a compact footer: approximately 140px for the first card. |
| 4 | Repeated generic line icons did not distinguish tools' actions. | 95 distinct original SVG miniatures combine a recognizable object, action seal and relevant format label. |
| 5 | Bright category-edge borders and large glow effects competed with the content. | Subtle borders, restrained elevation and pastel category-colored illustrations. Hover movement only on fine-pointer devices. |
| 6 | Small uppercase category labels consumed their own row. | A readable, quiet category label shares the footer with the launch affordance. |
| 7 | The isolated tiny launch arrow did not clearly communicate the whole-card link. | A full-size native anchor, a visible launch footer, and a clear keyboard focus outline. |
| 8 | Favorites were buttons nested inside anchors; toggling rebuilt the whole grid and lost focus. | Sibling 44px favorite buttons with aria-pressed. Update in place; only the filtered Favorites list needs rebuilding. |
| 9 | Filters lacked selected-state semantics, useful result counts and a direct saved-tools view. | Button-group semantics, aria-pressed, a polite result count, Clear filters, honest empty states and a Favorites filter using existing persisted preferences. |
| 10 | Hard-coded sticky offsets and crowded mobile tabs made long browsing fragile. | A ResizeObserver measures header/filter height; horizontally scrollable 44px chips, search spacing, result repositioning after filtering, Back to filters, and a non-sticky short-landscape layout. |

An additional visible issue found during rendered QA was the closed mobile drawer casting a shadow across the right edge of the directory. Its shadow is now suppressed only while the drawer is closed; open-drawer behavior is unchanged.

## Shared architecture

- `public_html/assets/tool-icons.js`: a presentation-only map keyed by existing tool IDs. The central registry remains the authority for tools and routes. Reusable object drawings and action marks produce distinct, cached, decorative 64x64 SVGs. There are no external images, icon downloads, SVG IDs that collide, or new dependencies. Unknown future tools retain their existing Lucide fallback; the coverage contract requires explicit artwork when a tool is added.
- `public_html/assets/tool-cards.js`: one accessible card factory for directory and related cards, plus shared illustrations for command results/personal shortcuts. Real links preserve native modified-click behavior; buttons are not nested in links. Existing tool names/descriptions and favorite storage are retained.
- `public_html/assets/tool-cards.css`: a scoped presentation layer loaded after the existing stylesheet. It preserves the blue site palette, supports dark mode and reduced motion, and leaves editor/workspace styling alone. Additional assets total approximately 8.3 KB gzipped (11,834 + 2,242 + 10,056 source bytes).
- `public_html/assets/app.js`: uses the shared factory; preserves search/category state during same-session route navigation, updates favorites in place, announces filter counts, and cleans up the browsing ResizeObserver on route changes. No scroll hijacking or continuous scroll handler was added.
- `index.html` and `public_html/index.php`: load the shared assets in dependency order. The existing SEO generator copies the assets and inherits the static template; generated pages are not maintained by hand.

The existing `/all-tools/` production redirect targets the homepage directory. The local static QA server does not emulate that redirect, so browser tests exercise the real directory on `/`. Existing production route contracts separately validate routing controls.

## Verification

Automated browser QA runs against the generated `dist/` output using real Chrome/Playwright. Tracking and ad requests are blocked in the test context to prevent test analytics and ad impressions. Preferences use an isolated browser context; no real accounts or database records are created.

Widths checked: **320, 360, 375, 390, 412, 430, 480, 600, 768, 820, 1024, 1280, 1366, 1440, 1920px**. An additional 844x390 landscape check verifies the compact-height toolbar behavior.

Results:

- All 95 cards and SVGs render; all native tool hrefs match the registry.
- Zero page-level horizontal overflow at the 15 widths.
- No horizontally clipped tool titles; favorite and filter targets are at least 44px.
- The search icon has 14px clearance from the input text start.
- Touch filtering, category counts, search/empty states, favorites, keyboard focus, modified-click semantics, related cards, route Back state, mobile drawer and command search pass.
- Sticky filters remain below the header. Filtering from farther down the page exposes results rather than leaving the viewport below a shortened list.
- Light/dark screenshots and all 95 illustrated icons were visually inspected.
- Reduced motion is honored, including the existing global .01ms animation/transition reset.

Commands executed:

- `npm run lint`: passed, exit 0.
- `npm test`: passed, exit 0; includes new card contracts and existing repository/SEO/authentication/admin/tool contracts plus 10 Background Remover tests.
- `npm run build`: passed, exit 0; includes TypeScript/Vite build and the full lint/test pipeline.
- `npm run test:tool-cards:browser`: passed on local Chrome, using the external Playwright runtime specified via `GXA_PLAYWRIGHT_MODULE` and `GXA_BROWSER_EXECUTABLE`.
- `git diff --check`: passed, exit 0; existing Windows LF/CRLF conversion warnings are informational.

The opt-in PostgreSQL integration remains intentionally skipped by normal tests. Negative-input PDF/admin/geocoder fixtures print expected diagnostics. Vite still prints the pre-existing classic `tool-content.js` bundling notice; its build succeeds.

## Files changed by this task

Source/template: `index.html`, `public_html/index.php`, `public_html/assets/app.js`, `public_html/assets/tool-icons.js` (new), `public_html/assets/tool-cards.js` (new), `public_html/assets/tool-cards.css` (new).

Validation/documentation: `package.json`, `tests/browser-engine-contract.mjs` (points its existing card assertions at the extracted component), `tests/tool-card-design-contract.mjs` (new), `tests/tool-card-design-browser.mjs` (new), this document (new).

The normal build regenerates deployment artifacts and existing generated audit files. Pre-existing local changes, including admin-dashboard work, are preserved.

## Screenshot evidence

Under `test-results/tool-card-design/` (local QA artifacts, ignored by Git):

- `before-1440.png`, `before-390.png`
- `after-320.png`, `after-390.png`, `after-768.png`, `after-1440.png`
- `after-dark-390.png`, `after-dark-1440.png`, `after-landscape.png`
- `keyboard-focus.png`, `command-search.png`, `all-95-illustrations.png`
- `results.json`: measured widths, column counts, card heights, overflow and touch-target results.

## Remaining limitations and follow-up

This is browsing/UI verification, not a new end-to-end processing certification for all 95 tools. Existing processing contracts passed; no processing code changed. Safari/iOS, physical Android devices and a live Netlify deployment were not tested. A final device check before release is recommended. Font/CDN availability remains an existing network dependency; the new illustration system itself is local and dependency-free. No commit, push or deployment was performed.
