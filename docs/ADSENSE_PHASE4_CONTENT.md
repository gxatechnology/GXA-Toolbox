# Phase 4 — local content implementation and remaining work

Status: **implemented and validated locally in part; not publication-ready or fully complete**.

Date: 2026-10-02. No commit, push or deployment. Existing dirty Phase 2/3, GPS and admin changes were preserved. No processor, authentication flow, database schema, publisher ID, GTM ID or production domain was changed by this phase.

## Counts

| Item | Verified count |
|---|---:|
| Registered tool routes preserved | 95 |
| Indexable tools with pre-JavaScript instructional content and guide links | 81 |
| Tool routes still noindex/ad-free | 14 |
| Priority tool pages materially revised | 20 |
| New category pages | 5 |
| New practical guides | 13 |
| New guide hub and editorial standards pages | 2 |
| Total generated public pages | 123 |
| Sitemap / indexable public pages | 109 |
| Routes moved to noindex in this phase | 0 |
| Indexable tools still flagged for legacy sentence frames | 33 |
| Public pages requiring publisher sign-off in the whole-site human review | 123 |

“Instructional content” here means visible introductory, how-to, formats, limitations, examples, FAQ and related-link sections in the initial HTML. It is not a declaration that Google considers the page sufficiently original. All tool computation still requires JavaScript; the static page explicitly explains this instead of presenting fake working controls.

## Audit before editing

`PHASE4_CONTENT_INVENTORY.md` contains one row per indexable tool, derived from the existing built HTML before Phase 4 rewriting. `PHASE4_CONTENT_BASELINE.json` preserves the actual extracted introduction, instructions, FAQs, metadata and links. The baseline is write-once (`--baseline` refuses overwrite).

The original 81 pages had initial explanatory HTML and exact-unique metadata, but no guide links. The stricter near-match screen found 180 intro/instruction/FAQ pairs at Jaccard 0.65. It now finds 157. Five cross-route paragraph groups remain repeated. These results are more conservative than the existing 0.78 repository contract; they are not suppressed because that contract passes. See `CONTENT_QUALITY_AUDIT.md` for the exact remaining routes and comparisons.

## Materially revised tools

Merge PDF, Split PDF, Compress PDF, PDF to JPG, JPG to PDF, Image to PDF, Compress Image, Resize Image, Crop Image, Image Converter, Image OCR, Background Remover, QR Generator (`/barcode-generator/`), QR Reader, Barcode Reader, JSON Formatter (`/json-tool/`), Base64, Password Generator, GST Calculator and EMI Calculator.

Each received new introductory explanation, a four-step workflow, a practical example, three task-specific FAQs and tips. Existing real format limits and processor behavior were preserved. Important corrections include OCR transcript versus searchable-PDF output, JSON syntax versus schema validation, Base64 versus encryption, native barcode fallback, image transparency, PDF signature implications and arithmetic versus legal/financial advice.

The three rewritten review routes (QR Reader, Barcode Reader and Base64) were **not** promoted to indexable/ad-eligible. The other eleven exclusions also remain unchanged.

## New resources

Categories: `/pdf-tools/`, `/image-tools/`, `/file-converters/`, `/developer-tools/`, `/calculators/`. Each groups approved tools by tasks and explains terminology, decisions and limitations rather than presenting only a card grid. Category tool links are contract-checked against the existing publication policy.

Guide hub: `/guides/`.

Guides:

- `/guides/pdf-compression/`
- `/guides/image-formats/`
- `/guides/image-size/`
- `/guides/ocr-scans/`
- `/guides/qr-information/`
- `/guides/base64/`
- `/guides/sha256/`
- `/guides/emi/`
- `/guides/gst-inclusive-exclusive/`
- `/guides/resize-without-distortion/`
- `/guides/browser-processing/`
- `/guides/tool-privacy/`
- `/guides/pdf-privacy/`

Editorial process: `/editorial-standards/` and `EDITORIAL_MAINTENANCE_PROCESS.md`. New pages show “Draft prepared: 2026-10-02,” publisher attribution and the explicit pending human-review status. No fake author, expert qualification, publication date or completed review is claimed. **The owner must review these drafts before publishing them.**

The guide citations use primary documentation for qpdf, Tesseract, QR, Base64 and SHA-256, MDN’s browser format reference, and official RBI/CBIC material for the bounded financial/tax discussion. References support explanations, not a claim that an example rate is currently applicable to a user.

## Architecture and links

- New `editorial-pages.js` registry joins the existing content-page renderer; it is not a separate site or replacement architecture.
- The generator emits full static content, metadata and existing WebPage/Breadcrumb JSON-LD. Nested guide routes also resolve through the current client router. Unknown nested paths still produce a real 404.
- Every tool gets a relevant guide link; guide/category links return to real tool routes. Existing company/legal links and Contact Support remain. No fake feedback, reviews or usage signals were added.
- Homepage additions describe practical workflows, categories, guides and processing boundaries. No tool-count promotion or invented “recently reviewed” claim was added.
- The shared generic meta-description suffix was removed. Each real tool retains its existing route and title; no fake `/json-formatter/` route was created. That requested spelling correctly remains 404; `/json-tool/` is the actual working canonical route and was tested instead.
- Netlify still publishes `dist/`, with static directories and existing real-404 behavior. No redirect, function, authentication or database logic was changed by this phase.
- Existing Auto Ads/GTM contracts now cover the added public content pages. The new drafts are included in the local sitemap, so **do not deploy until editorial approval**. Private/error/review-route exclusions and seller authorization are unchanged. External GTM container contents and live Auto Ads behavior were not inspected or modified.

## Files changed in this phase

New:

- `public_html/assets/editorial-pages.js`
- `scripts/audit-phase4-content.mjs`
- `tests/phase4-content-contract.mjs`
- `tests/phase4-content-browser.mjs`
- `docs/ADSENSE_PHASE4_CONTENT.md`
- `docs/PHASE4_CONTENT_INVENTORY.md`
- `docs/PHASE4_CONTENT_BASELINE.json`
- `docs/CONTENT_QUALITY_AUDIT.md`
- `docs/EDITORIAL_MAINTENANCE_PROCESS.md`

Source integrations:

- `public_html/assets/tool-content.js`, `content-pages.js`, `app.js`, `tool-quality.js`
- `index.html`, `public_html/index.php`
- `scripts/tool-registry.mjs`, `scripts/generate-seo-site.mjs`
- `background-remover-app/src/components/ToolContentGuide.tsx`, `SiteFooter.tsx` (content links only)
- `tests/seo-contract.mjs`, `tests/seo-count-contract.mjs`, `package.json`

Normal generated changes include `dist/`, the Background Remover Vite entry/hashed bundle, SEO/content/UI reports and `netlify/functions/_seo-build-counts.mjs` / `_admin-product-snapshot.mjs`. The Background Remover build replaces its prior hashed JS artifact with the new generated bundle; it does not remove the application or WASM assets. Unrelated modified files visible in Git were already dirty and are not claimed as Phase 4 work.

## Validation

- `npm run build`: **PASS, exit 0**, including lint, Background Remover TypeScript/Vite, the full `npm test` with pre/post tests and six Vitest files / ten tests.
- `npm run test:phase4`: **PASS** — 123 public HTML pages, all 81 indexable tool section sets, 20 resource pages, 1,153 internal links, unique titles/descriptions, one H1, canonical URLs and category publication filtering.
- SEO and SEO-count contracts: **PASS** — 109 sitemap URLs, 123 single-GTM pages, 109 single-AdSense pages, robots/ads.txt and exclusion checks.
- Direct-route HTTP contracts: **PASS** — static MIME types, assets, representative routes, real 404 and source isolation.
- `npm run test:phase4:browser`: **PASS, exit 0** — 28 routes with JS enabled and disabled (56 checks), at 320/360/390/412/430/768/1366/1440 widths; nested SPA navigation and reload; six screenshots. Mobile drawer checks wait for the actual closed/inert state after resizing. A screenshot initially caught the existing transition mid-frame; the final capture checks the settled state rather than hiding the menu with test CSS.
- `npm run test:ux-phase3:browser`: **PASS, exit 0** — nine real-file processing/download/reset flows, 53 upload-first layouts, the 95-route inventory, keyboard picker, invalid input, mobile overflow and empty-ad-zone checks against the Phase 4 build.
- Contact Support local contract: **PASS** — validation, real persistence path, duplicate protection and admin authorization tested with controlled fixtures. No fabricated production submission was sent; live delivery was not tested.
- `git diff --check`: **PASS, exit 0**; existing line-ending normalization warnings are not whitespace errors.

The first build failed because a new no-JS notice added a second noscript element and tripped the existing GTM contract. The notice is now ordinary static-shell text; the contract was preserved and the final build passed. The isolated PostgreSQL integration remains intentionally skipped under its existing opt-in policy. Vite retains its existing non-fatal classic tool-content script warning.

Browser evidence: `test-results/phase4-content/results.json` plus mobile JS/no-JS screenshots of PDF tools, the OCR guide and JSON Formatter. Local tests block Google tracking/advertising requests to avoid test impressions.

## Remaining work before Phase 5

1. Finish the 33-route legacy sentence-frame cleanup and reassess the 157 near-match pairs; not every flagged pair is a defect, but they require explicit editorial judgment. No claim of completed site-wide originality is made.
2. Human fact-check and publisher approval of the new material, with real review records. The 20 new resource pages are local drafts, not approved published content.
3. Owner review of actual production behavior and external advertising configuration if publication is later authorized. Local fixtures do not certify all real devices, every document variation or live third-party behavior.

No guarantee of Google AdSense approval. Nothing was committed, pushed or deployed.
