# GXA Toolbox Image Studio

## Shared workspace

Existing image routes now open inside the shared Image Studio shell. The route remains the mode selector: there is no new public route and no extra landing step. The shell supplies mode navigation, a large source preview, zoom/pan/touch controls, a sticky configuration panel, a mobile settings drawer, processing status, result comparison, real output statistics, download, reset, and session history.

Canvas-based outputs are rendered from the source image dimensions, not the CSS preview size. JPEG exports receive an explicit white background; PNG and WebP preserve transparency where their formats support it. Canvas re-encoding omits EXIF metadata.

## Route map

| Existing route | Studio mode | Processing | Preview | Output | Status / limitation |
|---|---|---|---|---|---|
| `crop-image` | Manual crop | Cropper.js + Canvas, local | Draggable crop box, eight handles, grid, numeric X/Y/W/H | JPG/PNG/WebP/source format | Functional; 30-state bounded undo/redo |
| `resize-image` | Resize | Canvas, local | Source image plus live transform/filter preview | JPG/PNG/WebP | Functional; percentage, aspect lock, prevent upscaling |
| `compress-image` | Compress/batch | Canvas + JSZip, local | Source image plus live adjustments and real result comparison | JPG/PNG/WebP or ZIP | Functional; final savings use actual Blob sizes |
| `background-remover` | Background removal | Existing PHP processor | Source/result comparison | Transparent PNG | Partial: near-white color key, not AI segmentation or a brush-mask editor |
| `color-extractor` | Palette | Canvas sampling, local | Source image and swatches | Palette result | Functional |
| `exif-viewer` | Metadata inspection | exifr, local | Actual present metadata only | Cleaned canvas copy where supported by route | Functional; missing fields are not invented |
| `webp-to-jpg` | Format conversion | Canvas, local | Source plus live adjustments | JPG/PNG | Functional |
| `svg-to-png` | SVG raster export | Browser SVG decode + Canvas | Rendered source | PNG | Functional |
| `png-to-svg` | SVG raster wrapper | Data URL inside SVG | Raster source | SVG wrapper | Functional; explicitly not vector tracing |

## Implemented editor behavior

- Manual crop ratios: free, original, 1:1, 4:5, 5:4, 4:3, 3:4, 3:2, 2:3, 16:9, 9:16, Facebook Cover, LinkedIn Banner, and custom.
- Crop rotation, horizontal/vertical flip, wheel/pinch zoom, pan, fit, actual size, reset, keyboard nudging, undo, redo, and original-pixel numeric controls.
- Resize dimensions, percentage scaling, aspect locking, prevent-upscale behavior, output format, and high-quality Canvas resampling.
- Compression quality presets, output formats, multi-file queue, per-file sequential processing, actual aggregate output size, and ZIP download for batches.
- Real brightness, contrast, saturation, grayscale, blur, 90-degree rotations, flips, and text watermark rendering on supported Canvas modes.
- Source/result Blob decoding before the completion state is accepted.
- Object URL and editor-listener cleanup on reset and route changes.

## Genuine remaining scope

Phase 1 does not expose nonfunctional controls. A separate canvas-resize/anchor editor, layer-based text/shapes/drawing objects, advanced convolution filters, image-watermark tiling, interactive background masks, pause/resume batch workers, and EXIF preservation are not complete in the current plain-JavaScript stack. Existing routes remain available and honest about those boundaries.
