# GXA Toolbox — three-column advertising layout QA

## Scope and allocation

The existing central `ad-config.js`, `ad-layout.js`, `ad-network.js` and `ad-network.css` own the public ad lifecycle. No provider ID or key was changed. Eligible tool pages use an in-flow CSS grid around the actual functional workspace, not an absolute overlay. The 728×90 result/download unit remains reserved from the first planning pass, including while a tool's result marker is still hydrating. A second approved 728×90 code would be needed to show a simultaneous top leaderboard on those pages. No identical provider key is requested twice per document.

| Zone | Approved unit | Provider unit ID | Runtime rule |
| --- | --- | ---: | --- |
| Result/download | 728×90, 468×60 or 320×50 by fit | 31513011, 31513009 or 31513010 | Requested only after a real result; before Download, never a gate |
| Top, when result code is reserved | 468×60 desktop, 320×50 tablet, Native where mobile unit is reserved | 31513009, 31513010, 31513079 | After heading/description; never duplicates the result key |
| Left rail | 160×300 at 1440–1599px; 160×600 at 1600px+ | 31513013, 31513008 | Only when measured space fits a 760px workspace and the route permits rails |
| Right rail | 300×250 at 1280px+ | 31513012 | Only when measured space fits; no rail on tablet/mobile |
| Middle guide | Native or unused 300×250 | 31513079 or 31513012 | Only between substantial editorial sections |
| Lower guide | Unused 320×50 | 31513010 | Only when there is enough original guide content on both sides |

The site's Native key is `b1b26904317d94da1830e1f5dd69d6d9`; the approved fixed keys remain `82dc3dcdb859ef27455f631d49183d07` (728×90), `a141cf44861510c02f8b814719a223bf` (468×60), `eb9ac703bb90ff49c53631490a2933f5` (320×50), `2cc9598f48bdcb102277c47352490483` (300×250), `900dabd0bb67d683bd5dbc7486b6d25a` (160×300), and `983c84b73f5901c5877413ab9680312e` (160×600). Popunder and Smartlink remain disabled; the pre-existing Social Bar policy is unchanged. Homepage and editorial placement policies are unchanged. The 14 intentionally ad-free tool routes remain excluded.

## Measured local browser geometry

Playwright used an intercepted provider fixture that rendered test-only creatives, not real Adsterra inventory. On the Compress Image empty upload page, the upload workspace remained 760 CSS px wide at each desktop breakpoint. Grid tracks are centered at their exact content width; rails are grid siblings with 24px gaps. Measurements below are from the final centered-layout browser run (`test-results/ad-layout-expansion/results.json`).

| Viewport | Workspace | Left rail | Right rail | Overflow/overlap |
| ---: | ---: | --- | --- | --- |
| 1280 | 760px | none | 300×250 | none |
| 1440 | 760px | 160×300 | 300×250 | none |
| 1600 | 760px | 160×600 | 300×250 | none |
| 1920 | 760px | 160×600 | 300×250 | none |

At 320, 360, 390, 430, 768 and 1024px the same browser suite found no side rail or horizontal overflow; the workspace uses its available width. A filled-ad fixture did not move the upload workspace vertically in the measured cases. The existing loading/no-fill lifecycle keeps an unfilled slot hidden and collapses it after the bounded provider decision window. Ad blockers and an intentionally empty provider response both left the uploader and Download controls usable. A no-fill collapse can re-center the layout when a side rail disappears; production CLS must be checked with real provider timing in a Deploy Preview.

Screenshots: `test-results/ad-layout-expansion/compress-image-{390,768,1280,1440,1600,1920}-viewport.png` and corresponding full-page captures, plus Edit PDF captures. Test-only creatives are visibly marked `LOCAL TEST FIXTURE`; they do not prove real provider fill.

## Coverage and verification boundary

The shared planner applies to all 81 currently ad-eligible registered tool routes (95 registered, 14 intentionally ad-free). The filled-ad browser matrix samples Image Converter, Compress Image, Compress/Merge/Split PDF, Edit PDF, Crop Image, GST Calculator and JSON Formatter at the required viewports. Actual placement count varies with page length, route eligibility, available width, result state and provider fill; a 6-slot maximum is not a quota. The result/download browser suite separately performs real file processing and download checks. The broader Adsterra browser suite checks eligible/excluded routes, duplicate requests, responsive states, failures and CSP using local fixtures. No production Adsterra creative or revenue outcome was verified.

The top 728×90 leaderboard is **not** simultaneously available on result-priority tool pages: its one approved key is reserved for the completed result. Do not reuse it elsewhere on the same page. If the owner wants both a top 728×90 and result 728×90, obtain a second approved Adsterra code. There is no additional code requirement for the current layout.

## Release note

The local layout is ready for an isolated deployment preview, but production GO requires a real-provider visual check at 390, 768, 1280, 1440, 1600 and 1920px, including no-fill and Social Bar obstruction. Do not treat fixture-mounted slots as actual creative delivery. Nothing in this phase changes tool engines, the Blog CMS, migrations, authentication, SEO or production advertising account settings.
