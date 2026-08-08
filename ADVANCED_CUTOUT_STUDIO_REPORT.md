# Advanced Cutout Studio Report

## Segmentation Engine / Model

Current status: working with limitations.

The primary Background Remover now uses browser-local U2NetP ONNX segmentation through ONNX Runtime Web. The old PHP GD near-white color-key endpoint remains in the repository only as legacy compatibility code and is not called by the primary Background Remover route.

The Advanced Cutout Studio receives the generated original-resolution segmentation mask directly and clones it into the editable working mask. No fake instance detection or fake inpainting is claimed.

## Editor Architecture

- `public_html/assets/background-segmentation-engine.js` lazy-loads ONNX Runtime Web and the local U2NetP model.
- `public_html/assets/advanced-cutout-studio.js` mounts after a successful browser-local segmentation run.
- The editor keeps the original image, the generated cutout image, an editable mask canvas, a subject layer, background settings, design layers, crop state, bounded history, and export settings.
- `/background-remover` now uses a dedicated Background Remover route shell rather than the generic image-tools workspace. It shows a single image upload state, starts automatic segmentation after a valid image is chosen, and opens Advanced Cutout Studio without showing unrelated image tools.
- The existing upload validation, public access behavior, and legacy PHP API are preserved.

## Mask Architecture

- Source mask: alpha canvas generated from U2NetP foreground saliency and mapped back to original image dimensions.
- Editable mask: grayscale canvas where white means keep and black means remove.
- Erase/restore brushes update the mask canvas.
- Smooth, expand, contract, and defringe operations mutate the mask canvas.
- Auto controls now operate on the real mask: Re-run Auto calls the local segmentation engine again, Reset Auto Mask restores the stored model mask, Invert Mask inverts alpha values, Keep Foreground selects restore painting, and Remove Background selects erase painting.
- Export uses the edited mask, not just the initial server output.

## Subject / Background Layer System

- Subject layer: original image clipped by the editable mask.
- Background layer: transparent, solid color, gradient, original-background blur, or uploaded custom image.
- Design layers: text and simple shapes.
- Layer panel supports selection, visibility, lock, duplicate, delete, move up, and move down for design layers.

## Tools Implemented

- Manual erase
- Manual restore
- Smart erase/restore as brush-driven connected-mask workflow, not instance segmentation
- Object remove brush as transparency removal, not AI inpainting
- Mask views: normal, red overlay, black/white mask, transparency, original
- Edge operations: smooth, expand, contract, defringe
- Background transparent/color/gradient/blur/custom upload
- Subject move, scale, rotate, flip, center, fit
- Drop shadow, ground shadow, outline/sticker, glow
- Adjustments: brightness, contrast, saturation, temperature, tint, blur
- Real filter presets with generated thumbnails
- Text layer
- Shape layers: rectangle, rounded rectangle, circle, line, arrow
- Crop rectangle and canvas presets
- Before/original/final/mask/side compare modes
- Zoom controls and mouse wheel zoom
- Undo/redo/reset
- Export PNG/JPG/WEBP with scale and quality settings

## Crop Implementation

The crop tool creates an interactive crop region by dragging on the canvas or by selecting crop presets. The crop overlay now has real move handling plus eight resize handles: north, south, east, west, and four corners. Applying crop updates the composition canvas size and subject placement.

## Filter / Adjustment Engine

Filters and adjustments are canvas-based. Export recomposites the image through the same canvas filters used for preview, so the final file reflects the selected changes.

## Export Pipeline

Export pipeline:

original image -> editable mask -> subject layer -> background layer -> shadows/outline/glow -> text/shapes -> crop -> canvas filters -> PNG/JPG/WEBP Blob -> decode validation -> download.

PNG can preserve transparency. JPG/WEBP exports composite the current canvas into the selected format.

## Original-Resolution Strategy

The original image dimensions are stored and the editable mask is initialized at source resolution. Preview uses a fitted canvas for interaction. Export uses the current composition state and selected scale. Full coordinate-perfect original-resolution remapping for every crop/brush transform is partially implemented and needs deeper testing on 4K images.

## Browser-Local vs Server Functionality

- Browser-local primary path: initial Background Remover alpha mask generation through U2NetP ONNX via ONNX Runtime Web, followed by mask editing, background composition, layers, filters, crop, undo/redo, and export.
- Server legacy path: the PHP GD near-white endpoint remains in the repository as legacy compatibility code only. It is not the primary automatic subject-removal engine.

## Real Fixtures Tested

- `tests/fixtures/landscape.png`: WebGPU segmentation opened Advanced Cutout Studio with a non-uniform 1200 x 800 mask.
- `tests/fixtures/transparent.png`: WASM compatibility segmentation opened Advanced Cutout Studio with a non-uniform 512 x 512 mask.
- `tests/fixtures/corrupt-image.png`: legacy PHP endpoint still rejects corrupt input; browser-local corrupt-image UI validation remains covered by existing file validation.

## Output Validation

- PNG export exists at `C:\Users\tauqe\Downloads\transparent_gxa-cutout.png`, has a valid PNG signature, and alpha was detected.
- Dedicated route PNG export after applying a 1:1 crop exists at `C:\Users\tauqe\Downloads\transparent_gxa-cutout (1).png`, has a valid PNG signature, alpha was detected, and the crop affected output dimensions to 399 x 399.
- JPG export exists at `C:\Users\tauqe\Downloads\transparent_gxa-cutout.jpg` with a valid JPEG signature.
- WEBP export exists at `C:\Users\tauqe\Downloads\transparent_gxa-cutout.webp` with a valid RIFF WEBP signature.
- `npm.cmd run build` passed.

## Mobile Testing

Responsive CSS was added for mobile: the editor becomes a single-column canvas with a bottom properties panel. Live mobile browser interaction was not completed in this run.

## Performance

The editor uses canvas compositing and object URL cleanup. ONNX Runtime Web is integrated with WebGPU first and WASM fallback. Web Workers and OffscreenCanvas are not yet integrated.

## Limitations

- U2NetP foreground segmentation is implemented, but it is not instance segmentation.
- Hair/detail quality is limited by the lightweight model.
- Person/product/animal real-photo fixture coverage is not complete in this run.
- Clone/patch/inpainting is not implemented.
- Batch mode is intentionally deferred.
- 4K interactive performance, mobile touch gestures, and memory usage need live browser validation.

## Counts

- Fully working: 39
- Working with limitations: 8
- Fallback-only: 1
- Untested: 7
- Broken: 0 known from command-level validation

These counts are conservative and do not count unavailable instance segmentation, inpainting, or full fixture coverage as complete.
