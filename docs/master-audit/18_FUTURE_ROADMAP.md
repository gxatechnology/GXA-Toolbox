# Future Roadmap

This is a recommendation set only; nothing here is implemented by the audit.

| Priority | Feature/work | Reason | Expected impact | Complexity | Dependencies | Risk |
|---|---|---|---|---|---|---|
| P0 | Replace/fix `/api/contact.php` flow for Netlify | Support submissions currently lack a mapped endpoint | Restores a core trust/support action | M | Function/form, spam control, email/ticket destination | Privacy/spam/delivery |
| P0 | Correct public Identity/session/privacy wording | Current copy describes a retired cookie model | Accurate trust/legal posture | S | Product/legal review | Misstatement if delayed |
| P0 | Decide PPT-to-PDF disposition | Registered route cannot perform promised faithful output | Removes a visible capability gap | M–XL | Faithful renderer/service or de-listing while preserving route | Cost/privacy/fidelity |
| P1 | Critical real-browser file E2E | Contracts do not execute every primary workflow | Higher release confidence | L | Browser runner, fixtures, download parsers | Flaky/heavy CI |
| P1 | Complete CSP and XSS hardening | Identity tokens and CDN scripts magnify XSS impact | Security improvement | L | Script inventory, GTM/AdSense/Identity compatibility | Breaking runtime loads |
| P1 | Admin throttling/monitoring | No app-level rate limit verified | Reduces credential-attack risk | M | Edge/Function control, logs/alerts | False positives |
| P1 | Memory budgets and streaming | Browser crashes are the major heavy-tool failure mode | Better mobile reliability | L | Per-engine profiling/Workers | Performance regressions |
| P1 | Self-host/pin runtime assets | Reduces CDN/version/supply-chain risk | Reliability and reproducibility | M | License/asset pipeline, caching | Bundle/deploy size |
| P2 | Split monolithic app bundle | ~971 KB raw local initial JS/CSS | Faster mobile startup/INP | L | Module boundaries, route loader tests | Navigation regressions |
| P2 | Accessibility automation | Current semantics are partial and no axe suite exists | Broader usability/compliance evidence | M | axe/browser E2E/manual AT | False confidence without manual QA |
| P2 | Broader Barcode/QR fallback | BarcodeDetector support varies | More browser coverage | M | ZXing JS/WASM Worker | Payload/memory |
| P2 | Multilingual OCR packages | Current UI is English-focused | Larger audience/usefulness | M | Language downloads, UX, cache/size | Accuracy/data size |
| P2 | Improve document font coverage | Built-in PDF fonts reject some scripts | International document reliability | L | Unicode font/subsetting/license | Large bundles |
| P2 | Advanced ZIP/GIF worker isolation | Some heavy tasks can still block/allocate heavily | Mobile responsiveness | M | Worker protocols/budgets | Complexity |
| P3 | Substantive category hubs | Current tool routes are strong; category discovery can grow | SEO/navigation improvement | M | Editorial content, generator/registry | Thin content risk |
| P3 | Tool-specific FAQs/guides | AEO/GEO lacks distinctive answer content | Better answer/search visibility | M | Accurate visible content | Repetition/overclaiming |
| P3 | Performance/CWV monitoring | Local contracts do not measure field experience | Evidence-led optimization | M | Consent-aware RUM/GTM dashboards | Privacy/noise |
| P3 | Changelog and trust center | External evidence is limited | Product credibility | S–M | Release/security process | Maintenance burden |
| P4 | Consent-aware restrained ads | Site code exists; placements/consent not finalized | Revenue validation | M | CMP/legal/policy, real slots | CWV/trust/policy |
| P4 | Freemium entitlement system | Identity/DB exist but no paid access controls | Subscription foundation | L | Billing, roles, quotas, portal | Revenue/security complexity |
| P4 | Premium batch/project metadata | Can create concrete paid value | Retention/ARPU | L | Entitlements, storage/privacy design | Browser/device limits |
| P4 | Teams/business workspace | Current user model is individual | B2B potential | XL | Organizations, roles, billing, audit | Data governance |
| P5 | Optional server conversion tier | Browser fidelity limits remain for Office/PPT | High-fidelity premium flows | XL | Isolated processing, storage deletion, queues, SLAs | Privacy/cost/security |
| P5 | Advanced document/table recognition | PDF table/semantic conversions are heuristic | Better conversion quality | XL | ML/service or large local models | Accuracy/cost/model licenses |
| P5 | Expanded local AI tools | Existing ONNX architecture is a base | Differentiation | L–XL | Model licensing, device budgets, WebGPU | Payload/privacy/accuracy |

## Priority definitions

- **P0:** current production trust/functionality gap.
- **P1:** reliability and security foundation.
- **P2:** product quality and coverage.
- **P3:** discoverability and growth.
- **P4:** monetization foundations.
- **P5:** advanced/AI and infrastructure-heavy expansion.
