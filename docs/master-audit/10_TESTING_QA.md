# Testing and Quality System

## Test inventory

| Metric | Count / result |
|---|---:|
| Test source files | 25 |
| Root Node contract files executed normally | 17 |
| Background Remover Vitest files | 6 |
| Normal executed suites/files | 23 |
| Fixture files | 67 |
| Static `assert` call sites in Node contracts | 703 |
| Named Vitest test cases | 10 |
| PostgreSQL integration | Explicit opt-in via `RUN_POSTGRES_INTEGRATION=true` |

The 703 static call sites are not an exact runtime assertion count because many occur inside loops (for example, over all registered routes). It is therefore accurate to report “703 assertion call sites plus 10 named Vitest cases,” not an invented single total.

## What is covered automatically

- Registry count/uniqueness and repository branding/audit contracts.
- Browser-engine source/asset contracts and selected fixture decoding/ZIP/qpdf checks.
- SEO route generation, metadata, canonicals, structured data, robots, sitemap and noindex policy.
- Direct HTTP behavior for representative generated routes, assets, forbidden source paths and 404.
- GTM/AdSense placement and duplicate/direct-GA4 protections across generated public pages.
- Authentication, Identity integration, Function/schema and navigation contracts.
- Mobile responsive source/layout contracts.
- Calculator/navigation contracts.
- Background Remover source/deployment contracts plus component/store/utility Vitest tests.
- Build output validation, fixture signatures and selected output signatures/decoding.
- Optional isolated PostgreSQL registration/session/history/save-job integration.

## What is not proved automatically

- All 92 tool algorithms are not run end-to-end in a real browser against generated inputs.
- No Playwright/axe/Lighthouse dependency is part of the normal suite.
- Several engine contracts verify source/assets rather than executing the actual browser Worker path.
- OCR quality, large-file memory behavior, browser-native BarcodeDetector/SpeechSynthesis variance and CDN failure modes need manual/device coverage.
- Touch crop, pinch zoom, mask erase/restore, drag reorder, soft keyboard, real download handoff and assistive technology remain manual.
- Production analytics/AdSense behavior and external Netlify configuration cannot be proven by local source alone.

## Latest verified command state before documentation-only audit

| Command | Result |
|---|---|
| `npm ci` | PASS; 0 reported vulnerabilities |
| `npm run lint` | PASS |
| `npm test` | PASS |
| `npm run build` | PASS, exit 0 |
| explicit PostgreSQL integration | PASS |
| `git diff --check` | PASS; line-ending warnings only |

No production code or build was changed in this documentation phase, so the audit does not rerun a mutation-dependent build after writing Markdown/JSON. Final report validation checks the deliverable files, counts, JSON syntax, internal links and production-source preservation.

## Recommended QA ladder

1. Keep fast source/contracts in every commit.
2. Add generated-output reopen/parse tests per file-producing tool family.
3. Add real-browser representative E2E for Home/auth/critical PDF/image/ZIP/developer/calculator flows.
4. Add mobile viewport and keyboard/touch smoke tests at 320, 390, 768 and 1366 widths.
5. Add nightly high-cost OCR/WASM/model/large-file fixtures.
6. Add post-deploy smoke checks for HTTP headers, Functions, Identity, sitemap/robots/ads and real 404.
