# Universal Image Converter

`/image-converter/` is a route-lazy, browser-local still-image converter. It detects file signatures before decoder selection, validates compressed size and decoded dimensions, and exposes only output encoders that are present and verified in the active browser. Normal conversion retains decoded width and height; ICO deliberately uses the selected square icon size.

## Verified capability boundary

| Input | Support | Decoder boundary |
|---|---|---|
| JPEG/JPG/JFIF | Supported | Browser decoder; orientation requested from the native decoder |
| PNG | Supported | Browser decoder |
| WebP | Supported | Browser decoder |
| GIF | Supported with limitation | Existing bounded, disposal-aware decoder; explicit first-frame confirmation for animation |
| BMP | Supported subset | Uncompressed 24-bit and 32-bit Windows BMP; bare DIB is recognized but unsupported |
| TIFF/TIF | Supported subset | Baseline uncompressed, interleaved 8-bit RGB/RGBA; orientation tags 1–8; explicit first-page confirmation |
| ICO/CUR | Supported subset | Largest PNG-compressed entry; legacy DIB entries are rejected |
| SVG | Supported subset | Restricted self-contained static allowlist; no scripts, external/data URLs, entities, embedded documents, style blocks, events, or animation |
| AVIF | Browser-conditional | Offered only after the active native browser decoder reopens the fixture/input |

Verified output paths are JPEG, PNG, browser-validated WebP, a single-frame GIF, uncompressed 24-bit BMP, uncompressed RGBA TIFF, and one PNG-compressed ICO size (16–256 px). AVIF, JPEG 2000, and JPEG XL output are not offered because the current production architecture has no verified encoder.

No HEIC/HEIF, RAW, PSD/PSB, HDR/EXR, JP2, or JXL decoder is claimed. These and the other recognized specialist extensions produce an explicit unsupported result. The converter neither uploads them to a fallback service nor calls embedded-preview extraction full conversion.

## Fidelity and privacy

- Alpha remains available for PNG, WebP, TIFF, and ICO. JPEG, BMP, and the current GIF path show a background selection before alpha is flattened. GIF animation and detected WebP/APNG animation require explicit first-frame confirmation.
- JPEG and WebP expose encoder quality. Lossless/fixed encoders do not show a fake quality setting.
- Pixel conversion strips EXIF, GPS, ICC profiles, comments, source compression, original bit depth, layers, vectors, and animation. A metadata-preservation toggle is intentionally absent.
- Browser/canvas color conversion preserves reasonable displayed appearance but is not presented as perfect ICC-managed print conversion.
- Selected bytes, filenames, metadata, decoded pixels, previews, and results remain in browser memory. Only generic lifecycle statuses and a generic history label are recorded.
- Limits are 50 MB compressed input, 8,192 pixels on either side, and 25 megapixels decoded. GIF has the tighter existing frame and aggregate-pixel budgets; SVG is limited to 2 MB.

## Architecture

- `image-converter-core.js` contains signature detection, format policy, bounds, secure SVG policy, and independent BMP/TIFF/ICO codecs.
- `image-converter.js` is the route-only UI/controller. It lazy-loads the existing GIF decoder and GIF encoder worker only when required.
- `image-converter.css` supplies isolated desktop/tablet/mobile layout rules. The main page does not preload these files.
- The central tool and content registries own routing, metadata, canonical URL, FAQ schema, related links, menus, sitemap inclusion, and count-dependent build data. Generated `dist/` files are never edited manually.

## Verification

`tests/image-converter-core.mjs` verifies real signature detection, mismatches, unsupported recognition, limits, and independent BMP/TIFF/ICO fixture decode plus encoder reopen. `tests/image-converter-contract.mjs` verifies routing, lazy loading, format claims, privacy, content, sitemap/SEO, production assets, and the current 95-tool registry. `tests/image-converter-browser.mjs` performs optional real Chromium conversions, validates destination magic, reopens outputs, checks explicit animation handling and secure SVG rejection, and verifies required responsive widths.

Run the browser suite explicitly after the production generation step:

```text
npm run generate:seo
npm run test:image-converter:browser
```
