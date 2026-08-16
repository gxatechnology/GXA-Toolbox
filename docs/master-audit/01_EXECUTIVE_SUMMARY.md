# GXA Toolbox — Verified Product Snapshot

Audit date: 2026-08-16
Source authority: current local repository and generated `dist/` build
Confidence labels: **VERIFIED** = confirmed in source; **TESTED** = exercised successfully; **DOCUMENTED** = project documentation only; **INFERRED** = architecture strongly indicates; **UNKNOWN** = insufficient evidence.

| Metric | Verified result | Confidence |
|---|---:|---|
| Registered tools | **92** (the brief's “91” is stale) | VERIFIED |
| Registry categories | **6** | VERIFIED |
| Category distribution | PDF 22; Image 5; Utility/Developer 27; ZIP 2; Convert 21; Calculator 15 | VERIFIED |
| Public direct-route HTML pages | **99**: home + 92 tools + 6 company/legal pages | VERIFIED |
| Indexable sitemap URLs | **98**: home + 91 working tools + 6 company/legal pages | VERIFIED |
| Noindex tool pages | **1**: PPT to PDF | VERIFIED |
| Private direct routes | **2**: dashboard and admin | VERIFIED |
| Generated direct routes | **101** | VERIFIED |
| Generated HTML entrypoints | **102**, including the real 404 page | VERIFIED |
| Source HTML files | **6** (templates, generated Background Remover entry, and fixtures) | VERIFIED |
| Working client-side tool workflows | **91**; one registered blocker | VERIFIED |
| Dedicated Worker workflows | **5**; PDF.js also uses a shared worker for PDF-consuming tools | VERIFIED |
| WASM-primary tools | **3** | VERIFIED |
| File-processing tools using serverless functions | **0** | VERIFIED |
| AI/ML-assisted tools | **3 workflows**: Background Remover, PDF OCR, Image OCR | VERIFIED |
| Netlify Function files | **19**: 11 request handlers and 8 helpers | VERIFIED |
| Active Function endpoints | **8**; 3 legacy auth endpoints deliberately return 410 | VERIFIED |
| Application database tables | **6** | VERIFIED |
| Direct dependencies | **27 unique**: 10 production and 17 development | VERIFIED |
| Vendored library families | **7** across 8 checked-in bundle groups | VERIFIED |
| Test source files | **25** | VERIFIED |
| Automated suites/files in normal test run | **23**: 17 Node contracts + 6 Vitest files | TESTED |
| Static assertion call sites / named Vitest cases | **703 / 10**; looped assertions mean this is not a runtime assertion total | VERIFIED |
| Auth-related modal screens | **5** | VERIFIED |
| Original authored application LOC | **≈33,928**, excluding tests, docs, vendored and generated code | VERIFIED |
| Production host | Netlify | VERIFIED |
| Primary domain | `https://gxatoolbox.in` | VERIFIED |

## Executive assessment

GXA Toolbox is a browser-first multi-utility product with a vanilla-JavaScript primary application and a dedicated React/Vite Background Remover. Its strongest verified attributes are breadth, direct indexable routes, client-side file processing, a unified responsive interface, and unusually broad PDF/image/conversion/developer/calculator coverage in one product.

The product is technically substantial: 92 registered tools, 98 sitemap URLs, 19 Function modules, six database tables, a dedicated ONNX image-segmentation experience, qpdf WASM encryption/decryption, Tesseract OCR, static SEO route generation, Netlify Identity, and a database-backed profile/history layer. The normal lint, test and production-build pipeline passed before this audit phase. Representative local pages were also rendered at 1366×768 and 390×844 without body/document horizontal overflow.

## Status by engine classification

| Classification | Tools | Share |
|---|---:|---:|
| Fully working — browser | 59 | 64.1% |
| Fully working — WASM | 3 | 3.3% |
| Working with browser limitation | 29 | 31.5% |
| Not currently feasible | 1 | 1.1% |

The 91 working tools execute their primary processing on the client. “Client-side” does not mean every dependency is already cached: several tools download libraries, language data, models, or WASM assets on demand.

## Top five differentiators

1. **Verified breadth:** 92 registered tools in six categories with one shared discovery and workspace system.
2. **Browser-first processing:** 91 working workflows process locally in the browser, Worker, or WASM path; no file-processing tool sends uploaded content to a Netlify Function.
3. **Advanced local engines:** ONNX background segmentation, qpdf WASM, Tesseract OCR, PDF.js, pdf-lib, JSZip, Mammoth, SheetJS, PptxGenJS, and GIF engines.
4. **Search-ready route architecture:** 99 public direct pages, per-route metadata/canonicals/schema, sitemap/robots, and a real 404 response.
5. **Unified responsive product shell:** global search, categories, favorites, history/dashboard, dark mode, responsive navigation, previews, downloads, and consistent feedback states.

## Top five limitations

1. **PPT to PDF is deliberately blocked** because no faithful presentation renderer is present; it is noindex and excluded from the sitemap.
2. **Contact Support is mismatched to Netlify:** the UI posts to `/api/contact.php`, but no Netlify mapping/function for that endpoint was found.
3. **Published privacy/security copy is stale** about the normal user-session mechanism; the product now uses Netlify Identity rather than the described legacy session cookie.
4. **Twenty-nine tools have browser limitations** involving fidelity, resource limits, browser APIs, manual rates, OCR language scope, or format constraints.
5. **End-to-end coverage is incomplete:** contracts are extensive, but many real file-processing workflows and touch interactions still depend on manual browser/device QA.

## Top ten roadmap priorities

1. Fix the production Contact Support endpoint or change the UI to the supported Netlify submission architecture.
2. Correct privacy/security/session copy to match Netlify Identity token persistence and current data flows.
3. Add real-browser fixture E2E for critical PDF, image, OCR, ZIP, conversion, download, and auth journeys.
4. Decide whether to integrate a faithful PPT renderer or remove the blocked tool from public discovery while retaining route compatibility.
5. Self-host or harden integrity/versioning for runtime CDN dependencies and OCR language/core assets.
6. Add a complete CSP and review client-side token/XSS exposure.
7. Add rate limiting, lockout and monitoring to the custom admin authentication path.
8. Reduce the ~971 KB raw local initial JS/CSS surface and defer non-home libraries safely.
9. Add total-memory budgets/streaming to heavy PDF, GIF, OCR and archive workflows.
10. Establish consent-management and privacy governance for GTM/AdSense before expanding monetization.

## Decision

**Production maturity: strong but not final.** The build, SEO route generation, main UI, authentication contracts and Background Remover deployment checks pass. The product is suitable for controlled production use, but the support endpoint and identity-related public copy are P0 corrections, while real-browser file-processing QA, CSP hardening and operational controls remain important reliability work.
