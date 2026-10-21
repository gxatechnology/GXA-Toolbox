# Adsterra final optimization — local verification

Date: 2026-10-21. These changes are local only. Nothing was committed, pushed, deployed, or changed in an advertising account.

## Final policy

`public_html/assets/ad-config.js` remains the single source of truth. The network switch still supports `adsterra`, `adsense`, and `off`. The current Adsterra selection enables seven display formats and Social Bar. Popunder and Smartlink are disabled.

| Format | Provider unit | Key / source | State |
| --- | ---: | --- | --- |
| Native Banner | 31513079 | `b1b26904317d94da1830e1f5dd69d6d9` | Enabled |
| 160×600 | 31513008 | `983c84b73f5901c5877413ab9680312e` | Enabled on measured extra-wide desktop rails |
| 468×60 | 31513009 | `a141cf44861510c02f8b814719a223bf` | Enabled for tablet/content placements |
| 320×50 | 31513010 | `eb9ac703bb90ff49c53631490a2933f5` | Enabled for mobile/lower-content placements |
| 728×90 | 31513011 | `82dc3dcdb859ef27455f631d49183d07` | Enabled for desktop top banners |
| 300×250 | 31513012 | `2cc9598f48bdcb102277c47352490483` | Enabled for measured right rails or long mobile content |
| 160×300 | 31513013 | `900dabd0bb67d683bd5dbc7486b6d25a` | Enabled for measured desktop left rails |
| Social Bar | 31513007 | `https://bauval.org/14/fcd69a971630acd0557b6a7e1c55ba85` | Enabled once on eligible documents |
| Popunder | 31513006 | No runtime source | Permanently disabled |
| Smartlink | 31822155 | No runtime source | Disabled |

Popunder is retained only as a disabled unit identifier and policy reason. It has no approved routes, no source URL and no request call in `ad-intrusive.js`. Browser contracts reject any `abscloud.org` request or popup. Social Bar remains provider-controlled; the site neither forces its dimensions nor duplicates its bootstrap.

## Eligibility and density

- Registered tools: **95**.
- Ad-eligible tools: **81**.
- Noindex/ad-free tools: **14**.
- Public sitemap URLs evaluated by the coverage suite: **109**.
- Ad-eligible public sitemap URLs: **100** (homepage, 81 eligible tools and 18 guide/category pages).
- Company/legal sitemap URLs intentionally ad-free: **9**.
- Admin, dashboard, authentication, private, error and unknown routes fail closed and receive no ads.

The planner does not apply a placement quota. At 1440px, the local fixture suite planned one slot on 18 guide/category pages, two on the homepage, three on Background Remover, four on 47 shorter or interaction-heavy tools and six on 33 sufficiently long simple tools. No page exceeded its configured density limit. At 390px, 80 long eligible tools planned three slots, the homepage planned two and 19 routes used one. At 320px the fixed 320×50 unit is omitted when page padding leaves insufficient width.

## Placement and responsive rules

- Top: 728×90 on desktop, 468×60 on tablet and 320×50 on mobile only when it physically fits.
- Left rail: 160×300 at 1440–1919px and 160×600 at 1920px and above, only after measured free-space checks.
- Right rail: 300×250 at 1280px and above, only after measured free-space checks.
- After-tool: one Native unit after the entire workspace/result/download area.
- Middle/lower: unused approved keys between substantial editorial sections. Long mobile pages may use one 300×250 in-content unit when the measured content width is at least 300px.
- Content-middle and content-lower receive extra vertical separation. No slot is positioned over an upload, editor, preview, processing control, download action or feedback control.
- Failed or unfilled units collapse to zero visible space. Provider script success is not treated as creative fill.

The desktop rail test confirms the ads are grid siblings beside, not inside or over, the workspace. At 1280px only the right rail fits. At 1440, 1600 and 1920px both rails fit on sampled simple tools. A representative 1440px Compress PDF layout measured a 760px workspace at x=222, a 160px left rail at x=38 and a 300px right rail at x=1006. At 1920px the left format becomes 160×600 while the right remains 300×250.

## Real-provider sample

A no-click Chromium sample was run for `/compress-pdf/` at 1440px and 1920px without intercepting Adsterra. The configured Social Bar, Native, top, left and right provider script requests were dispatched and returned HTTP 200 with no request failures or browser errors. No `abscloud.org` request occurred.

Both sampled left and right display slots remained empty and collapsed; no iframe or image creative appeared. This is a provider no-fill/unconfirmed-inventory result, not a successful visible advertisement. Local code can prove configuration, container geometry and provider requests, but cannot guarantee inventory, paid impressions, creative quality or Social Bar presentation.

## QA evidence

- `npm run test:ads`: validates all approved IDs, 81/14 tool policy, density, disabled Popunder and lack of an alternate runtime path.
- `node tests/ad-layout-browser.mjs`: 147 fixture-based checks across 16 widths, including layout, spacing, popup absence, failure collapse, processing and route exclusions.
- `node tests/ad-rail-geometry-browser.mjs ...`: representative PDF, image, converter, Background Remover and calculator geometry passed at 1280, 1440, 1600 and 1920px.
- `node tests/ad-coverage-browser.mjs 390`: all 100 eligible public URLs passed with zero errors or retries.
- `node tests/ad-coverage-browser.mjs 1440`: all 100 eligible public URLs passed with zero errors or retries.
- `node tests/adsterra-browser.mjs`: 154 lifecycle, publication, responsive, navigation, failure-collapse and CSP checks passed; all 14 excluded tool routes remained ad-free and no live requests were made.
- `node tests/footer-social-browser.mjs`: shared, tool and Background Remover footer/feedback regression checks passed at nine requested viewports.
- `npm run lint`: passed, exit 0.
- `npm test`: passed, exit 0. The PostgreSQL integration remained skipped under its existing explicit opt-in policy.
- `npm run build`: passed, exit 0. The production output contains all four local ad assets and no Popunder provider URL.
- `git diff --check`: passed, exit 0; line-ending warnings are informational.

Fixture-mounted units demonstrate deterministic planner/runtime behavior only; they are not real ads. Actual creative display remains provider-controlled. Before deployment, review Adsterra brand-safety categories, domain approval, consent obligations and account-side Social Bar settings. Do not enable Popunder as a workaround for display-unit no-fill.
