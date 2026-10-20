# Workspace-side advertisement QA (local only)

The former rails were absolutely positioned from `.tool-header`, using the
outer `.tool-container` gutter rather than the functional workspace. On a
1440px Compress PDF page, the 760px upload was at x=206 but the left rail was
omitted; the right rail began at x=1116 and y=275 while the upload began at
y=484. The apparent whitespace was real, but the planner measured the wrong
element and the rails were not beside the uploader.

The shared ad runtime now uses an in-flow grid on eligible desktop tool pages.
At 1280px it reserves a 760px workspace, 24px gap, and 300px right rail. At
1440px and wider it also reserves a 160px left rail and another 24px gap. It
does not place rails below 1280px. A loaded editor drops its rails and restores
the original full-width layout. The dedicated Background Remover places the
rails outside React's `#root` and likewise removes them when upload transitions
to the editor; a lower Native placement also stays outside `#root`.
No rail is inserted into an upload, preview, result, or editor DOM.

| Viewport | Compress PDF upload (x, width) | Left rail (x, format) | Right rail (x, format) |
| --- | --- | --- | --- |
| 1280 | 50, 760 | none | 834, 300×250 |
| 1440 | 222, 760 | 38, 160×300 | 1006, 300×250 |
| 1600 | 302, 760 | 118, 160×300 | 1086, 300×250 |
| 1920 | 462, 760 | 278, 160×600 | 1246, 300×250 |

The same local fixture suite verified Organize PDF, Edit PDF, Crop Image,
Image Converter, PNG to PDF, ZIP Manager, JSON Formatter, GST Calculator, and
Background Remover at those four widths. In each case, the rail is alongside
the real functional workspace, the approved unit key is requested once, and
the document has no horizontal overflow. A selected PDF on Compress PDF
restored the full-width loaded workspace with its processing action visible.
The full 1440px route sweep passed for 100 ad-eligible public URLs; all 81
eligible tool routes planned and mounted both workspace-side rails once under
the controlled fixture. The other 19 eligible URLs are the homepage and
editorial/category pages; they retain their own non-workspace placement policy.
The 14 noindex tools and private routes remain ad-free; Popunder and Social
Bar remain disabled. Existing top, after-tool, and content placements remain
under the central density planner.

Fixture screenshots and bounding-box data are in ignored
`test-results/ad-rails/`. They prove placement and request wiring, **not**
creative fill. In separate unmocked Chrome samples on Compress PDF at 1280,
1440, 1600 and 1920px, each planned side script was requested once and
returned HTTP 200 with no CSP or network error. Every requested side slot
ended in `empty` after the full decision window and collapsed without blank
rail space. The 1280px left rail was deliberately not planned. This is a
local provider no-fill observation, not proof of live-site fill. The page
remains usable if a provider blocks or fails.

Reproduce the deterministic geometry checks with
`node tests/ad-rail-geometry-browser.mjs`. Use `--real --wait-fill --width=1440
compress-pdf` for a genuine provider sample, which may make ad requests.
Run `node tests/ad-coverage-browser.mjs 1440` for the complete eligible-URL
fixture sweep and `npm run test:ads:layout:browser` for responsive/tool-flow QA.
Review actual creative quality and fill again on the approved deployment; a
returned script or an iframe/container alone is not counted as a displayed ad.
