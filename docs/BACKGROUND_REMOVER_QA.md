# Background Remover React QA

## Automated coverage

- Strict TypeScript project build
- ESLint flat configuration
- Vitest component test for all ten tool buttons and strict tool IDs
- Canvas coordinate and transformed subject mapping tests
- Crop ratio, bounds, and eight-handle hit tests
- Worker mask expansion, contraction, and feather tests
- WebGPU failure -> WASM session fallback test
- Export MIME, quality, and filename test
- Existing 91-tool repository audit and legacy output tests

## Browser results (2026-08-08)

Production Vite preview, Chromium in-app browser, `16-exact-512.jpg`:

- WebGPU: editor opened, 4,485 ms measured inference, 512×512 mask, no console errors.
- Forced WASM: editor opened, 2,880 ms measured inference, 512×512 mask, no console errors.
- Netlify production-like static server, forced WASM: editor opened, 3,302 ms inference, no console errors.
- Exact 3840×2160 input, forced WASM: 46.6 ms preprocessing, 3,009 ms inference, 132 ms postprocessing, 4,573.4 ms total; interactive mask 2048×1152.
- Exact 3840×2160 PNG export: 50.3 ms composition render, 1,143.2 ms encode, 11,058,049-byte output, no console errors.
- All Auto, Erase, Restore, Refine Edge, Background, Crop, Adjust, Effects, Design, and Layers buttons switched to their correct property panel.
- Erase/restore pointer strokes, 1:1 crop, solid background, text layer, undo availability, and export dialog were exercised.

The exact timings are environment-specific cold/warm observations, not performance guarantees.

## Production-like asset results

Netlify CLI served:

- `/background-remover` -> 200 `text/html`
- compiled JS -> 200 `application/javascript`
- U2NetP ONNX -> 200 `application/octet-stream`, 4,574,267 bytes
- JSEP WASM -> 200 `application/wasm`, 26,827,543 bytes
- JSEP loader -> 200 `application/javascript`
- root `/` -> existing toolbox HTML

## Remaining manual matrix

The 20 existing fixtures cover person, hair, full body, groups, products, bottle, shoe, vehicle, pets, dark/light contrast, and multiple high-resolution dimensions. Full subjective edge-quality scoring across every fixture and physical iOS/Android gesture testing remain manual QA. The in-app browser viewport override remained fixed at 1280×720, so mobile breakpoint visual emulation was not claimed; responsive CSS and pointer/touch code are present and require a physical/mobile browser pass before calling that portion fully verified.
