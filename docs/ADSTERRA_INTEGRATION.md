# Adsterra integration — local implementation

Historical native-only rollout below. As of 2026-10-20, all seven display units plus the approved Popunder and Social Bar are enabled centrally. Smartlink remains disabled. The current multi-zone policy, banner adapter, density limits, and validation are documented in [ADSTERRA_FULL_UNIT_ROLLOUT.md](ADSTERRA_FULL_UNIT_ROLLOUT.md).

Date: 2026-10-06. No commit, push or deployment. No live ad requests were made during QA. This is not a promise of future Google AdSense approval.

## Architecture and switch

`public_html/assets/ad-config.js` is the single canonical configuration. `network` is `adsterra`; supported build selections are `adsterra`, `adsense`, and `off`. Approved unit IDs and URLs live here, not in tool definitions. `public_html/assets/ad-intrusive.js` initializes Popunder and Social Bar once per eligible document at the end of `body`, without custom click, popup, or redirect code.

`config/ad-network.mjs` is consumed by the existing static generator. It selects the network after the generator has applied the central route eligibility decision. Adsterra production HTML receives one local config script, one local runtime and one stylesheet; it does not eagerly embed an external ad script. The existing AdSense block is omitted when Adsterra or off is selected. Raw source templates and the intermediate Vite HTML retain their AdSense configuration for future switching; Netlify must continue publishing **dist/**, not raw source/PHP or the intermediate Vite directory.

The Background Remover build remains React/Vite. The final static generator applies the same switch to its output; the existing React placeholder after the tool guide is reused. No React editor logic was changed. While editing, React removes that placeholder; a unit is not re-requested when the placeholder returns in the same document.

To switch later: change only `network` in `ad-config.js`, run the full build/tests and inspect generated output before an owner-approved deployment. `adsense` restores the existing official Auto Ads loader and publisher configuration; `off` removes both networks' loaders. Do not edit 95 tool pages. No manual AdSense unit or slot ID was added. GTM/GA4/Search Console identifiers are unchanged; external GTM container contents were not inspected or modified.

## Units

| Format | Key / container suffix | Initial state |
|---|---|---|
| Native | b1b26904317d94da1830e1f5dd69d6d9 | Enabled; one instance per document |
| 728×90 | 82dc3dcdb859ef27455f631d49183d07 | Enabled; responsive desktop top banner |
| 300×250 | 2cc9598f48bdcb102277c47352490483 | Enabled; measured right rail/content alternative |
| 320×50 | eb9ac703bb90ff49c53631490a2933f5 | Enabled; mobile top/lower placement |
| 468×60 | a141cf44861510c02f8b814719a223bf | Enabled; tablet top/content placement |
| 160×600 | 983c84b73f5901c5877413ab9680312e | Enabled; extra-wide left rail |
| 160×300 | 900dabd0bb67d683bd5dbc7486b6d25a | Enabled; desktop left rail |
| Popunder | abscloud.org/1/3a66eef4b20eb6bc449cee178926437d | Enabled on ads-eligible public documents |
| Social Bar | bauval.org/14/fcd69a971630acd0557b6a7e1c55ba85 | Enabled on ads-eligible public documents |

Native uses exactly the approved `/21/` URL, fixed `container-…` ID, `async`, and `data-cfasync="false"`. Banner `/22/` URLs are derived from the exact approved keys and stored centrally. Fixed banners are inventory only: enabling them later requires a reviewed banner adapter, not merely changing a boolean. No guessed iframe wrapper, `document.write`, global `atOptions`, or second Native instance was introduced.

The conservative choice of Native-only avoids global banner-option collisions and fixed-width overflow while remaining within the requested format/placement options. Official reference: [Adsterra Native placement and customization guide](https://adsterra.com/blog/turn-a-profit-with-native-banners/). Placement follows the user's stricter separation requirements, not the provider's optional near-upload suggestions.

## Eligibility and placement map

- All 95 registered tools are preserved. The existing policy still has **81 eligible and 14 noindex/ad-free tools**. No route was promoted and no tool count was changed.
- Runtime also requires `productionReady === true` for tools, indexable metadata, a hydrated page and no visible processing/error state. Unknown tools fail closed.
- Tool pages: use `ad-slot-content-1`, **after the complete substantial tool guide**, before related utilities/FAQs. The earlier `ad-slot-after-tool` stays hidden: it precedes recent results on shared workspaces and is not a safe active placement.
- Background Remover: existing guide-following placeholder, only outside editing mode. No editor sidebar ad.
- Homepage: one content-middle break after substantial workflow guidance, not beside the search/filter/tool card controls.
- Eighteen existing guide/category routes: one break before the final editorial section when at least three sections and 400 preceding text characters exist.
- Legal/company pages, guide hub/editorial-standards utility pages, dashboard, authentication/private/admin/error pages: no active placement. Some public legal HTML inherits the small local runtime from the shared generator; runtime eligibility denies it and no provider script is requested.
- Visible modal dialogs suppress pending units and collapse an existing placement. Closing a dialog never re-requests a unit already requested in that document. This does not claim an already-executed third-party script can be unloaded from memory.

Maximum initial density: **one Native unit per document** for tool pages, home and supported editorial pages (below the requested maxima). Native may contain several provider-selected creative cards; configure a compact provider layout rather than treating one unit as one guaranteed creative.

## Responsive and lifecycle rules

The same fluid Native unit is used on desktop, tablet and mobile. No 728/468-pixel fixed banner is forced onto a phone; no fixed or sticky advertising, overlays, sidebars, or ad controls sit near upload/process/download/canvas areas. Ads are labeled Advertisement and separated by normal document flow. Existing tool/card/grid styles are unchanged.

The hidden Phase 3 candidate retains zero height until requested. A 1px, noninteractive sentinel observes approach within 200px of the viewport. Missing IntersectionObserver leaves ads disabled. The main tool UI never waits for an ad. One request latch prevents duplicate script execution, IDs and remount impressions. Theme changes/resize do not create another request. A script error or no creative DOM after 20 seconds collapses the slot with no automatic retry.

The runtime detects creative elements rather than treating script HTTP success as a filled ad. Cross-origin iframe contents and provider-side no-fill semantics cannot be independently inspected by the site; actual provider rendering still needs owner QA. No script can guarantee all behavior of subsequently downloaded third-party creatives.

After a request starts, navigating to another route uses a fresh document instead of carrying executed third-party code through SPA navigation. Back/forward routing has the same guard. Before any request, normal existing client-side navigation is retained. Removing/rerendering a slot in the same document never injects a second copy. No click listeners or fake impression/earnings events are added.

## CSP, privacy and ads.txt

No CSP changes. Current policy is `base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'` and has no `script-src`, `connect-src` or `frame-src` restrictions requiring additions. It was applied to local test HTML during the browser suite. If the owner later introduces an allowlist, collect verified provider/subresource domains first; do not use a blanket wildcard to bypass failures.

The Privacy Policy now discloses Adsterra and the mutually selected network. **ads.txt is unchanged** and retains the verified Google seller line. No unprovided Adsterra seller entry is invented. Before deployment, the owner must confirm any provider-issued ads.txt entries, consent requirements/settings and creative-category controls with the provider. Existing Google CMP behavior is not a verified Adsterra consent mechanism; this task does not create a CMP or certify regulatory compliance.

## Validation

- `npm run build`: **passed, exit 0**. Its unchanged command runs `npm run lint`, the React/Vite production build and `npm test` including pre/post-test hooks. Lint, TypeScript, full repository tests and 6 Background Remover Vitest files (10 tests) passed. The opt-in PostgreSQL integration test was skipped by its existing explicit-enable policy; no production database test was performed. Vite's existing classic-script warning for `tool-content.js` was non-fatal.
- `npm run test:ads`: passed after the final test additions. Publication counts remain 81/14; all three build selections, no duplicate production loaders, unchanged ads.txt and CSP are checked.
- `npm run test:ads:browser`: **134 fixture-based checks passed**, including all 81 eligible tool candidates, 14 exclusions, all 27 editorial/company/legal pages (18 candidates, 9 denied), seven widths, home/guide/Background Remover, modal suppression, route navigation, blocked/empty scripts and current CSP. Zero unexpected provider requests or uncaught integration errors. Navigation and repeated synchronization did not duplicate the Native script/container.
- `node tests/ux-phase3-browser.mjs`: passed nine real file workflows (Crop, Resize, Compress, Image Converter, JPG/Image to PDF, Merge, PDF to JPG and OCR), 53 upload-first routes, keyboard picker, no-JavaScript content and empty ad candidates.
- `node tests/adsense-phase2-browser.mjs`: passed all 14 exclusions, real HTML download/error, QR/Code128 decoding, failed decode, navigation/back and home at 320/390/768/1440.
- `node tests/tool-functionality-phase4a/browser.mjs`: passed **95 direct routes × eight widths** (320/360/375/390/412/430/768/1440), no page overflow/errors, plus real mobile ZIP upload/process/download/reset and EMI calculation. This is route/layout coverage, not certification of all 95 processing engines.
- `git diff --check`: passed, exit 0; existing LF-to-CRLF notices are informational.
- Browser QA used installed Chromium with emulated touch, not physical devices, Safari or Firefox. Native fixture layout was checked at 320/360/390/430/768/1024/1440; actual provider creatives were not downloaded or certified.
- Tests never call the live approved ad URLs. Ad responses are explicitly labeled test fixtures inside browser automation only; no fixture ad markup is shipped in production.
- Existing publication, SEO, metadata, sitemap, GTM and AdSense contracts remain active. SEO assertions are network-aware and retain the original exact-loader assertions when AdSense is selected; dedicated switch tests cover all three modes.
- Generated screenshots/results are under `test-results/adsterra/` (ignored QA artifacts).

## Files changed for this task

New: `public_html/assets/ad-config.js`, `public_html/assets/ad-network.js`, `public_html/assets/ad-network.css`, `config/ad-network.mjs`, `tests/adsterra-contract.mjs`, `tests/adsterra-browser.mjs`, this report.

Modified: `scripts/generate-seo-site.mjs`, `public_html/assets/app.js` (navigation guard only for this task), `public_html/assets/ad-state.js`, `public_html/assets/content-pages.js` (advertising disclosure only), `package.json`, `tests/seo-contract.mjs`, `tests/adsense-phase2-browser.mjs`, `tests/tool-functionality-phase4a/cache-public-dependencies.mjs` (block live advertising in browser QA). Build-generated audit files/dist are refreshed by the existing generator. Earlier unrelated worktree edits remain preserved.

## Before deployment

Local fixture tests cannot certify Adsterra's live creative fill, account approval, provider-controlled Popunder/Social Bar behavior, consent behavior or future Google AdSense acceptance. Owner review is still required. Check that GTM does not independently inject either advertising network. Validate compact Native settings, provider brand-safety controls and authorized seller declarations; perform an approved live smoke test without clicking ads or manufacturing impressions.

Nothing committed, pushed or deployed.
