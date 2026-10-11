# GXA Toolbox AdSense, Content, and Public-Route Audit

Audit date: 2026-09-29  
Production host reviewed: `https://gxatoolbox.in`  
Repository reviewed: `gxatechnology/GXA-Toolbox`  
Registry total: **95 public tools**

## Scope and method

This is a code-level audit of the current repository and generated `dist/` output. It reviewed the central tool registry, public route generator, initial HTML, tool engines, UI rendering paths, legal pages, metadata, canonical URLs, structured data, `robots.txt`, sitemap, Netlify redirects/headers, AdSense/GTM placement, privacy disclosures, and the repository's contract tests. It is not a promise that Google will approve AdSense, and it does not replace live-device testing of every possible input file.

The classifications below use the implementation actually present, not marketing copy alone:

- **Fully working:** a real browser/WASM implementation produces the advertised core result within documented limits.
- **Partially working:** the route has a real implementation, but browser capability, source-format fidelity, scope, or accuracy is materially limited.
- **Simulated fallback:** the main path can work, but an advertised fallback returns fixed/example data rather than the promised result.
- **Dependency-blocked/broken:** no usable implementation was found for the advertised core operation. None is currently in this category after the PPT contract and implementation were inspected.

## Executive summary

| Measure | Result |
|---|---:|
| Registered public tools | 95 |
| Fully working tools | 62 |
| Partially working tools | 32 |
| Simulated-fallback tools | 1 |
| Dependency-blocked tools | 0 |
| Broken tools | 0 |
| Tool pages currently marked `index,follow` | 95 |
| Tool pages recommended safe to index now | **81** |
| Tool pages recommended for temporary `noindex` and no ads pending fixes | **14** |
| Sitemap URLs | 103 |
| Static company/legal/help pages | 7 |

The site is not a collection of empty shells: generated tool pages contain meaningful pre-JavaScript explanatory content. The largest AdSense risks are instead **unsafe result rendering on several public utilities, one simulated UUID fallback, an under-delivering HTML-to-PDF route, site-wide indexing/ads without a quality gate, and highly repeated generated descriptions/FAQ patterns that make otherwise substantive pages look mass-produced**.

Recommended temporary noindex/no-ad routes until the cited issues are corrected:

`/qr-reader/`, `/barcode-reader/`, `/base64-tool/`, `/url-tool/`, `/case-converter/`, `/cron-generator/`, `/css-beautifier/`, `/js-beautifier/`, `/html-beautifier/`, `/sql-formatter/`, `/xml-to-json/`, `/user-agent/`, `/html-to-pdf/`, and `/uuid-generator/`.

This recommendation is conservative. It protects users and removes the weakest/riskiest routes from the monetized index while preserving them for remediation. It is not implemented by this audit.

## Critical issues

### C1. User-controlled output is inserted with `innerHTML` on public utility routes

- **File path:** `public_html/assets/app.js:7865-7890`, `9669-9674`, `10378-10429`, `10506-10552`, `10665-10705`, `10860-10880`, `10954-10959`
- **Routes:** `/qr-reader/`, `/barcode-reader/`, `/base64-tool/`, `/url-tool/`, `/case-converter/`, `/cron-generator/`, `/css-beautifier/`, `/js-beautifier/`, `/html-beautifier/`, `/sql-formatter/`, `/xml-to-json/`, `/user-agent/`
- **Problem:** decoded barcode/QR payloads, transformed user text, formatter output, cron fields, XML-derived JSON, and navigator strings are interpolated into `innerHTML`. Several values are placed inside a `<textarea>` string, where a crafted `</textarea>` sequence can escape the intended container. The QR result is also interpolated into an inline `onclick` attribute. This creates DOM-injection/XSS exposure in public, ad-enabled pages.
- **Recommended fix:** build result DOM with `document.createElement`; assign textarea `.value` and visible output `.textContent`; attach copy handlers with `addEventListener`; remove inline handlers; add regression payloads containing closing tags, quotes, SVG, and event attributes.
- **Effect:** **security, trust, functionality, and AdSense policy risk.** A public tool that renders untrusted content unsafely should not carry ads or be promoted for indexing until fixed.

### C2. All 95 tool routes are indexed and receive AdSense without a quality/safety gate

- **File path:** `scripts/tool-registry.mjs:33-40`, `scripts/generate-seo-site.mjs:39-44`, `scripts/generate-seo-site.mjs:357-416`, generated `dist/sitemap.xml`
- **Routes:** all public tool routes; especially the 14 routes listed in the executive summary
- **Problem:** the blocked-tool set is currently empty. The generator already supports removing AdSense with `withoutAdSense()`, but every tool is emitted as indexable and all 95 enter the sitemap regardless of implementation risk. This exposes the weakest pages to both Google Search and AdSense review.
- **Recommended fix:** introduce one central route-quality disposition (`indexable`, `noindex`, `adsEligible`, reason). Make sitemap, robots metadata, AdSense stripping, route audits, and tests consume it. Do not hide broken pages with robots.txt; serve `noindex,follow` while remediation is in progress.
- **Effect:** **AdSense, SEO, and trust.** A few unsafe or misleading pages can reduce the perceived quality of the whole domain.

## High-priority issues

### H1. HTML to PDF drops content and materially overstates its output

- **File path:** `public_html/assets/app.js:505`, `10015-10028`; content entry in `public_html/assets/tool-content.js`
- **Route:** `/html-to-pdf/`
- **Problem:** the engine removes tags with a regex, creates one page, truncates every line to 80 characters, and silently discards all remaining content after the first page fills. It does not render HTML structure or paginate the document as the route description implies.
- **Recommended fix:** either implement a bounded DOM-to-PDF paginator that preserves supported headings, paragraphs, lists, tables, links, wrapping, and multiple pages, or narrow the route/name/copy to an honest plain-text extraction scope. Add fixtures proving long multi-page input is not lost.
- **Effect:** **functionality, trust, AdSense, and SEO.** A prominent conversion tool that silently loses content is low-value and misleading.

### H2. Tool-page content is substantive but heavily template-shaped

- **File path:** `public_html/assets/tool-content.js:240-369`, `scripts/tool-registry.mjs:98-101`, `public_html/assets/app.js:1616-1619`
- **Routes:** broad groups across image, converter, utility, and calculator pages; metadata affects 94 of 95 tools
- **Problem:** large route families are generated from repeated feature/how-to/use-case/FAQ sentence frames. In addition, 94 meta descriptions end with the identical sentence, “Use it with GXA Toolbox.” Exact-duplicate tests pass because tool names and nouns differ, but the editorial pattern remains obvious and can look like scaled template content.
- **Recommended fix:** prioritize the highest-search-intent tools and replace slot-filled paragraphs with route-specific examples, technical constraints, troubleshooting, output validation, and genuinely distinct FAQs. Remove the repeated meta suffix and keep descriptions concise and intent-specific. Do not bulk paraphrase with superficial synonyms.
- **Effect:** **AdSense and SEO.** This is the clearest repository-level explanation for a “low value content” decision despite adequate raw word counts.

### H3. UUID Generator has a fixed, repeated “random” fallback

- **File path:** `public_html/assets/app.js:10313-10327`; claim in `public_html/assets/tool-content.js` UUID entry
- **Route:** `/uuid-generator/`
- **Problem:** when `crypto.randomUUID` is unavailable, every requested UUID becomes the same hardcoded sample `f81d4fae-7dec-11d0-a765-00a0c91e6bf6`. The content claims a secure browser-crypto fallback that does not exist in this implementation.
- **Recommended fix:** implement an RFC 4122/9562-compliant v4 fallback using `crypto.getRandomValues`, or show a clear unsupported message. Test version/variant bits and uniqueness; never return an example identifier as generated data.
- **Effect:** **functionality and trust; misleading claim.** Temporarily noindex and remove ads until corrected.

### H4. Several “formatter/parser” names overstate regex-only or display-only behavior

- **File path:** `public_html/assets/app.js:10378-10394`, `10506-10552`, `10860-10880`; registry entries around `public_html/assets/app.js:529-537`
- **Routes:** `/user-agent/`, `/css-beautifier/`, `/js-beautifier/`, `/html-beautifier/`, `/sql-formatter/`
- **Problem:** User Agent Parser only prints the current `navigator` values and does not parse an arbitrary UA string. CSS/JS/HTML/SQL formatting uses simple regex replacement, which can alter strings, comments, templates, embedded languages, or nested syntax. Some registry wording mentions minification although these controls primarily beautify.
- **Recommended fix:** narrow names/copy to the actual scope or adopt maintained parsers/formatters with strict size limits and workers. Add adversarial fixtures for comments, quoted braces/semicolons, template literals, data URLs, malformed markup, and SQL dialects.
- **Effect:** **AdSense, SEO, trust, and functionality.** Search-intent promises do not consistently match the engine.

### H5. QR and barcode readers rely on an unevenly supported browser API

- **File path:** `public_html/assets/app.js:10188-10212`; capability handling in the tool workspace
- **Routes:** `/qr-reader/`, `/barcode-reader/`
- **Problem:** both tools depend on `BarcodeDetector`; unsupported browsers receive an unavailable path and there is no packaged ZXing fallback. This is a real browser limitation, not a fully universal reader.
- **Recommended fix:** add a lazy local ZXing JS/WASM fallback, keep file bytes local, and test common QR/CODE128/EAN fixtures in browsers without `BarcodeDetector`.
- **Effect:** **functionality, mobile trust, and AdSense.** The routes currently promise broader availability than they deliver.

### H6. Homepage still contains stale-domain, generic mockup, and “template-like” presentation cues

- **File path:** `public_html/assets/app.js:2472-2500`; `public_html/assets/style.css:1273-1304`, `4455`, `4488-4493`
- **Route:** `/`
- **Problem:** the product-window mockup visibly shows `gxa-toolbox.app`, not the production domain. It also shows a generic “PDF · up to 100 MB” message while several real PDF tools use 25 MB caps. Floating tool labels run an infinite animation; legacy pulse/float CSS also remains. The status dot itself is static, but the surrounding mock-product animation contributes to a generic AI-template appearance.
- **Recommended fix:** replace the faux domain with `gxatoolbox.in`, make capacity copy route-specific or remove it, and reduce decorative infinite motion (including a complete `prefers-reduced-motion` path). Keep the existing design system; this does not require a homepage redesign.
- **Effect:** **trust, brand accuracy, accessibility, and AdSense review quality.** This is the only repository occurrence of `gxa-toolbox.app` found in public application code.

### H7. The engine audit is stale for PPT to PDF

- **File path:** `docs/TOOL_ENGINE_AUDIT.md` PPT row and final counts; `public_html/assets/pptx-to-pdf.js`; `tests/ppt-to-pdf-contract.mjs`
- **Route:** `/ppt-to-pdf/`
- **Problem:** the older audit still labels the route unavailable, while the current implementation and passing contract provide a bounded/basic PPTX renderer. The current UI may still expose the unavailable state under unsupported conditions, but the documentation no longer represents the shipped implementation.
- **Recommended fix:** update the engine audit after a browser export test with representative PPTX files, clearly describing unsupported effects/fonts/animations/layout differences and any remaining `.ppt` limitation.
- **Effect:** **trust and operational accuracy.** Contradictory internal evidence makes quality decisions and public claims harder to maintain.

## Medium-priority issues

### M1. Useful prose is static, but navigation and all tool functionality still depend on JavaScript

- **File path:** `scripts/generate-seo-site.mjs`, `index.html`, generated `dist/*/index.html`, `public_html/assets/app.js`
- **Routes:** homepage and all tool routes
- **Problem:** generated routes include static H1s, explanatory sections, links, metadata, and JSON-LD before JavaScript. However, the tool workspace, controls, global header, and footer are mounted by JavaScript. A script failure leaves readable content but no usable tool or complete global navigation.
- **Recommended fix:** keep the static guide content, add a small static primary-navigation fallback in the template, and make initialization failures visible and route-specific. Do not duplicate the entire interactive workspace in HTML.
- **Effect:** **SEO crawlability, accessibility, and functionality resilience.** This is not a thin-HTML failure, but it is a resilience gap.

### M2. Local-processing notices omit authenticated filename/history telemetry context

- **File path:** `public_html/assets/tool-content.js:6-10`; `public_html/assets/app.js:810-849`; legal/privacy content generated from `scripts/generate-seo-site.mjs`
- **Routes:** most tool routes for signed-in users
- **Problem:** tool notices correctly state that selected file bytes are not sent to the application server. Separately, authenticated history sends job metadata including filename, tool, size, and status. The privacy policy discloses history metadata, but the immediate tool notice does not make this distinction obvious.
- **Recommended fix:** preserve the accurate “file bytes stay local” statement and add a concise signed-in disclosure near history controls: filenames and operation metadata may be saved to the user's account; content bytes are not uploaded by the tool engine. Offer a clear history setting if the product supports one.
- **Effect:** **privacy transparency and trust.** The current wording is technically narrow rather than demonstrably false, but it can be misunderstood.

### M3. PNG to SVG UI wording implies vectorization

- **File path:** `public_html/assets/app.js:7814`, `10093-10109`; registry/content entries for `png-to-svg`
- **Route:** `/png-to-svg/`
- **Problem:** the implementation honestly wraps raster data in an SVG `<image>`, but the success toast says “wrapped as SVG path” and the output name includes `_vector.svg`. No path tracing/vector conversion occurs.
- **Recommended fix:** call the result “raster image embedded in SVG” and remove “path/vector” wording unless real tracing is added.
- **Effect:** **trust, search-intent accuracy, and AdSense quality.** The core output is valid SVG but not the vectorization many users expect.

### M4. Raw word count hides route-quality differences

- **File path:** generated `dist/*/index.html`; `tests/tool-content-contract.mjs`; content generator in `public_html/assets/tool-content.js`
- **Routes:** all tools
- **Problem:** generated tool pages range from about 395 to 1,600 visible words (average about 584), so they are not empty. Existing tests verify presence and duplication thresholds, not whether instructions match the runtime engine, whether output is safe, or whether examples are genuinely useful.
- **Recommended fix:** add per-route assertions for advertised inputs, limitations, actual controls, and verified output behavior. Treat content contracts as schema checks, not proof of value.
- **Effect:** **AdSense and trust.** Passing a word-count/content contract does not establish usefulness.

## Low-priority issues

### L1. “95 tools” is not hardcoded in public marketing, but it is present in tests/docs

- **File path:** repository documentation and test output strings; runtime count in `public_html/assets/app.js:2475`
- **Route:** `/`
- **Problem:** the visible homepage uses `toolsList.length`, which is correct and maintainable. Literal “95 tools” references remain in non-public audit/test material. These are not a production content defect but can become stale.
- **Recommended fix:** have internal reports/tests derive totals from the registry when convenient; no urgent public change is needed.
- **Effect:** **maintenance only.** No direct AdSense or SEO harm was found from a public hardcoded count.

### L2. Legacy pulse/float styles remain even where the current element is static

- **File path:** `public_html/assets/style.css:1273-1304`, `4455`, `4488-4493`, `4759`
- **Route:** `/`
- **Problem:** `.status-dot` does not blink, and reduced-motion handling exists for the current floating labels, but older pulse/float rules remain in the production stylesheet and make motion behavior harder to audit.
- **Recommended fix:** remove dormant selectors only after confirming no route uses them; keep reduced-motion coverage.
- **Effect:** **maintainability and minor performance/accessibility risk.** Not itself an AdSense blocker.

## Initial HTML, SEO, legal, and routing findings

### Initial HTML before JavaScript

| Page type | Initial HTML finding |
|---|---|
| Homepage | Generated production HTML contains about 276 visible words, a meaningful H1/summary, category content, and six crawlable links before JS. The richer interactive hero/tool directory mounts afterward. |
| Tool routes | All 95 generated pages contain a route-specific title/H1, canonical, description, JSON-LD, static guide sections, limitations, FAQs, related links, and roughly 395-1,600 visible words before JS (average about 584). The actual tool workspace is JS-dependent. |
| Background Remover | The Vite/React shell is supplemented by the generator with static route content, metadata, and related links before the application mounts. |
| Legal/company pages | `/about/`, `/careers/`, `/security/`, `/privacy-policy/`, `/terms/`, `/gdpr/`, and `/help/` contain substantive static content and are included in the sitemap. |
| Dashboard/admin | Excluded from the sitemap and served with noindex controls. They should remain private/non-monetized. |
| Invalid routes | Repository direct-route tests verify a real 404 rather than a catch-all soft 404. |

### Technical SEO status

- `dist/sitemap.xml` contains **103** canonical HTTPS URLs: homepage, 95 tools, and 7 public company/legal/help pages.
- All sitemap hosts and canonicals use `https://gxatoolbox.in/`.
- `robots.txt` allows public rendering assets, disallows `/api/` and `/.netlify/functions/`, and references `https://gxatoolbox.in/sitemap.xml`.
- Netlify rules preserve direct static tool routes and redirect `www`/Netlify-host variants to the production host.
- Tool pages expose self-referencing canonicals rather than canonicalizing to the homepage.
- No site-wide `noindex` was found. Current tool disposition is 95 indexable / 0 noindex.
- The only `gxa-toolbox.app` occurrence found in public code is the homepage faux browser address at `public_html/assets/app.js:2489`.
- No public hardcoded “95 tools” marketing string was found; the visible homepage total is registry-derived.
- GTM, AdSense, metadata, JSON-LD, and legal content were not changed by this audit.

## Complete public tool inventory

“Content improvement: Yes” means a focused editorial review is recommended; it does not mean the page is empty. Most entries need at least removal of the repeated meta-description suffix, and 68 routes also use strongly repeated body/FAQ frames. “Safe to index” is the recommendation after this audit, not the current generated directive.

| # | Tool name | Route | Category | Working status | Safe to index | Needs technical fix | Needs content improvement |
|---:|---|---|---|---|:---:|:---:|:---:|
| 1 | Edit PDF | `/edit-pdf/` | PDF | Partial: form/overlay scope | Yes | Yes | Yes |
| 2 | Merge PDF | `/merge-pdf/` | PDF | Fully working | Yes | No | Yes |
| 3 | Organize PDF | `/organize-pdf/` | PDF | Fully working | Yes | No | Yes |
| 4 | Compress Image | `/compress-image/` | Image | Fully working | Yes | No | Yes |
| 5 | Resize Image | `/resize-image/` | Image | Fully working | Yes | No | Yes |
| 6 | Image Converter | `/image-converter/` | Image | Partial: bounded codec/fidelity scope | Yes | Yes | Yes |
| 7 | GPS Map Camera – Geotag Photo | `/gps-map-camera/` | Image | Partial: browser/EXIF/map limits | Yes | Yes | Yes |
| 8 | Crop Image | `/crop-image/` | Image | Fully working | Yes | No | Yes |
| 9 | Image OCR | `/image-ocr/` | Image | Partial: OCR/language/model limits | Yes | Yes | No immediate |
| 10 | Background Remover | `/background-remover/` | Image | Fully working (WASM) | Yes | No | Yes |
| 11 | Password Generator | `/password-generator/` | Utility | Fully working | Yes | No | Yes |
| 12 | QR & Barcode Generator | `/barcode-generator/` | Utility | Fully working | Yes | No | Yes |
| 13 | Color Extractor | `/color-extractor/` | Utility | Fully working | Yes | No | Yes |
| 14 | ZIP Manager | `/zip-manager/` | ZIP | Fully working | Yes | No | Yes |
| 15 | Split PDF | `/split-pdf/` | PDF | Fully working | Yes | No | Yes |
| 16 | Protect PDF | `/protect-pdf/` | PDF | Fully working (WASM) | Yes | No | Yes |
| 17 | Unlock PDF | `/unlock-pdf/` | PDF | Fully working (WASM) | Yes | No | Yes |
| 18 | PDF to JPG | `/pdf-to-jpg/` | PDF | Fully working | Yes | No | Yes |
| 19 | JPG to PDF | `/jpg-to-pdf/` | PDF | Fully working | Yes | No | Yes |
| 20 | Word to PDF | `/word-to-pdf/` | PDF | Partial: semantic, not print fidelity | Yes | Yes | Yes |
| 21 | PDF to Text/RTF | `/pdf-to-word/` | PDF | Partial: text extraction, not DOCX | Yes | Yes | Yes |
| 22 | EPUB to PDF | `/epub-to-pdf/` | Convert | Partial: reflowable EPUB scope | Yes | Yes | Yes |
| 23 | PDF to EPUB | `/pdf-to-epub/` | Convert | Partial: reflowed text scope | Yes | Yes | Yes |
| 24 | GIF Maker | `/gif-maker/` | Convert | Fully working | Yes | No | Yes |
| 25 | ZIP Extractor | `/zip-extractor/` | ZIP | Fully working | Yes | No | Yes |
| 26 | Compress PDF | `/compress-pdf/` | PDF | Fully working (WASM) | Yes | No | Yes |
| 27 | Rotate PDF | `/rotate-pdf/` | PDF | Fully working | Yes | No | Yes |
| 28 | Add Watermark | `/watermark-pdf/` | PDF | Fully working | Yes | No | Yes |
| 29 | Add Page Numbers | `/pagenumber-pdf/` | PDF | Fully working | Yes | No | Yes |
| 30 | PDF Metadata Editor | `/pdf-metadata/` | PDF | Fully working | Yes | No | Yes |
| 31 | Excel to PDF | `/excel-to-pdf/` | Convert | Partial: data-table, not print fidelity | Yes | Yes | Yes |
| 32 | PPT to PDF | `/ppt-to-pdf/` | Convert | Partial: basic PPTX renderer | Yes | Yes | Yes |
| 33 | PDF to Text | `/pdf-to-text/` | Convert | Partial: selectable text only | Yes | Yes | Yes |
| 34 | HTML to PDF | `/html-to-pdf/` | Convert | Partial: severe truncation/data loss | **No** | Yes | Yes |
| 35 | PDF to HTML | `/pdf-to-html/` | Convert | Partial: text-based HTML | Yes | Yes | Yes |
| 36 | Markdown to PDF | `/markdown-to-pdf/` | Convert | Partial: limited Markdown subset | Yes | Yes | Yes |
| 37 | PDF to Markdown | `/pdf-to-markdown/` | Convert | Partial: heuristic structure | Yes | Yes | Yes |
| 38 | SVG to PNG | `/svg-to-png/` | Convert | Fully working | Yes | No | Yes |
| 39 | PNG to SVG | `/png-to-svg/` | Convert | Partial: raster wrapper, no tracing | Yes | Yes | Yes |
| 40 | WEBP to JPG | `/webp-to-jpg/` | Convert | Fully working | Yes | No | Yes |
| 41 | GIF Frame Extractor | `/gif-to-png/` | Convert | Fully working | Yes | No | Yes |
| 42 | Text-to-Speech Reader | `/text-to-speech/` | Utility | Partial: browser voice availability | Yes | Yes | Yes |
| 43 | QR Code Reader | `/qr-reader/` | Utility | Partial: BarcodeDetector only; unsafe sink | **No** | Yes | Yes |
| 44 | Barcode Scanner | `/barcode-reader/` | Utility | Partial: BarcodeDetector only; unsafe sink | **No** | Yes | Yes |
| 45 | Base64 Tool | `/base64-tool/` | Utility | Fully working; unsafe result sink | **No** | Yes | Yes |
| 46 | URL Encoder/Decoder | `/url-tool/` | Utility | Fully working; unsafe result sink | **No** | Yes | Yes |
| 47 | JSON Formatter | `/json-tool/` | Utility | Fully working | Yes | No | Yes |
| 48 | Hash Generator | `/hash-tool/` | Utility | Fully working | Yes | No | Yes |
| 49 | Text Case Converter | `/case-converter/` | Utility | Fully working; unsafe result sink | **No** | Yes | Yes |
| 50 | Word Counter | `/word-counter/` | Utility | Fully working | Yes | No | Yes |
| 51 | Lorem Ipsum Generator | `/lorem-ipsum/` | Utility | Fully working | Yes | No | Yes |
| 52 | Diff Checker | `/diff-checker/` | Utility | Fully working | Yes | No | Yes |
| 53 | SQL Formatter | `/sql-formatter/` | Utility | Partial: regex formatter; unsafe sink | **No** | Yes | Yes |
| 54 | XML to JSON Converter | `/xml-to-json/` | Utility | Fully working; unsafe result sink | **No** | Yes | Yes |
| 55 | UUID Generator | `/uuid-generator/` | Utility | **Simulated fallback** | **No** | Yes | Yes |
| 56 | User Agent Parser | `/user-agent/` | Utility | Partial: display-only; unsafe sink | **No** | Yes | Yes |
| 57 | Regex Tester | `/regex-tester/` | Utility | Fully working | Yes | No | Yes |
| 58 | Markdown Editor | `/markdown-editor/` | Utility | Partial: limited renderer | Yes | Yes | Yes |
| 59 | CSS Formatter | `/css-beautifier/` | Utility | Partial: regex formatter; unsafe sink | **No** | Yes | Yes |
| 60 | JS Formatter | `/js-beautifier/` | Utility | Partial: regex formatter; unsafe sink | **No** | Yes | Yes |
| 61 | HTML Formatter | `/html-beautifier/` | Utility | Partial: regex formatter; unsafe sink | **No** | Yes | Yes |
| 62 | Cron Expression Helper | `/cron-generator/` | Utility | Partial: five-field subset; unsafe sink | **No** | Yes | Yes |
| 63 | Color Converter | `/color-converter/` | Utility | Fully working | Yes | No | Yes |
| 64 | EXIF Metadata Viewer | `/exif-viewer/` | Utility | Fully working | Yes | No | Yes |
| 65 | Epoch Converter | `/timestamp-converter/` | Utility | Fully working | Yes | No | Yes |
| 66 | Remove PDF Pages | `/remove-pdf-pages/` | PDF | Fully working | Yes | No | Yes |
| 67 | Extract PDF Pages | `/extract-pdf-pages/` | PDF | Fully working | Yes | No | Yes |
| 68 | Extract Images | `/extract-images-pdf/` | PDF | Partial: embedded-raster subset | Yes | Yes | Yes |
| 69 | Crop PDF | `/crop-pdf/` | PDF | Fully working | Yes | No | Yes |
| 70 | Add Header & Footer | `/header-footer-pdf/` | PDF | Fully working | Yes | No | Yes |
| 71 | Sign PDF | `/sign-pdf/` | PDF | Partial: visual, not certificate signature | Yes | Yes | Yes |
| 72 | Repair PDF | `/repair-pdf/` | PDF | Partial: readable PDFs only | Yes | Yes | Yes |
| 73 | OCR PDF | `/ocr-pdf/` | PDF | Partial: English/text output limits | Yes | Yes | Yes |
| 74 | Image to PDF | `/image-to-pdf/` | Convert | Fully working | Yes | No | Yes |
| 75 | PNG to PDF | `/png-to-pdf/` | Convert | Fully working | Yes | No | Yes |
| 76 | TXT to PDF | `/txt-to-pdf/` | Convert | Fully working | Yes | No | Yes |
| 77 | PDF to Image | `/pdf-to-image/` | Convert | Fully working | Yes | No | Yes |
| 78 | PDF to PNG | `/pdf-to-png/` | Convert | Fully working | Yes | No | Yes |
| 79 | PDF to Excel | `/pdf-to-excel/` | Convert | Partial: heuristic tables | Yes | Yes | Yes |
| 80 | PDF to PPT | `/pdf-to-ppt/` | Convert | Partial: page-image slides | Yes | Yes | Yes |
| 81 | Simple Calculator | `/calculator/` | Calculator | Fully working | Yes | No | Yes |
| 82 | Scientific Calculator | `/scientific-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 83 | Percentage Calculator | `/percentage-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 84 | Age Calculator | `/age-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 85 | Date Calculator | `/date-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 86 | EMI Calculator | `/emi-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 87 | Loan Calculator | `/loan-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 88 | Interest Calculator | `/interest-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 89 | GST Calculator | `/gst-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 90 | SIP Calculator | `/sip-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 91 | BMI Calculator | `/bmi-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 92 | Discount Calculator | `/discount-calculator/` | Calculator | Fully working | Yes | No | Yes |
| 93 | Unit Converter | `/unit-converter/` | Calculator | Fully working | Yes | No | Yes |
| 94 | Currency Converter | `/currency-converter/` | Calculator | Fully working: manual rate only | Yes | No | Yes |
| 95 | Time Calculator | `/time-calculator/` | Calculator | Fully working | Yes | No | Yes |

### Inventory count reconciliation

- Fully working: **62**
- Partially working: **32**
- Simulated fallback: **1** (`/uuid-generator/`)
- Dependency-blocked: **0**
- Broken: **0**
- Recommended indexable: **81**
- Recommended temporary noindex/no-ad: **14**

These counts deliberately separate “engine produces a result” from “route is currently safe to index and monetize.” Four otherwise functioning utilities are in the noindex set because unsafe rendering is a technical/security issue, not because their core transform is absent.

## Public non-tool route disposition

| Route | Current purpose | Recommendation |
|---|---|---|
| `/` | Homepage/tool discovery | Index; correct stale faux domain and generic capacity copy |
| `/about/` | Company/product information | Index |
| `/help/` | Support/help | Index |
| `/security/` | Security and processing model | Index; keep claims synchronized with implementation |
| `/privacy-policy/` | Privacy/legal | Index |
| `/terms/` | Terms/legal | Index |
| `/gdpr/` | Data-rights information | Index |
| `/careers/` | Company careers information | Index if maintained and genuinely useful |
| `/dashboard/` | User-specific account data | Keep noindex and ad-free |
| `/admin/` | Administrative application | Keep noindex and ad-free |
| `/api/*`, `/.netlify/functions/*` | APIs/functions | Never include in sitemap; retain access controls |
| invalid routes | Not found | Keep real 404/noindex behavior |

## Recommended remediation order

1. Fix unsafe result rendering and add hostile-input browser tests.
2. Apply the central route-quality/index/ads gate and temporarily exclude the 14 cited routes.
3. Replace the UUID example fallback and correct HTML-to-PDF data loss.
4. Align formatter/parser names and claims with their real engines; add a barcode fallback.
5. Correct `gxa-toolbox.app`, the generic 100 MB mockup claim, and excessive decorative motion.
6. Rewrite priority route content from verified engine evidence, starting with high-intent PDF/image tools; avoid mass synonym changes.
7. Update the stale engine audit and make route/content contracts validate actual runtime behavior.
8. Clarify signed-in history metadata next to local-file-processing claims.

## Verification performed

The following repository checks were run and exited successfully during this audit:

- `node tests/repository-audit.mjs` — 95 tools; 92 local, 1 local-WASM registry mode, 2 browser-capability routes.
- `node tests/browser-engine-contract.mjs` — passed for the 95-tool registry.
- `node tests/ppt-to-pdf-contract.mjs` — passed the current PPTX fixtures and invalid-input checks.
- `node tests/tool-content-contract.mjs` — passed for all 95 content records.
- `node tests/seo-contract.mjs` — passed for 95 tools, 7 content pages, 103 sitemap/GTM/AdSense pages.
- `node tests/seo-count-contract.mjs` — confirmed current state: 95 indexable tools, 0 noindex tools, 103 sitemap URLs, 105 generated routes including private routes.
- `node tests/direct-route-seo.mjs` — passed direct-route, 404, MIME, asset, and source-isolation checks.
- `node tests/navigation-calculator-contract.mjs` — passed navigation and calculator route contracts.

These are contract/code checks, not complete interactive browser processing tests for every file type. The report therefore keeps fidelity- or capability-limited tools in the partial category even when a contract passes.

## Audit conclusion

GXA Toolbox already has strong technical SEO foundations and real implementations behind most routes. The repeated AdSense “low value content” outcome is more plausibly connected to **quality inconsistency across a very large index, formulaic generated prose, weak/overstated utility implementations, and trust/security defects on monetized routes** than to a missing sitemap or empty initial HTML.

No homepage redesign, bulk content rewrite, route removal, engine replacement, indexing change, AdSense change, commit, push, or deployment was performed as part of this report.

## Phase 2 Remediation Status

The findings and inventory above are the original audit snapshot, not the post-remediation state. See `ADSENSE_PHASE2_CHANGES.md` for implementation details and verification limitations.

| Finding | Status | Phase 2 disposition |
|---|---|---|
| C1 Unsafe utility output | Fixed for audited public sinks | Text results use DOM construction, textarea values and text nodes. QR/barcode copy handlers no longer interpolate payloads. EXIF, browser information, toast messages and archive filenames are escaped/rendered safely. Hostile-input regression fixtures cover the affected utility functions. |
| C2 Missing quality gate | Fixed | One browser/build policy preserves 95 routes, approves 81 for indexing/ads, and makes 14 noindex/no-ad. Unknown future tools fail closed. Partial-functionality flags are not represented as full verification. |
| H1 HTML-to-PDF data loss | Fixed within disclosed scope | Multi-page supported-text reflow replaces truncation. Long paragraphs, tables and words are tested. Unsupported characters/media fail explicitly. This is not a CSS print-layout engine. |
| H2 Formulaic editorial content | Deferred | No bulk rewrite; route-specific editorial work remains Phase 3. |
| H3 Fixed UUID fallback | Fixed | Secure randomUUID/getRandomValues implementation; explicit failure without cryptography; 5,000 fallback UUID regression check. |
| H4 Formatter/parser overclaims | Partially fixed | Descriptions identify textual/regex transformations; Browser Information no longer promises UA parsing. Parser-grade fidelity remains unimplemented and affected routes remain under review. |
| H5 Native-only readers | Fixed with verification limitation | Lazy local ZXing fallback decodes real QR and Code128 images in Chrome. Native dispatch tested with controlled API fixtures; installed Chrome lacks real BarcodeDetector. |
| H6 Stale brand/mockup | Fixed for public assets | Current domain, neutral mockup and no hero tool-count marketing. Historical stale-domain quotations above are intentionally retained as audit evidence. |
| H7 Stale PPT engine audit | Deferred | Requires a dedicated fidelity/browser review; renderer unchanged. |
| M1 JavaScript resilience | Deferred | Existing static guides retained; no architecture redesign. |
| M2 Immediate history/privacy disclosure | Deferred | Authentication/history/legal behavior unchanged. |
| M3 Raster SVG wording | Fixed | Success wording and `_embedded.svg` filename describe raster embedding, not tracing. |
| M4 Quality beyond word counts | Partially fixed | Real output and hostile-input tests added for this scope; not a new 95-tool end-to-end certification. |
| L1 Tool-count marketing | Fixed as requested | Hero counts and promotional guide count removed; functional filter/result counts remain. |
| L2 Hero animation | Fixed | Hero pulse/float animation disabled; dot removed. |

The 14 review routes remain noindex/no-ad even when a defect has been repaired; promotion requires a separate quality decision. No AdSense approval or live ad-serving result is implied by local checks.
