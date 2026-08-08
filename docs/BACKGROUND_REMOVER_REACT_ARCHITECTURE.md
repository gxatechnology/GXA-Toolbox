# Background Remover React Architecture

## Scope and integration

Only `/background-remover/` is a React application. The rest of GXA Toolbox remains in the existing root/static/PHP application. Legacy navigation now performs a hard navigation to `/background-remover/`, so the old DOM editor and React editor cannot initialize together.

Vite builds directly to `public_html/background-remover/`. This is a physical directory on Hostinger and is exposed through subpath-specific Netlify rewrites when the repository root is the Netlify publish directory.

## State ownership

`src/store/editorStore.ts` is the single editor state owner. It stores the active `EditorTool` union, original source dimensions, original and working masks, preview canvas size, brush, crop, background, three adjustment targets, effects, subject transform, design layers, comparison state, zoom/pan, export settings, provider, performance metrics, processing state, and history counts.

The source image remains decoded at its original dimensions. The interactive mask is capped at 2048 pixels on its longest side. During export, mask coordinates, crop, subject position, canvas size, and layers are scaled back to source resolution.

## Segmentation flow

```text
validated File
  -> immediate object-URL preview
  -> decoded full-resolution HTMLImageElement
  -> lazy ORT/model asset verification
  -> WebGPU session (preferred)
  -> WASM session (automatic fallback)
  -> 320x320 letterboxed RGB tensor
  -> U2NetP inference
  -> soft alpha normalization/unletterbox
  -> editable 2048px-or-smaller working mask
  -> React editor
```

Sessions are cached per execution provider. Failed session promises are removed, so a later retry is possible. Startup checks reject `.onnx`, `.wasm`, or `.mjs` URLs that return HTML due to an SPA rewrite.

## Non-destructive editor

The compositor combines source image + working alpha mask + background + adjustment targets + effect + subject transform/style + text/shape/image layers. Canvas previews are rebuilt from state; source pixels are never flattened into the working document.

Brush strokes update alpha only. Undo/redo stores changed mask rectangles rather than full source images. Mask refinements run in a Web Worker. Crop and subject dragging are pointer-driven and committed as history commands on pointer-up.

## Export

`exportRenderer.ts` renders the composition at source-derived resolution. PNG preserves alpha, WEBP preserves alpha when selected, and JPG always flattens to the current background color/composition. Canvas encoding naturally strips source metadata.

## Mobile

Desktop uses a left toolbar, central canvas, and right properties panel. At 820px and below, the toolbar moves to a horizontal bottom bar and properties become a bottom panel. Pointer Events cover mouse, pen, touch painting, crop dragging, subject dragging, two-pointer pinch zoom, and touch pan via the shared interaction hook.
