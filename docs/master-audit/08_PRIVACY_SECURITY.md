# Privacy and Security Audit

## Verified privacy model

The verified statement is: **91 working tools perform their primary computation in the browser, a browser Worker, or local WASM.** No current file-processing workflow sends uploaded file content to a GXA Netlify Function or database.

This is not the same as “the whole product is offline” or “no network request occurs.” Pages, analytics/advertising, fonts and several lazy engines/assets load over the network. Netlify Identity and dashboard/history metadata also communicate with hosted services.

### Safe marketing claims

- “Many GXA Toolbox file tools process files locally in your browser.”
- “The verified PDF, image, ZIP and conversion engines do not upload file contents to a GXA processing server.”
- “Some demanding tools use local Web Workers or WebAssembly.”
- “Background removal runs with a browser-local ONNX model after its assets load.”
- “OCR keeps the selected image/PDF local while its OCR runtime/language assets may download on first use.”
- “Signed-in history stores job metadata, not verified uploaded file blobs.”

### Claims not safe to use

- “100% offline,” “zero network,” or “the site never communicates with servers.”
- “Every tool works in every browser.”
- “Files can never leave the device” without qualifying this as the current primary processing architecture and considering future features/user actions.
- “Anonymous/no tracking”: GTM and AdSense are installed on public pages.
- “Bank-grade,” “unhackable,” “fully compliant,” or legal/compliance certifications not verified.
- “Live exchange rates”: the Currency Converter requires a user-provided rate.
- “Cryptographically signs PDFs”: Sign PDF creates a visible signature appearance only.

## Security findings

| Severity | Finding | Evidence/impact | Recommendation |
|---|---|---|---|
| HIGH | Privacy/security copy describes a retired normal-user session cookie | Current user auth is Netlify Identity token persistence | Correct public copy before marketing/legal reliance |
| HIGH | Contact Support calls an unmapped PHP endpoint on Netlify | `/api/contact.php` has no matching Function/redirect | Implement a supported Function/form route or update the action |
| HIGH | CSP is incomplete | Existing policy covers base/object/frame/form but lacks default/script/connect directives | Build and test a nonce/hash/allowlist CSP compatible with GTM, AdSense, Identity and CDN assets |
| MEDIUM | Client identity tokens increase XSS impact | Standard browser Identity client stores session material accessible to its runtime | Reduce XSS surface, strengthen CSP, dependency pinning and output sanitization |
| MEDIUM | Admin path lacks verified application rate limiting/lockout | Constant-time password comparison exists, but no request throttle was found | Add Netlify-edge/function throttling, alerting and lockout policy |
| MEDIUM | Runtime CDN/supply-chain exposure | Several scripts are CDN loaded; Lucide/exifr include unpinned use | Pin exact versions, self-host where practical, add integrity where compatible |
| MEDIUM | Heavy/decompression inputs can exhaust memory | ZIP, PDF, GIF, OCR and workbook paths allocate large buffers | Keep and extend uncompressed-size, pixel and total-memory budgets; stream where possible |
| LOW | Some formatter/regex logic has CPU/grammar limits | Pathological regex or very large input can block UI | Worker isolation, time budget and clearer limits |
| INFORMATIONAL | No client secret was found in product code | Server secrets are environment-provided | Preserve this boundary and rotate on suspected exposure |

## Controls confirmed

- Allowlisted `dist/` publish directory prevents PHP, SQL, tests and repository source from becoming static assets.
- Security headers include HSTS, no-sniff, frame restrictions and referrer controls.
- Function responses add no-store/noindex/nosniff controls where appropriate.
- Database queries use tagged SQL; no string-concatenated SQL path was identified in audited helpers.
- Tool inputs have general and route-specific type/size/pixel/page/cell limits.
- Archive extraction includes path/CRC validation logic.
- User/admin routes are deliberately noindex.
- The audit did not print or attempt to retrieve environment-secret values.

## Privacy classification totals

| Classification | Count |
|---|---:|
| Working local client workflows | 91 |
| Dedicated local Worker workflows | 5 |
| WASM-primary workflows | 3 |
| Workflows that fetch engine/model/language assets | Multiple; especially OCR, PDF.js and Background Remover |
| Primary file-processing workflows that call a GXA Function/API | 0 |
| Registered but nonfunctional workflows | 1 |

Legal compliance, consent requirements and license interpretation require qualified legal review; this is a technical audit only.
