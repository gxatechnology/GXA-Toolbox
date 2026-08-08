# GXA Toolbox Background Remover

Standalone React + TypeScript + Vite application for `/background-remover/`. It performs U2NetP foreground segmentation locally with ONNX Runtime Web, prefers WebGPU, falls back to WASM, and opens a state-driven Canvas 2D editor.

## Commands

From the repository root:

```bash
npm run dev:bg
npm run lint:bg
npm run typecheck:bg
npm run test:bg
npm run build:bg
```

The production build is written to `public_html/background-remover/`. The Vite base is `/background-remover/`; do not change it without updating Netlify redirects and the explicit ONNX asset URLs.

## Runtime assets

- Model: `public/models/u2netp-web.onnx`
- Model metadata: `public/models/model-config.json`
- ONNX Runtime loaders/binaries: `public/vendor/ort/`
- Production model URL: `/background-remover/models/u2netp-web.onnx`
- Production WASM root: `/background-remover/vendor/ort/`

No image bytes are sent to PHP or a third-party service. The old PHP color-key endpoint remains only as a legacy endpoint for backward compatibility and is not called by this app.

## Structure

```text
src/
  app/             constants and defaults
  components/      React UI and tool panels
  editor/          compositor, crop, brush, history, export
  hooks/           pointer/touch canvas interactions
  segmentation/    ORT, model session, preprocess/postprocess
  store/           single Zustand editor store
  styles/          responsive GXA styles
  types/           strict editor types
  utils/           canvas and export helpers
  workers/         mask-refinement worker and pure algorithms
```

See `docs/BACKGROUND_REMOVER_REACT_ARCHITECTURE.md` and `docs/BACKGROUND_REMOVER_DEPLOYMENT.md` for integration details.
