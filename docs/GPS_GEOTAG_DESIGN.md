# GPS Map Camera: geotag studio redesign

Implemented and locally verified: 2026-09-23.

## Audit findings

The previous tool already had browser-local upload/camera capture, Leaflet point selection, a Geoapify geocoder function, JPEG GPS EXIF inspection/writing/removal, and real export tests. Those workflows were retained.

The old renderer used a fixed-height strip with a simple crosshair, capped text lines, and conditional omission of overflowing details. Address application filled only truthy fields, which could retain the previous location's city/address. There was no explicit protection against an older lookup overwriting a newer selection or manual edits. Empty coordinate strings were also coerced to zero by the shared coordinate validator.

The redesign changes the presentation and location-resolution layer, not the underlying EXIF encoding/decoding algorithm or other tools. No reference image accompanied the current brief; the layouts are original GXA designs based on its written requirements.

## Location resolution and editing

`gps-geo-model.js` provides the requested pure helpers:

- `normalizeGeocodeResult`: tolerates normalized, Geoapify, nested-address and GeoJSON-properties inputs. Missing/object values do not become visible `undefined`, `null` or `[object Object]` strings.
- `buildLocationTitle`: a place or locality plus city, falling back to city/state/country, then **Location name unavailable**.
- `buildReadableAddress`: normalizes complete formatted addresses or assembles house/street, locality, city, state/postal and country without duplicate segments or empty commas.
- `buildGeoMetadataModel`: preserves raw coordinates independently, correctly retains real zero values, and only includes available/enabled optional metadata.
- `buildExportOverlayModel`: combines the editable fields, template and appearance settings without network access or persistence.

The same normalization module is consumed by the server geocoder and browser editor. Reverse geocoding never substitutes the provider's coordinates for the point selected by the user. Lookup status is announced in the location summary. Refresh keeps manual overrides; choosing/editing a different point clears the previous point's details. Aborted or late requests cannot overwrite a newer point. Coordinates must be applied before exporting an edited point.

Optional fields include altitude, accuracy, device-reported speed/heading, postal code, country, provider-reported timezone/plus code and the actual location-source label. Unsupported or unavailable fields are omitted. No weather readings are invented or fetched. The editable date uses the device/browser timezone; a provider location timezone is labeled separately. Uploaded photos do not acquire a fabricated claim that they were captured at the selected place.

## Export templates

1. **Geo Card Classic:** compact navy bottom strip, left-side map, strong sans-serif place title and compact date/coordinate lines.
2. **Field Proof Layout:** compact charcoal strip, blue accents and a fine map/text separator. The export explicitly says the user-selected location is not independently verified; “Field Proof” is only a layout name.
3. **Travel Stamp Layout:** compact deep teal/gold strip, an editorial serif title and a left-side map.

All layouts keep the source image dimensions and use the same canvas renderer for preview and final JPG/PNG. The strip supports top/bottom placement, 78–100% opacity (84% default), optional metadata and the existing professional fields/logo. Text is measured and wrapped rather than discarding address tails. Layout adapts to portrait/landscape. Extremely short photos or excessive text that cannot fit receive a useful error rather than silently clipped output.

**Compact-stamp follow-up:** Map Size defaults to Small. Small, Medium and Large use 18%, 23% and 28% of the original photo's shorter edge respectively. Small is therefore 18% of portrait width; on a 16:9 landscape photo it is about 10.1% of width, keeping a proportional corner inset instead of a large panel. The map sits at the left, with the complete place, address, date/time, coordinates and enabled optional details beside it. The bottom strip reaches the bottom edge and uses only the measured height required by the map or text. Normal QA examples use 14.4% of portrait height and 19.2% of landscape height; longer optional content can legitimately increase this.

The renderer measures against original photo dimensions, not DOM/CSS width. Independent target transforms handle rounding in reduced previews without changing text wrapping, including odd source dimensions. Visible-stamp mode can export JPG or PNG. Combined and metadata-only modes remain JPEG and visibly disable the PNG selector, so choosing a format cannot silently discard requested GPS EXIF. Download extensions and the existing generic history filename reflect the actual format. No EXIF algorithm changed in this follow-up.

The preview is limited to 1600px on its longest edge to avoid repeatedly repainting full-resolution photos during editing; export still uses the original dimensions. Preview updates are coalesced with animation frames. Stamp-detail mode offers a real 100–250% zoomable, horizontally scrollable canvas without page-level overflow; this is useful for reading a compact full-photo stamp on a small phone. Existing visible-only, metadata-only, combined and GPS-removal modes remain available.

## Mini map and provider boundary

Default: a locally drawn coordinate locator with a north indicator, exact selected coordinates and pin. It is explicitly labeled **not a street map**, with no invented roads or landmarks. It works without keys, provider availability or image requests.

Optional **Load street map**: `POST /api/location-map` sends only numeric latitude/longitude to the same-origin Netlify Function. It uses the existing server-only `GEOAPIFY_API_KEY` to request a fixed 640×480 PNG from Geoapify's Static Maps API. Width, height, style, upstream hostname and zoom are not user-controllable; there is no arbitrary-URL proxy. The response has a timeout, size/signature/dimension checks, sanitized errors and `private, no-store` caching. The key, photo, logo, EXIF, title and professional details are never included in that request. Loading is explicit, avoiding automatic provider calls on every marker movement.

The entire returned provider image is contained in the export, not cropped. Its built-in attribution is retained and a readable provider-credit line is also drawn in the panel. The selected pin is drawn locally. The interactive OpenStreetMap tile layer is not captured. Changing a point invalidates the previous map; provider/key/quota failures retain the local coordinate locator. Street maps are limited to ±85° latitude; the locator and coordinate stamping support the full validated latitude range.

Official implementation references: [Geoapify Static Maps API and attribution](https://apidocs.geoapify.com/docs/maps/static/) and [provider terms](https://www.geoapify.com/terms-and-conditions/). Account-specific entitlement, quota and restrictions must be checked by the owner. No provider account, plan, key, environment variable or external setting was changed.

## Files changed by this task

| File | Purpose |
|---|---|
| `public_html/assets/gps-geo-model.js` (new) | Shared normalization and export model |
| `public_html/assets/gps-export-renderer.js` (new) | Three measured canvas layouts and map/locator rendering |
| `public_html/assets/gps-map-camera.js` | Editor controls, lookup/map lifecycle, preview/export integration |
| `public_html/assets/gps-map-camera.css` | Scoped responsive editor, summary, stamp inspector and dark-mode styling |
| `public_html/assets/gps-photo-core.js` | Reject blank/missing coordinates instead of coercing them to zero |
| `public_html/assets/app.js` | Route-lazy loading of the two new modules |
| `public_html/assets/tool-content.js` | Truthful GPS tool help/privacy/map descriptions |
| `netlify/functions/location-geocode.mjs` | Shared address normalization and missing-coordinate validation |
| `netlify/functions/location-map.mjs` (new) | Fixed, secret-safe static-map endpoint |
| `netlify.toml`, `_redirects` | Only the new `/api/location-map` function mapping |
| `tests/gps-map-camera-function.mjs` | Validate the richer normalized response shape |
| `tests/gps-map-camera-browser.mjs` | Validate the improved place-plus-city title; existing assertions retained |
| `tests/gps-geotag-design.mjs` (new) | Normalization, templates, metadata and map-function contracts |
| `tests/gps-geotag-design-browser.mjs` (new) | Actual exported JPEGs, map/failure/race, text-bounds and responsive checks |
| `package.json` | New syntax/contracts and optional browser QA command |
| This document | Audit, decisions, evidence and deployment checklist |

The normal production build also regenerates `dist/`, the existing generated audit files and build snapshots. Pre-existing local work was preserved. No dependencies were added. No authentication/database logic, schema, other tool engines, routes, Google tags, publisher IDs or AdSense files were edited by this task.

## Executed verification

- `npm run lint`: passed, exit 0.
- `npm test`: passed, exit 0; existing repository, 95-tool, SEO, authentication, admin, analytics and processing contracts remain green. New geotag contracts are part of normal tests.
- `npm run build`: passed, exit 0, including Background Remover TypeScript/Vite and its 10 tests.
- `npm run test:gps-map-camera:browser`: passed. Existing visible+EXIF output, search, permission states, camera capture/denial/cleanup, metadata-only replacement and GPS removal were exercised.
- `npm run test:gps-geotag:browser`: passed. All three templates exported and reopened in portrait and landscape with verified GPS EXIF and source dimensions; also tested provider-map fixture, failed-map fallback, empty geocoding, (0,0), DMS/top placement, manual overrides during lookup, stale responses, full long-address text bounds, stamp zoom/panning, reset and dark mode.
- Both Netlify Functions also bundled successfully with esbuild (in-memory output only).
- `git diff --check`: passed, exit 0. Windows LF/CRLF conversion warnings are informational.

The browser runs use local Chrome via Playwright. Existing GPS responsive QA covers 320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1366, 1440, 1536 and 1920px. New populated-studio/inspector checks cover 320, 360, 390, 430, 768, 1024 and 1440px with no page overflow.

The tests block Google tracking/ads and interactive OSM tiles. Geocoding, camera/geolocation and static-map responses use labeled local fixtures, not live accounts or private data. Actual JPEG creation/download and EXIF read-back run in the browser. Provider availability and physical device hardware were not tested. Normal PostgreSQL integration remains intentionally opt-in/skipped. Existing negative-input fixture diagnostics and the existing Vite classic-script notice are non-failing.

## Evidence and live checklist

The original large-layout evidence is under `test-results/gps-geotag-design/`. Current **compact** evidence is under `test-results/gps-compact-stamp/`: six template/orientation JPEGs, street-map portrait/landscape fixture JPEGs, Medium/Large examples, 3000×4000 portrait and 3840×2160 landscape PNG exports, failure fallback, top/DMS output, mobile/desktop/dark/zoom screenshots, and measured geometry in `results.json`. Fixture images are explicitly labeled synthetic QA content and are not shipped as user photos or production records. Existing workflow screenshots are under `test-results/gps-map-camera-browser/`.

The compact browser suite additionally asserts map ratios/left placement across all presets, Small as default, original export dimensions, preview/export geometry, matching long-text wrapping with odd original dimensions, unchanged PNG pixels above the strip, actual opacity changes, top placement/map hiding, uncropped provider attribution and safe JPG/PNG mode switching. Full live Geoapify rendering and physical-device camera/GPS testing still require the manual checks below.

### Files changed in the compact-stamp follow-up only

- `public_html/assets/gps-export-renderer.js`: source-proportional compact strips, left map for all presets and measured wrapping.
- `public_html/assets/gps-geo-model.js`: validated Small/Medium/Large option and semi-transparent default.
- `public_html/assets/gps-map-camera.js`: map size, JPG/PNG visible-stamp output, preview synchronization and safe JPEG-only EXIF modes.
- `public_html/assets/app.js`: generic completed-output history label follows JPG/PNG format; no account/history query changes.
- `public_html/assets/tool-content.js`: GPS-only help updated for map sizing and PNG export.
- `tests/gps-geotag-design.mjs`: model defaults/size/opacity contracts.
- `tests/gps-geotag-design-browser.mjs`: compact output measurements, full-resolution PNG downloads and regression coverage.
- `docs/GPS_GEOTAG_DESIGN.md`: this implementation/evidence update.
- `docs/ADSENSE_CONTENT_AUDIT.md`: build-generated GPS help word count only; no AdSense configuration changes.

The existing production generator refreshes the published GPS HTML/assets and audit artifacts. No dependencies, routes, backend/Netlify configuration, GPS EXIF core, shared CSS, other tools or Google integrations were changed by this compact-stamp follow-up. Pre-existing local changes remain intact.

Compact follow-up validation: `npm run lint`, `npm test`, `npm run build`, `npm run test:gps-map-camera:browser`, `npm run test:gps-geotag:browser`, and `git diff --check` all exited 0. The production build repeated lint/tests; both browser suites were rerun against the final built assets. PostgreSQL integration stayed explicitly opt-in/skipped. Preview approval is pending; nothing was committed, pushed or deployed.

Before releasing to users:

1. Verify the already-configured `GEOAPIFY_API_KEY` is available to Netlify Functions and permitted to call Static Maps as well as geocoding. Check quota and provider restrictions; no new environment variable is required.
2. In a preview deployment, test real reverse lookup, a provider map, readable attribution, and the fallback when the map service is denied/offline. Confirm only coordinates are sent to `/api/location-map`.
3. On physical Android Chrome and iOS Safari, test camera/location permissions, actual accuracy/speed/heading availability, file selection, inspector touch scrolling, and JPEG download. These hardware/browser combinations were not certified by local Chrome emulation.
4. Test a real portrait and landscape photo, a long multilingual address, an optional logo, and EXIF read-back. Check timezone interpretation against the device's clock.
5. Keep the original source photo. Visible stamping recompresses JPEG pixels; the existing metadata replacement/removal intentionally strips other EXIF. A geotag is not independently certified location evidence.

No commit, push, deployment, provider purchase or external configuration was performed.
