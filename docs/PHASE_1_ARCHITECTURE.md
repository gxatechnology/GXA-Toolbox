# GXA Toolbox Phase 1 Architecture

## Authoritative source

`public_html/` is the authoritative production application.

- `public_html/index.php` starts the PHP session, loads database-backed premium-tool access, and mounts the production frontend.
- `public_html/assets/app.js` owns the 92-tool registry, routing, processing dispatch, authentication-aware rendering, history, favorites, and downloads.
- `public_html/assets/tool-workspace.js` owns shared validation, file previews, PDF.js rendering, browser capability checks, and file-processing helpers.
- `public_html/assets/style.css` is the production design system.
- `public_html/api/`, `public_html/dashboard/`, `public_html/admin/`, and `public_html/developer/` remain production endpoints.

The root static entry is intentionally retained for backward-compatible previews. `app.js` and `style.css` at the repository root forward to the production assets, and `index.html` loads the production asset files. Phase 1 changes are therefore implemented in `public_html/` first; the static entry only receives matching asset references when a new shared production asset is introduced.

## Phase 1 studio architecture

Phase 1 adds a shared, framework-free studio layer while keeping the existing plain JavaScript/PHP application:

- `phase-one-studios.js` owns the Image Studio/PDF Studio route maps, shared studio navigation, mobile settings drawer, status bar, and accessible shell behavior.
- `app.js` remains the tool source of truth and continues to own all processing algorithms and route-specific controls.
- `tool-workspace.js` remains the preview/runtime layer. It renders source files, lazily loads PDF.js, exposes thumbnail/page selection, and releases temporary resources.
- `style.css` owns responsive desktop, tablet, phone, dark-mode, focus, and reduced-motion presentation.

Existing routes are not redirected through a new landing route. Each registered route renders its current tool mode and is decorated by the relevant shared studio shell.

## Processing boundaries

- Browser-local modes use Canvas, PDF.js, pdf-lib, JSZip, Web Crypto, and browser APIs.
- `background-remover` remains secure server processing because its existing PHP API is the configured processor.
- Office layout conversion, OCR, PDF encryption/decryption, embedded PDF image extraction, EPUB conversion, and unavailable animation codecs remain dependency-required. These routes stay registered and do not produce fabricated output.

## Lifecycle and memory

- Heavy libraries remain route/action scoped. PDF.js and Cropper.js are loaded only when required.
- Image and PDF previews use object URLs or source buffers and release resources on reset/navigation.
- PDF thumbnails are lazy-rendered and capped for large documents.
- Studio event listeners are disposed before the next route decoration.
- Final downloads continue to use generated `Blob` objects from the real processors.

## Compatibility constraints

Phase 1 does not rename tool IDs, route hashes, database identifiers, environment variables, API paths, authentication/session structures, or role checks. The shared studios are a presentation and interaction layer over the existing registry and processing contracts.
