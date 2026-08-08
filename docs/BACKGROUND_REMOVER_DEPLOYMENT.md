# Background Remover Deployment

## Build

```bash
npm ci
npm run build
```

The root build runs legacy lint/tests, React ESLint, React tests, TypeScript, and Vite. Vite outputs `public_html/background-remover/` with compiled assets, local model, and local ORT binaries.

## Netlify

`netlify.toml` keeps `publish = "."` so the existing root toolbox remains the primary site. Ordered rewrites expose:

- `/background-remover` and `/background-remover/` -> `public_html/background-remover/index.html`
- `/background-remover/assets/*` -> compiled React assets
- `/background-remover/models/*` -> local ONNX model
- `/background-remover/vendor/*` -> local ORT loaders/WASM

The catch-all root SPA rewrite remains last. Headers explicitly set JavaScript, CSS, WASM, ONNX, and JSON MIME types. A production-like `netlify serve` check must show HTTP 200 and non-HTML content types for model/runtime assets.

## Hostinger

Upload the repository `public_html/` contents to the Hostinger document root. The physical `background-remover/` directory takes precedence over the legacy `.htaccess` background-remover rule. `.htaccess` includes explicit `.wasm`, `.mjs`, and `.onnx` types. No Node or PHP process is required for segmentation.

## Required URL checks

```text
/background-remover/
/background-remover/models/u2netp-web.onnx
/background-remover/vendor/ort/ort-wasm-simd-threaded.jsep.mjs
/background-remover/vendor/ort/ort-wasm-simd-threaded.jsep.wasm
/background-remover/vendor/ort/ort-wasm-simd-threaded.wasm
```

Each must return HTTP 200. Runtime/model URLs must never return `text/html`.

## Rollback

The legacy Background Remover files are retained but no longer loaded by the root HTML. Reverting the route redirects and the `navigate('tool-background-remover')` hard navigation restores the previous route without affecting other tools.
