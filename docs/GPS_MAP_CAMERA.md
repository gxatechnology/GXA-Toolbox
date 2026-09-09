# GPS Map Camera – Geotag Photo

Canonical route: `/gps-map-camera/`

## Architecture

The workspace is registered centrally in `public_html/assets/app.js` and loaded only on its route. `gps-map-camera.js` owns upload, camera, geolocation, map, preview, export, and cleanup. `gps-photo-core.js` owns bounded JPEG/EXIF parsing and writing. The shared generator creates the canonical indexable HTML route, content, FAQ schema, sitemap entry, and copies Leaflet 1.9.4 from the locked npm dependency into `dist/assets/vendor/leaflet/`.

Photo bytes, EXIF, logo, filenames, coordinates, address, accuracy, company/project fields, employee name, and remarks stay in browser memory and are excluded from analytics. Only the existing `tool_open`, `tool_start`, `tool_complete`, `tool_fail`, and `tool_download` lifecycle with generic statuses is used. Leaving or resetting the route revokes result URLs, aborts a geocoder request, removes the map, and stops every camera track.

## Output boundaries

- **Visible Location Stamp** draws the selected details into the pixels and re-encodes a high-quality JPEG at the original pixel dimensions.
- **GPS Metadata Only** accepts a valid JPEG, replaces EXIF with a small standard GPS block, and preserves the existing compressed JPEG scan bytes without pixel decoding/recompression.
- **Both Stamp + GPS Metadata** renders the visible JPEG, then writes and reads back GPS EXIF before enabling download.
- **Remove Existing GPS** removes all EXIF APP1 blocks. This reliably removes supported GPS data and avoids pixel recompression, but also removes other EXIF camera/date/orientation fields.

The written GPS IFD includes version, latitude/ref, longitude/ref, UTC time, UTC date, and optional altitude/ref. Uploaded/manual location is explicitly described as user-added information, not proof of original capture. Live camera plus current location records the device-reported location at capture time but is not cryptographic or independently certified proof.

Batch input is intentionally deferred. A single 30 MB / 8,192-pixel-side / 24-megapixel image and one 5 MB logo keep the initial browser memory envelope predictable, especially on phones.

## Map and geocoding

Leaflet uses the OpenStreetMap standard interactive tile endpoint with visible contributor attribution. It performs no bulk download, offline prefetch, or hidden tile export. Photo exports contain a project-drawn coordinate/location diagram, not OpenStreetMap tile imagery. This follows the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

The application does not embed the public Nominatim endpoint. Search and reverse geocoding use a same-origin Netlify Function backed by Geoapify's documented [forward](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/) and [reverse](https://apidocs.geoapify.com/docs/geocoding/reverse-geocoding/) geocoding API. The function normalizes the response, caps inputs/results, caches matching lookups briefly, times out upstream calls, keeps the API key server-only, and returns sanitized errors. Missing address parts remain empty and all returned details remain editable.

### Owner configuration

Add `GEOAPIFY_API_KEY` as a sensitive Netlify environment variable for the Production context, then trigger a normal deployment after the code is committed and pushed by the site owner. Do not add the key to repository files or browser code. If it is not configured, location search and reverse geocoding show an explicit unavailable message; upload, camera, current location, interactive map selection, existing GPS, manual coordinates, stamping, and EXIF output still work.

Camera and current-location access also require HTTPS and user permission. The production Permissions Policy grants `camera` and `geolocation` to `self` only, while microphone remains denied.

## Validation

`tests/gps-map-camera-core.mjs` independently parses produced GPS EXIF and verifies signed coordinates, N/S/E/W refs, UTC date/time, replacement, removal, source dimensions, and unchanged JPEG scan bytes. `tests/gps-map-camera-function.mjs` uses deterministic mocked Geoapify responses. `tests/gps-map-camera-contract.mjs` covers registry/SEO/content/assets/privacy/policy/licensing boundaries. `tests/gps-map-camera-browser.mjs` exercises synthetic uploads, visible + EXIF output/reopen, logo and special characters, current-location states, search/reverse results, map click/drag, existing/replace/remove GPS, mocked camera capture/denial/track cleanup, and the required mobile/desktop viewport set.
