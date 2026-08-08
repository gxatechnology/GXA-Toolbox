# Background Segmentation Engine

## Selected Model

GXA Toolbox now uses U2NetP ONNX for the primary Background Remover.

- Model file: `public_html/assets/models/background-remover/u2netp-web.onnx`
- Original retained: `public_html/assets/models/background-remover/u2netp.onnx`
- Config: `public_html/assets/models/background-remover/model-config.json`
- Source: `Heliosoph/u2net-onnx`, republishing U2Net ONNX checkpoints from the upstream U-2-Net project
- License: Apache-2.0
- Runtime: `onnxruntime-web@1.23.0`
- Local model size: 4,574,267 bytes

U2NetP was selected because it is small enough for browser-local lazy loading, supports general salient foreground detection, has a clean Apache-2.0 license, and exposes a simple fixed input/output signature. The full U2Net model may give better hair/fur detail, but its size is much less suitable for first-load browser use.

## Runtime

The route lazily loads:

- `public_html/assets/vendor/onnxruntime-web/ort.all.min.js`
- ORT WASM assets under `public_html/assets/vendor/onnxruntime-web/`
- `public_html/assets/models/background-remover/u2netp-web.onnx`

Execution provider order:

1. WebGPU, when `navigator.gpu` is available
2. WASM fallback

The visible UI labels this as:

- Automatic background removal
- Browser compatibility mode

It does not expose ONNX/WebGPU/WASM terminology to ordinary users.

## Model Compatibility Patch

The downloaded `u2netp.onnx` failed in ONNX Runtime Web WASM with:

`using ceil() in shape computation is not yet supported for MaxPool`

To make the model browser-compatible, 33 unsupported `MaxPool.ceil_mode` attributes were removed and the patched graph was saved as `u2netp-web.onnx`. The patched model passed `onnx.checker.check_model`.

## Preprocessing

Input image handling:

- Decode JPG, PNG, or WEBP in the browser
- Preserve the original source dimensions
- Letterbox into 320 x 320
- Convert RGBA browser pixels to RGB
- Scale channels to 0..1
- Normalize with ImageNet statistics:
  - mean `[0.485, 0.456, 0.406]`
  - std `[0.229, 0.224, 0.225]`
- Convert to NCHW float32 tensor
- Feed input name `input.1`, or the first model input name reported by ORT

## Output / Mask Mapping

The first model output is used as the foreground saliency map.

Post-processing:

- Normalize model output to 0..255
- Remove letterbox padding
- Resize the soft mask back to the original image dimensions with high-quality interpolation
- Preserve soft alpha values
- Snap only extreme alpha values near 0 or 255
- Reject suspicious masks that are uniform or more than 99.9% one-sided

The output cutout is built by applying the soft mask as alpha to the original image.

## Editor Integration

The Advanced Cutout Studio receives:

- original file
- generated transparent PNG
- original-resolution segmentation mask
- segmentation provider
- mask statistics
- timing information

The studio initializes:

- `originalMaskCanvas`
- `maskCanvas`

The existing erase/restore, mask views, edge refinement, backgrounds, layers, crop, transforms, and export pipeline remain intact.

## Privacy

Automatic Background Remover processing runs locally in the browser. User images are not uploaded to third-party services or the PHP color-key endpoint for the primary workflow.

The old PHP GD endpoint remains in the repository only as legacy compatibility code. It is not called by the primary Background Remover route.

## Observed Browser Results

Test environment: Codex in-app browser against `http://127.0.0.1:4180/background-remover`.

WebGPU path:

- Provider: `webgpu`
- Fixture: `tests/fixtures/landscape.png`
- Model size: 4,574,267 bytes
- Input resolution: 320 x 320
- Output mask resolution: 1200 x 800
- Total observed time: 4,843 ms
- Inference observed time: 2,719.5 ms
- Mask stats: min 0, max 139, mean 1.129, transparent 90.794%, partial 9.206%, opaque 0%
- Result: Advanced Cutout Studio opened

WASM path:

- Provider: `wasm`
- Fixture: `tests/fixtures/transparent.png`
- Model size: 4,574,267 bytes
- Input resolution: 320 x 320
- Output mask resolution: 512 x 512
- Total observed time: 3,691.3 ms
- Inference observed time: 2,632.2 ms
- Mask stats: min 0, max 255, mean 229.959, transparent 0.210%, partial 22.016%, opaque 77.773%
- Result: Advanced Cutout Studio opened

Export validation:

- PNG export: `transparent_gxa-cutout.png`, valid PNG signature, alpha present
- JPG export: `transparent_gxa-cutout.jpg`, valid JPEG signature
- WEBP export: `transparent_gxa-cutout.webp`, valid RIFF WEBP signature

## Limitations

- U2NetP is salient-object segmentation, not instance segmentation.
- It does not provide separate person/product/animal/vehicle labels.
- Hair/fur detail is limited compared with larger matting models.
- Full real-photo fixture coverage is not yet complete.
- Mobile performance was not measured in this run.
- Memory usage was not measured in this run.
- The legacy PHP color-key endpoint still exists but is no longer primary.
