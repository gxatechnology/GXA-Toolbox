# Background Remover Final QA

QA date: 2026-08-08  
Scope: Background Remover and Advanced Cutout Studio only.

## Summary

The Background Remover completed the required 15-image browser QA suite with browser-local U2NetP segmentation. WebGPU and forced WASM both opened Advanced Cutout Studio with original-resolution masks. This pass also hardened logged-out `save-job` behavior, mobile clipping, corrupt-image decode handling, inference tensor cleanup, and automated brush/crop coordinate tests.

## 15-image quality suite

| Fixture | Resolution | Provider | Inference | Total | Mask stats | Visual result | Editor result | Export result | Status | Notes |
|---|---:|---|---:|---:|---|---|---|---|---|---|
| 01 person plain | 1920x2431 | WebGPU | 1757 ms | 4007 ms | min 0, max 255, mean 102.99, transparent 53.80%, partial 17.36% | Foreground retained | Opened | Path covered | Pass | Clean portrait case. |
| 02 person room | 1920x1287 | WebGPU | 2656 ms | 4563 ms | min 0, max 255, mean 118.99, transparent 39.03%, partial 36.62% | Subject retained; soft room edges | Opened | Path covered | Pass with limitation | Complex background. |
| 03 detailed hair | 1920x2400 | WebGPU | 2544 ms | 4569 ms | min 0, max 255, mean 160.23, transparent 18.97%, partial 41.25% | Hair broadly retained | Opened | Path covered | Pass with limitation | Fine hair needs manual refine. |
| 04 full-body person | 1920x1280 | WebGPU | 2068 ms | 4089 ms | min 0, max 255, mean 137.71, transparent 30.43%, partial 40.27% | Full body retained | Opened | Path covered | Pass | Usable full-body mask. |
| 05 two people | 1920x2321 | WebGPU | 1860 ms | 3761 ms | min 0, max 255, mean 137.83, transparent 40.24%, partial 14.19% | Two-person foreground retained | Opened | Path covered | Pass | Original mask dimensions preserved. |
| 06 group people | 1275x947 | WebGPU | 1879 ms | 3378 ms | min 0, max 255, mean 53.43, transparent 51.15%, partial 48.10% | Group retained with uncertain edges | Opened | Path covered | Pass with limitation | High partial alpha. |
| 07 product white | 1920x1267 | WebGPU | 1815 ms | 3365 ms | min 0, max 255, mean 97.47, transparent 55.85%, partial 15.13% | Product retained | Opened | Path covered | Pass | White-background product case passed. |
| 08 product busy | 1920x791 | WebGPU | 1751 ms | 3183 ms | min 0, max 255, mean 96.93, transparent 57.94%, partial 7.39% | Product/busy subject separated | Opened | Path covered | Pass | Non-uniform usable mask. |
| 09 shoe | 1920x1314 | WebGPU | 1814 ms | 3511 ms | min 35, max 255, mean 251.10, transparent 0.00%, partial 10.06% | Almost all foreground | Opened | Path covered | Pass with limitation | Weak product/background separation. |
| 10 bottle | 1920x1295 | WebGPU | 1894 ms | 3562 ms | min 0, max 255, mean 71.74, transparent 64.50%, partial 12.61% | Bottle retained | Opened | Path covered | Pass | Dark lighting needs review. |
| 11 vehicle | 2816x1950 | WebGPU | 1808 ms | 3882 ms | min 0, max 255, mean 73.86, transparent 61.55%, partial 22.56% | Vehicle retained | Opened | Path covered | Pass | Larger source preserved. |
| 12 dog/cat | 1920x2223 | WebGPU | 1917 ms | 3847 ms | min 0, max 255, mean 69.12, transparent 67.49%, partial 11.93% | Animal foreground retained | Opened | Path covered | Pass with limitation | Fur needs manual refine. |
| 13 dark-on-dark | 1920x1314 | WebGPU | 2293 ms | 4113 ms | min 0, max 255, mean 153.74, transparent 2.79%, partial 96.23% | Low contrast detected but uncertain | Opened | Path covered | Pass with limitation | Derived real-photo stress fixture. |
| 14 light-on-light | 1920x1267 | WebGPU | 2195 ms | 3915 ms | min 0, max 255, mean 96.23, transparent 56.74%, partial 15.59% | Usable low-contrast result | Opened | Path covered | Pass with limitation | Derived real-photo stress fixture. |
| 15 high resolution | 1920x2880 | WebGPU | 2332 ms | 4712 ms | min 0, max 255, mean 3.68, transparent 92.78%, partial 7.22% | Mostly background/landscape | Opened | Path covered | Pass with limitation | Not a salient subject scene. |

Fixture quality counts:

- Fully verified: 7
- Verified with limitations: 8
- Untested: 0
- Broken: 0

## Original resolution and 4K

| Fixture | Input | Output mask | Provider | Result |
|---|---:|---:|---|---|
| 16 exact 512 | 512x512 | 512x512 | WebGPU | Pass |
| 17 exact 1920x1080 | 1920x1080 | 1920x1080 | WebGPU | Pass |
| 18 exact 2560x1440 | 2560x1440 | 2560x1440 | WebGPU | Pass |
| 19 exact 3840x2160 | 3840x2160 | 3840x2160 | WebGPU | Pass |
| 20 exact 2160x3840 | 2160x3840 | 2160x3840 | WebGPU | Pass |

4K result: 3840x2160 completed with WebGPU in 4522 ms total / 1833 ms inference and produced a 3840x2160 mask.

## WebGPU and WASM performance

WebGPU repeated 512x512 runs:

- 3942 ms total / 2127 ms inference
- 3342 ms total / 1853 ms inference
- 3242 ms total / 1850 ms inference

Forced WASM compatibility mode:

- 512x512: 3072 ms total / 2177 ms inference
- 1920x1080: 4051 ms total / 2744 ms inference
- 2560x1440: 3510 ms total / 2151 ms inference

The normal auto session is reused. Inference tensors are now explicitly disposed after mask post-processing.

## Mobile QA

Mobile testing was emulator-only in the Codex in-app browser. The viewport reported `maxTouchPoints: 0`, so physical touch and true pinch were not available.

| Viewport | Upload | Canvas fit | Horizontal overflow | Toolbar | Status |
|---|---|---|---|---|---|
| 430x932 | Pass | 305x305 inside 335px studio | No | Internal horizontal scroll | Pass |
| 390x844 | Pass | 265x265 inside 295px studio | No | Internal horizontal scroll | Pass |
| 375x667 | Pass | 251x251 inside 280px studio | No | Internal horizontal scroll | Pass |
| 320x568 | Pass | 195x195 inside 225px studio | No | Internal horizontal scroll | Pass |

Fix applied: mobile `.cutout-studio`, `.cutout-body`, canvas pane, stage, panel, and toolbar now constrain to the viewport/container instead of clipping wide editor content.

## Brush and crop QA

Added `tests/background-remover-transform-mapping.mjs`, covering:

- Fit, 50%, 100%, and 200% zoom
- Portrait and landscape images
- Cropped canvas mapping
- Transformed subject mapping
- Crop move bounds
- Crop resize bounds

The production editor still uses pointer-event handlers for erase/restore and crop.

## Editor and export QA

Checked controls include Auto, Reset Auto Mask, Invert Mask, erase/restore, smooth/expand/contract/defringe, transparent/color/gradient/blur/custom background controls, move/scale/rotate/flip/center/fit, shadow/outline/glow controls, adjustment sliders, effect presets, crop presets, eight crop handles, layers, undo, redo, reset, and PNG/JPG/WEBP export code paths.

Browser-download event capture was unavailable in the Codex browser backend. Export validation therefore relies on the existing validated export implementation plus code contracts rather than a fresh download-object capture in this pass.

## Failure handling

- Unsupported `.txt`: rejected before processing with accepted-type messaging.
- Corrupt `.jpg`: engine now throws `The browser could not decode this image. It may be corrupted or unsupported.` and stores it in `document.body.dataset.gxaLastProcessingError`.
- No silent fallback to the legacy PHP color-key endpoint.
- Model-404/WASM-missing destructive simulations were not run because they require mutating production assets.

## Privacy and network audit

User image bytes were not sent to Hugging Face, remove.bg, Pexels, external APIs, or third-party AI services. The Background Remover runtime/model requests observed were local:

- `/assets/vendor/onnxruntime-web/ort.all.min.js`
- `/assets/vendor/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs`
- `/assets/vendor/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm`
- `/assets/models/background-remover/u2netp-web.onnx`

The app shell still loads pre-existing shared CDN assets: Google Fonts, pdf-lib from unpkg, JSZip from cdnjs, and lucide from unpkg. These are not AI/model/upload endpoints, but `/background-remover` is not a zero-CDN page shell.

## Production asset QA

All required Background Remover assets served HTTP 200:

- `/background-remover`
- `/assets/background-segmentation-engine.js`
- `/assets/advanced-cutout-studio.js`
- `/assets/models/background-remover/model-config.json`
- `/assets/models/background-remover/u2netp-web.onnx`
- `/assets/vendor/onnxruntime-web/ort.all.min.js`
- `/assets/vendor/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs`
- `/assets/vendor/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm`

Cache-busting query strings were added for changed Background Remover JS/CSS/app references.

## Save-job 503

`/api/save-job.php` is optional history/session persistence. Logged-out Background Remover and Advanced Cutout Studio now skip that call, so browser-local cutouts are independent of save-job success and no fake job history is created.

## Verification

- `npm.cmd run lint` - passed
- `npm.cmd test` - passed
- `npm.cmd run build` - passed
- PHP syntax for `public_html/index.php` and `public_html/api/background-remover.php` - passed

## Remaining limitations

- U2NetP struggles with hair, fur, transparent/glass objects, very thin objects, low-contrast edges, and non-salient scenes.
- Physical mobile touch/pinch was not tested.
- Browser download event capture was unavailable in this backend.
- Destructive model/WASM-missing tests were not run against production assets.
