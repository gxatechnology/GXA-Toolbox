(function (global) {
  'use strict';

  let active = null;
  const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const MAX_TEXT = 240;

  const html = `
    <section class="gps-studio" aria-label="GPS Map Camera workspace">
      <div class="gps-studio__notice"><i data-lucide="shield-check" aria-hidden="true"></i><div><strong>Photo processing stays in this browser.</strong><p>Photos, source EXIF, logos and professional details stay in this browser and out of analytics. Location lookup sends your query or selected coordinates to Geoapify through GXA Toolbox. Loading a street map sends the selected coordinates, never the photo.</p></div></div>
      <div class="gps-studio__grid">
        <section class="gps-studio__panel" aria-labelledby="gps-photo-heading">
          <div class="gps-studio__panel-head"><div><p class="gps-studio__eyebrow">Photo & preview</p><h2 id="gps-photo-heading">Choose or capture a photo</h2></div><button type="button" class="btn btn-ghost gps-studio__reset" hidden>Start over</button></div>
          <div class="gps-studio__source-actions"><button type="button" class="btn btn-primary gps-studio__choose"><i data-lucide="image-up" aria-hidden="true"></i> Upload Photo</button><button type="button" class="btn btn-secondary gps-studio__camera-start"><i data-lucide="camera" aria-hidden="true"></i> Take Photo</button><input class="gps-studio__file" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden></div>
          <div class="gps-studio__upload" role="button" tabindex="0" aria-label="Choose a JPEG, PNG, or WebP photo"><i data-lucide="map-pinned" aria-hidden="true"></i><strong>Upload an existing photo</strong><span>JPEG, PNG, or WebP up to 30 MB. Drag and drop is optional.</span></div>
          <div class="gps-studio__camera" hidden><video playsinline muted aria-label="Live camera preview"></video><label class="gps-studio__camera-option"><input type="checkbox" class="gps-studio__camera-location" checked><span>Request current device location after I capture</span></label><div class="gps-studio__action-row"><button type="button" class="btn btn-primary gps-studio__capture">Capture Photo</button><button type="button" class="btn btn-ghost gps-studio__camera-cancel">Cancel Camera</button></div></div>
          <div class="gps-studio__photo" hidden>
            <p class="gps-studio__file-meta"></p>
            <div class="gps-studio__exif-box"><strong>Original photo information</strong><p class="gps-studio__exif-status"></p><div class="gps-studio__action-row gps-studio__existing-actions" hidden><button type="button" class="btn btn-secondary gps-studio__use-existing">Use Existing Location</button><button type="button" class="btn btn-ghost gps-studio__remove-gps">Remove Existing GPS</button></div></div>
            <div class="gps-studio__preview-bar"><span class="gps-studio__template-name">Geo Card Classic</span><label class="gps-studio__check"><input class="gps-studio__inspect" type="checkbox"><span>Inspect stamp detail</span></label></div>
            <div class="gps-studio__preview"><canvas aria-label="Location-stamped photo preview"></canvas></div>
            <label class="gps-studio__detail-zoom gps-studio__field" hidden><span>Stamp detail zoom <output>100%</output></span><input type="range" min="100" max="250" step="25" value="100" aria-label="Stamp detail zoom"></label>
            <div class="gps-studio__detail" hidden tabindex="0" role="region" aria-label="Stamp detail; scroll horizontally when zoomed"><canvas aria-label="Enlarged location stamp preview"></canvas></div>
            <p class="gps-studio__authenticity"></p>
          </div>
        </section>
        <section class="gps-studio__panel gps-studio__settings" aria-labelledby="gps-settings-heading">
          <div class="gps-studio__panel-head"><div><p class="gps-studio__eyebrow">Location & stamp</p><h2 id="gps-settings-heading">Configure the output</h2></div></div>
          <div class="gps-studio__section">
            <div class="gps-studio__section-title"><h3>Choose location</h3></div>
            <button type="button" class="btn btn-secondary gps-studio__current"><i data-lucide="locate-fixed" aria-hidden="true"></i> Use Current Location</button>
            <form class="gps-studio__search" role="search"><label class="sr-only" for="gps-search-query">Search location, address or place</label><input id="gps-search-query" type="search" maxlength="160" autocomplete="off" placeholder="Search location, address or place"><button type="submit" class="btn btn-secondary">Search</button></form>
            <p class="gps-studio__help gps-studio__geocoder-note">Search requires the optional production geocoder configuration. Manual coordinates and current location remain available without it.</p>
            <ul class="gps-studio__search-results" aria-label="Location search results"></ul>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Latitude</span><input class="gps-studio__lat" type="number" min="-90" max="90" step="any" inputmode="decimal" placeholder="28.613939"></label><label class="gps-studio__field"><span>Longitude</span><input class="gps-studio__lon" type="number" min="-180" max="180" step="any" inputmode="decimal" placeholder="77.209021"></label></div>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Altitude (metres, optional)</span><input class="gps-studio__alt" type="number" min="-20000" max="20000" step="any" inputmode="decimal"></label><label class="gps-studio__field"><span>Accuracy</span><input class="gps-studio__accuracy" type="text" readonly value="Not reported"></label></div>
            <div class="gps-studio__action-row"><button type="button" class="btn btn-secondary gps-studio__apply-coordinates">Apply Coordinates</button><button type="button" class="btn btn-ghost gps-studio__lookup">Find Address</button></div>
            <div class="gps-studio__map" aria-label="Interactive map for selecting a location"></div>
            <p class="gps-studio__help">Interactive map © OpenStreetMap contributors. Click or drag the marker to select a point. Standard map tiles are never copied into the downloaded image.</p>
          </div>
          <div class="gps-studio__section">
            <h3>Location details</h3>
            <div class="gps-studio__resolved" aria-live="polite"><span class="gps-studio__eyebrow">Selected place</span><strong class="gps-studio__resolved-title">Location name unavailable</strong><p class="gps-studio__resolved-address">Choose a location to begin.</p><small class="gps-studio__lookup-state">Coordinates remain independent of address lookup.</small></div>
            <p class="gps-studio__help">Edit the title or address below. A lookup refresh preserves your edits; choosing a different point starts fresh.</p>
            <label class="gps-studio__field"><span>Display title / Site Name</span><input data-field="place" maxlength="160" placeholder="Location name unavailable"></label>
            <label class="gps-studio__field"><span>Display address</span><textarea data-field="address" maxlength="480"></textarea></label>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Area / Locality</span><input data-field="locality" maxlength="100"></label><label class="gps-studio__field"><span>City</span><input data-field="city" maxlength="100"></label></div>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>State</span><input data-field="state" maxlength="100"></label><label class="gps-studio__field"><span>Postal Code</span><input data-field="postal" maxlength="30"></label></div>
            <label class="gps-studio__field"><span>Country</span><input data-field="country" maxlength="100"></label>
          </div>
          <div class="gps-studio__section">
            <h3>Professional details <span class="gps-studio__help">(optional)</span></h3>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Company Name</span><input data-field="company" maxlength="120"></label><label class="gps-studio__field"><span>Project Name</span><input data-field="project" maxlength="120"></label></div>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Job / Work Order ID</span><input data-field="job" maxlength="80"></label><label class="gps-studio__field"><span>Employee / Inspector</span><input data-field="employee" maxlength="120"></label></div>
            <label class="gps-studio__field"><span>Remarks / Description</span><textarea data-field="remarks" maxlength="240"></textarea></label>
            <label class="gps-studio__field"><span>Company Logo</span><input class="gps-studio__logo" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"><small class="gps-studio__help">PNG, JPEG, or WebP up to 5 MB. The logo remains browser-local.</small></label>
          </div>
          <div class="gps-studio__section">
            <h3>Stamp and output</h3>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Template</span><select class="gps-studio__template"><option value="classic">Geo Card Classic</option><option value="field">Field Proof Layout</option><option value="travel">Travel Stamp Layout</option></select></label><label class="gps-studio__field"><span>Stamp Position</span><select class="gps-studio__position"><option value="bottom">Bottom</option><option value="top">Top</option></select></label></div>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Coordinate Format</span><select class="gps-studio__coordinate-format"><option value="decimal">Decimal degrees</option><option value="dms">Degrees, minutes, seconds</option></select></label><label class="gps-studio__field"><span>Output Mode</span><select class="gps-studio__mode"><option value="both" selected>Both stamp + GPS metadata</option><option value="stamp">Visible location stamp</option><option value="metadata">GPS metadata only</option></select></label></div>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Map Size</span><select class="gps-studio__map-size"><option value="small" selected>Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label><label class="gps-studio__field"><span>File Format</span><select class="gps-studio__format" aria-describedby="gps-format-help" disabled><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label></div>
            <p class="gps-studio__help" id="gps-format-help">GPS metadata modes use JPG. Choose Visible location stamp to export JPG or PNG. Small maps use 18% of the photo’s shorter edge.</p>
            <label class="gps-studio__field"><span>Photo / Stamp Date & Time (device timezone)</span><input class="gps-studio__date" type="datetime-local"></label>
            <label class="gps-studio__field"><span>Overlay opacity <output class="gps-studio__opacity-value">84%</output></span><input class="gps-studio__opacity" type="range" min="78" max="100" value="84"></label>
            <label class="gps-studio__check"><input class="gps-studio__map-card" type="checkbox" checked><span>Show mini map / coordinate locator</span></label>
            <div class="gps-studio__map-option"><button type="button" class="btn btn-secondary gps-studio__load-map" disabled><i data-lucide="map" aria-hidden="true"></i> Load street map</button><p class="gps-studio__map-status" role="status">Offline coordinate locator selected. No invented streets or landmarks.</p><small class="gps-studio__help">Street maps use Geoapify and its quota. Coordinates are sent only when you load a map. Attribution is retained in the export.</small><small><a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a></small></div>
            <fieldset class="gps-studio__metadata"><legend>Additional information</legend>
            <label class="gps-studio__check"><input type="checkbox" data-visible="altitude" checked><span>Altitude</span></label><label class="gps-studio__check"><input type="checkbox" data-visible="speed" ><span>Speed</span></label><label class="gps-studio__check"><input type="checkbox" data-visible="heading" ><span>Compass heading</span></label><label class="gps-studio__check"><input type="checkbox" data-visible="postal" ><span>Postal code</span></label><label class="gps-studio__check"><input type="checkbox" data-visible="country" ><span>Country</span></label><label class="gps-studio__check"><input type="checkbox" data-visible="timezone" ><span>Location timezone</span></label><label class="gps-studio__check"><input type="checkbox" data-visible="plusCode" ><span>Plus code</span></label><label class="gps-studio__check"><input type="checkbox" data-visible="source" checked><span>Location source</span></label>
            </fieldset><p class="gps-studio__help">Only available values appear. Speed and heading require a device reading. Weather is not collected. “Field Proof” is a layout name, not certified evidence.</p>
            <label class="gps-studio__check"><input class="gps-studio__show-accuracy" type="checkbox" checked><span>Show reported GPS accuracy when available</span></label>
            <div class="gps-studio__privacy">This image may contain precise GPS location information. Anyone with access to the file may be able to read that location.</div>
            <button type="button" class="btn btn-primary btn-lg gps-studio__generate" disabled><i data-lucide="map-pin-check" aria-hidden="true"></i> Create Geotagged Photo</button>
            <p class="gps-studio__status" role="status" aria-live="polite"></p>
          </div>
        </section>
      </div>
      <section class="gps-studio__panel gps-studio__result" hidden aria-labelledby="gps-result-heading"><div><p class="gps-studio__eyebrow">Result</p><h2 id="gps-result-heading">Your photo is ready</h2></div><p class="gps-studio__result-meta"></p><button type="button" class="btn btn-primary btn-lg gps-studio__download"><i data-lucide="download" aria-hidden="true"></i> Download Photo</button></section>
    </section>`;

  function setStatus(state, message, error = false) { state.elements.status.textContent = message; state.elements.status.classList.toggle('is-error', error); }
  function revoke(url) { if (url) URL.revokeObjectURL(url); }
  function stopCamera(state) { state.stream?.getTracks().forEach(track => track.stop()); state.stream = null; if (state.elements.video) state.elements.video.srcObject = null; state.elements.camera.hidden = true; }
  function cleanText(value, max = MAX_TEXT) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max); }
  function localDateValue(date = new Date()) { const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
  function parsedExifDate(value) { const match = String(value || '').match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/); return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}` : ''; }
  function isSupportedSignature(bytes) { return bytes[0] === 0xff && bytes[1] === 0xd8 || bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 || String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'; }
  function canvasBlob(canvas, type = 'image/jpeg', quality = .92) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode the output image.')), type, quality)); }
  function canvas(width, height) { const output = document.createElement('canvas'); output.width = width; output.height = height; return output; }

  async function decodePhoto(blob) {
    let drawable;
    if ('createImageBitmap' in global) drawable = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    else {
      const url = URL.createObjectURL(blob); const image = new Image(); image.decoding = 'async'; image.src = url;
      try { await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('The photo cannot be decoded by this browser.')); }); drawable = image; } finally { URL.revokeObjectURL(url); }
    }
    const width = drawable.width || drawable.naturalWidth; const height = drawable.height || drawable.naturalHeight;
    global.GxaGpsPhotoCore.assertImageLimits(blob.size, width, height);
    const output = canvas(width, height); output.getContext('2d').drawImage(drawable, 0, 0, width, height); drawable.close?.(); return output;
  }

  function coordinates(state) { return global.GxaGpsPhotoCore.validateCoordinates(state.elements.lat.value, state.elements.lon.value); }
  function accuracyText(state) { return Number.isFinite(state.location.accuracy) ? `±${state.location.accuracy} m` : 'Not reported'; }
  function authenticityText(state) { return state.sourceKind === 'live' && state.location.source === 'current' ? 'Device-reported location recorded at capture time. This tool does not provide cryptographic or independently certified location proof.' : 'Location information was added or confirmed by the user. It does not prove where an uploaded photo was originally taken.'; }
  function updateAuthenticity(state) { state.elements.authenticity.textContent = authenticityText(state); }

  function stampFields(state) {
    return { ...state.resolved, ...Object.fromEntries(Object.entries(state.elements.fields).map(([key, element]) =>
      [key, global.GxaGeoModel.clean(element.value, key === 'address' ? 480 : 240)])) };
  }
  function overlayModel(state) {
    const visible = Object.fromEntries([...state.root.querySelectorAll('[data-visible]')].map(input => [input.dataset.visible, input.checked]));
    visible.accuracy = state.elements.showAccuracy.checked;
    return global.GxaGeoModel.buildExportOverlayModel({ fields: stampFields(state),
      location: { ...state.location, ...coordinates(state), altitude: state.elements.alt.value },
      date: state.elements.date.value, sourceKind: state.sourceKind, visible,
      coordinateFormat: state.elements.coordinateFormat.value, template: state.elements.template.value, mapSize: state.elements.mapSize.value,
      position: state.elements.position.value, opacity: Number(state.elements.opacity.value) / 100, showMap: state.elements.mapCard.checked });
  }
  function renderStamp(state, target) {
    if (state.elements.mode.value === 'metadata') {
      target.getContext('2d').drawImage(state.sourceCanvas, 0, 0, target.width, target.height); return null;
    }
    return global.GxaGpsExport.render(target, state.sourceCanvas, overlayModel(state), { mapImage: state.mapImage, logo: state.logoCanvas });
  }
  function updateLocationSummary(state, message) {
    const fields = stampFields(state);
    state.elements.resolvedTitle.textContent = global.GxaGeoModel.buildLocationTitle(fields, fields.place);
    state.elements.resolvedAddress.textContent = global.GxaGeoModel.buildReadableAddress(fields, fields.address) || 'Address unavailable. Coordinates are still usable.';
    if (message) state.elements.lookupState.textContent = message;
  }
  function renderPreview(state) {
    if (active !== state) return;
    state.renderVersion = (state.renderVersion || 0) + 1;
    updateLocationSummary(state);
    state.elements.format.disabled = state.elements.mode.value !== 'stamp';
    if (state.elements.format.disabled) state.elements.format.value = 'image/jpeg';
    state.elements.opacityValue.textContent = state.elements.opacity.value + '%';
    state.elements.templateName.textContent = state.elements.template.selectedOptions[0].textContent;
    if (state.result) { revoke(state.resultUrl); state.resultUrl = ''; state.result = null; state.elements.result.hidden = true; }
    if (!state.sourceCanvas) return;
    const preview = state.elements.preview, context = preview.getContext('2d');
    context.clearRect(0, 0, preview.width, preview.height);
    context.drawImage(state.sourceCanvas, 0, 0, preview.width, preview.height);
    let box = null;
    if (state.elements.lat.value !== '' && state.elements.lon.value !== '' && !state.dirtyPoint) {
      try { box = renderStamp(state, preview); } catch (error) { setStatus(state, error.message, true); }
    }
    const inspect = state.elements.inspect.checked && box;
    state.elements.previewWrap.hidden = Boolean(inspect); state.elements.detail.hidden = !inspect;
    state.root.querySelector('.gps-studio__detail-zoom').hidden = !inspect;
    if (inspect) {
      const detail = state.elements.detailCanvas;
      detail.width = Math.ceil(box.width); detail.height = Math.ceil(box.height);
      detail.getContext('2d').drawImage(preview, box.x, box.y, box.width, box.height, 0, 0, detail.width, detail.height);
    }
    state.elements.privacy.hidden = state.elements.mode.value === 'stamp';
  }
  function schedulePreview(state) {
    global.cancelAnimationFrame(state.previewFrame);
    state.previewFrame = global.requestAnimationFrame(() => renderPreview(state));
  }
  function applyAddress(state, item) {
    const model = global.GxaGeoModel, resolved = model.normalizeGeocodeResult(item);
    state.resolved = resolved;
    const values = { ...resolved, place: model.buildLocationTitle(resolved), address: model.buildReadableAddress(resolved) };
    for (const key of ['place', 'address', 'locality', 'city', 'state', 'postal', 'country']) {
      if (!state.overrides.has(key)) state.elements.fields[key].value = values[key] || '';
    }
    updateLocationSummary(state);
  }
  function clearLocationDetails(state) {
    state.resolved = {}; state.overrides.clear();
    for (const key of ['place', 'address', 'locality', 'city', 'state', 'postal', 'country']) state.elements.fields[key].value = '';
    state.mapController?.abort(); state.mapImage = null; state.mapRequest += 1;
    state.elements.loadMap.disabled = false;
    state.elements.mapStatus.textContent = 'Coordinate locator selected. Load a street map for this point if needed.';
    updateLocationSummary(state, 'Location name unavailable. A new point will not reuse old address fields.');
  }
  async function loadStreetMap(state) {
    if (state.dirtyPoint) { setStatus(state, 'Apply coordinates before loading a street map.', true); return; }
    let point; try { point = coordinates(state); } catch (error) { setStatus(state, error.message, true); return; }
    state.mapController?.abort();
    const controller = new AbortController(), version = ++state.mapRequest;
    state.mapController = controller; state.elements.loadMap.disabled = true;
    state.elements.mapStatus.textContent = 'Loading an attributed street map…';
    const timer = global.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/location-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(point), signal: controller.signal });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || 'Street map unavailable.'); }
      const blob = await response.blob();
      if (blob.type !== 'image/png' || blob.size > 2_000_000) throw new Error('The map image could not be read.');
      const image = await decodePhoto(blob);
      if (active !== state || version !== state.mapRequest) return;
      state.mapImage = image; state.elements.mapStatus.textContent = 'Street map ready. Selected point and provider credits are included in the export.';
      renderPreview(state);
    } catch (error) {
      if (active !== state || version !== state.mapRequest) return;
      state.mapImage = null; state.elements.mapStatus.textContent = (error.name === 'AbortError' ? 'Street map timed out.' : error.message) + ' Using the coordinate locator instead.';
      renderPreview(state);
    } finally {
      global.clearTimeout(timer);
      if (active === state && version === state.mapRequest) { state.elements.loadMap.disabled = Boolean(state.mapImage); state.mapController = null; }
    }
  }

  async function geocode(state, action, parameters) {
    const query = new URLSearchParams({ action, ...parameters }); const controller = new AbortController(); state.geocodeController?.abort(); state.geocodeController = controller;
    const timeout = global.setTimeout(() => controller.abort(), 8000);
    try { const response = await fetch(`/api/location-geocode?${query}`, { headers: { Accept: 'application/json' }, signal: controller.signal }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || 'Location lookup is unavailable.'); return body; }
    finally { global.clearTimeout(timeout); if (state.geocodeController === controller) state.geocodeController = null; }
  }

  async function reverseGeocode(state) {
    const sequence = ++state.lookupSeq;
    try {
      const point = coordinates(state);
      if (state.dirtyPoint) throw new Error('Apply coordinates before looking up the address.');
      updateLocationSummary(state, 'Resolving location…'); state.elements.resolved.setAttribute('aria-busy', 'true');
      const body = await geocode(state, 'reverse', { lat: String(point.latitude), lon: String(point.longitude) });
      if (active !== state || sequence !== state.lookupSeq) return;
      applyAddress(state, body.result || {}); renderPreview(state);
      updateLocationSummary(state, body.result ? 'Location resolved. Review the details; your manual edits are preserved.' : 'Location name unavailable. Coordinates remain selected; you can enter the title and address.');
    } catch (error) {
      if (active !== state || sequence !== state.lookupSeq) return;
      updateLocationSummary(state, error.name === 'AbortError' ? 'Location lookup timed out. Coordinates remain selected.' : error.message);
    } finally { if (active === state && sequence === state.lookupSeq) state.elements.resolved.removeAttribute('aria-busy'); }
  }
  function updatePoint(state, location, { moveMap = true, zoom = 16, reverse = false } = {}) {
    const point = global.GxaGpsPhotoCore.validateCoordinates(location.latitude, location.longitude);
    state.geocodeController?.abort(); state.lookupSeq += 1; state.elements.resolved.removeAttribute('aria-busy');
    clearLocationDetails(state); state.dirtyPoint = false;
    state.location = { ...point, accuracy: Number.isFinite(location.accuracy) ? Number(location.accuracy) : null,
      altitude: Number.isFinite(location.altitude) ? Number(location.altitude) : null,
      speed: Number.isFinite(location.speed) ? location.speed : null, heading: Number.isFinite(location.heading) ? location.heading : null,
      source: location.source || 'manual' };
    state.elements.lat.value = point.latitude.toFixed(6); state.elements.lon.value = point.longitude.toFixed(6);
    state.elements.alt.value = state.location.altitude ?? ''; state.elements.accuracy.value = accuracyText(state);
    if (state.marker) state.marker.setLatLng([point.latitude, point.longitude]);
    if (moveMap && state.map) state.map.setView([point.latitude, point.longitude], zoom);
    state.elements.generate.disabled = !state.sourceCanvas; updateAuthenticity(state); renderPreview(state);
    if (reverse) reverseGeocode(state);
  }
  async function searchLocation(state, query) {
    const value = cleanText(query, 160); state.elements.results.replaceChildren();
    if (value.length < 2) { setStatus(state, 'Enter at least two characters to search.', true); return; }
    const sequence = ++state.lookupSeq;
    try {
      setStatus(state, 'Searching for locations…'); const body = await geocode(state, 'search', { q: value });
      if (active !== state || sequence !== state.lookupSeq) return;
      const results = Array.isArray(body.results) ? body.results.slice(0, 5) : [];
      for (const item of results) {
        const li = document.createElement('li'), button = document.createElement('button');
        button.type = 'button'; button.className = 'gps-studio__search-result'; button.textContent = item.address || item.place || `${item.latitude}, ${item.longitude}`;
        button.addEventListener('click', () => {
          updatePoint(state, { latitude: item.latitude, longitude: item.longitude, source: 'search' });
          applyAddress(state, item); renderPreview(state); state.elements.results.replaceChildren();
          updateLocationSummary(state, 'Search result selected. Review the marker and address.');
          setStatus(state, 'Search result selected. Review the marker and address.');
        });
        li.appendChild(button); state.elements.results.appendChild(li);
      }
      setStatus(state, results.length ? 'Select a search result.' : 'No matching location was returned. Try a broader query or use coordinates.', !results.length);
    } catch (error) { if (active === state && sequence === state.lookupSeq) setStatus(state, error.name === 'AbortError' ? 'Location search timed out.' : error.message, true); }
    finally { if (active === state && sequence === state.lookupSeq) state.elements.resolved.removeAttribute('aria-busy'); }
  }

  async function initMap(state) {
    try {
      if (!document.getElementById('leaflet-styles')) { const link = document.createElement('link'); link.id = 'leaflet-styles'; link.rel = 'stylesheet'; link.href = '/assets/vendor/leaflet/leaflet.css'; link.crossOrigin = ''; document.head.appendChild(link); }
      await global.GxaWorkspace.loadScriptOnce('/assets/vendor/leaflet/leaflet.js', 'L'); if (!active || active !== state) return;
      const map = global.L.map(state.elements.map, { zoomControl: true, attributionControl: true }).setView([20.5937, 78.9629], 4); global.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map); const icon = global.L.divIcon({ className: 'gps-studio__pin', html: '<span aria-hidden="true">•</span>', iconSize: [28, 28], iconAnchor: [14, 28] }); const marker = global.L.marker([20.5937, 78.9629], { draggable: true, icon }).addTo(map); state.map = map; state.marker = marker;
      map.on('click', event => updatePoint(state, { latitude: event.latlng.lat, longitude: event.latlng.lng, source: 'map' }, { moveMap: false, reverse: true })); marker.on('dragend', () => { const point = marker.getLatLng(); updatePoint(state, { latitude: point.lat, longitude: point.lng, source: 'map' }, { moveMap: false, reverse: true }); }); global.setTimeout(() => map.invalidateSize(), 0);
    } catch (_) { state.elements.map.replaceChildren(); const message = document.createElement('p'); message.className = 'gps-studio__help'; message.textContent = 'Interactive map unavailable. Current location and manual coordinates still work.'; state.elements.map.appendChild(message); }
  }

  function geolocationMessage(error) { if (error?.code === 1) return 'Location permission was denied. Enter coordinates or select a point on the map.'; if (error?.code === 2) return 'Your device could not determine a location. Try again outdoors or enter coordinates.'; if (error?.code === 3) return 'Location lookup timed out. Try again or enter coordinates.'; return 'Current location is unavailable in this browser.'; }
  function useCurrentLocation(state) { if (!('geolocation' in navigator)) { setStatus(state, 'This browser does not provide the Geolocation API. Enter coordinates or use the map.', true); return Promise.resolve(false); } state.elements.current.disabled = true; setStatus(state, 'Waiting for device location…'); return new Promise(resolve => navigator.geolocation.getCurrentPosition(position => { if (active !== state) { resolve(false); return; } state.elements.current.disabled = false; updatePoint(state, { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, altitude: position.coords.altitude, speed: position.coords.speed, heading: position.coords.heading, source: 'current' }, { reverse: true }); setStatus(state, `Current location received with reported accuracy ${accuracyText(state)}.`); resolve(true); }, error => { if (active !== state) { resolve(false); return; } state.elements.current.disabled = false; setStatus(state, geolocationMessage(error), true); resolve(false); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })); }

  async function selectPhoto(state, file, sourceKind = 'upload') {
    stopCamera(state); revoke(state.resultUrl); state.resultUrl = ''; state.result = null; state.elements.result.hidden = true; state.elements.generate.disabled = true; setStatus(state, 'Validating and decoding the photo…');
    try {
      if (!file || !ACCEPTED_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.'); if (file.size < 1 || file.size > global.GxaGpsPhotoCore.MAX_IMAGE_BYTES) throw new Error('Choose a photo between 1 byte and 30 MB.'); const bytes = new Uint8Array(await file.arrayBuffer()); if (!isSupportedSignature(bytes)) throw new Error('The file signature does not match a supported JPEG, PNG, or WebP image.'); const decoded = await decodePhoto(file);
      state.file = file; state.sourceBytes = bytes; state.sourceCanvas = decoded; state.sourceKind = sourceKind; state.exif = null; if (global.GxaGpsPhotoCore.isJpeg(bytes)) state.exif = global.GxaGpsPhotoCore.inspectJpeg(bytes); const previewScale = Math.min(1, 1600 / Math.max(decoded.width, decoded.height)); state.elements.preview.width = Math.round(decoded.width * previewScale); state.elements.preview.height = Math.round(decoded.height * previewScale); state.elements.photo.hidden = false; state.elements.upload.hidden = true; state.elements.reset.hidden = false; state.elements.fileMeta.textContent = `${sourceKind === 'live' ? 'Live camera capture' : cleanText(file.name, 180)} • ${decoded.width} × ${decoded.height} • ${global.GxaWorkspace.formatBytes(file.size)}`;
      const captureDate = state.exif?.dateTimeOriginal ? parsedExifDate(state.exif.dateTimeOriginal) : ''; state.elements.date.value = sourceKind === 'live' ? localDateValue(new Date()) : captureDate || localDateValue(new Date()); state.elements.exifStatus.textContent = state.exif ? `${state.exif.hasGps ? `Existing GPS found: ${state.exif.gps.latitude.toFixed(6)}, ${state.exif.gps.longitude.toFixed(6)}.` : 'Existing GPS: not found.'} Original capture date: ${state.exif.dateTimeOriginal || 'unavailable'}.` : 'GPS EXIF inspection and metadata-only output are available for JPEG files. Original capture date: unavailable.'; state.elements.existingActions.hidden = !state.exif?.hasGps; updateAuthenticity(state); state.elements.generate.disabled = !(state.elements.lat.value && state.elements.lon.value); renderPreview(state); setStatus(state, 'Photo ready. Choose or confirm its location.');
    } catch (error) { state.file = null; state.sourceBytes = null; state.sourceCanvas = null; state.elements.photo.hidden = true; state.elements.upload.hidden = false; state.elements.reset.hidden = true; setStatus(state, error.message || 'The photo could not be opened.', true); state.options.onEvent?.('tool_fail', 'invalid_input'); }
  }

  async function startCamera(state) {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus(state, 'Camera capture is unavailable in this browser. Use Upload Photo instead.', true); return; } stopCamera(state); setStatus(state, 'Requesting camera permission…');
    try { state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); if (active !== state) { stopCamera(state); return; } state.elements.video.srcObject = state.stream; state.elements.camera.hidden = false; state.elements.upload.hidden = true; await state.elements.video.play(); setStatus(state, 'Camera ready. Frame the photo, then select Capture Photo.'); }
    catch (_) { stopCamera(state); state.elements.upload.hidden = false; setStatus(state, 'Camera permission was denied or no camera is available. Use Upload Photo instead.', true); }
  }

  async function capturePhoto(state) {
    const video = state.elements.video; if (!state.stream || !video.videoWidth || !video.videoHeight) { setStatus(state, 'The camera is not ready to capture.', true); return; } const captured = canvas(video.videoWidth, video.videoHeight); captured.getContext('2d').drawImage(video, 0, 0); const blob = await canvasBlob(captured, 'image/jpeg', .94); const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg', lastModified: Date.now() }); const requestLocation = state.elements.cameraLocation.checked; await selectPhoto(state, file, 'live'); if (requestLocation) await useCurrentLocation(state);
  }

  async function loadLogo(state, file) {
    if (!file) { state.logoCanvas = null; renderPreview(state); return; }
    try { if (!ACCEPTED_TYPES.has(file.type) || file.size < 1 || file.size > global.GxaGpsPhotoCore.MAX_LOGO_BYTES) throw new Error('Choose a PNG, JPEG, or WebP logo up to 5 MB.'); const bytes = new Uint8Array(await file.arrayBuffer()); if (!isSupportedSignature(bytes)) throw new Error('The logo file signature is not a supported image.'); state.logoCanvas = await decodePhoto(file); renderPreview(state); setStatus(state, 'Logo added to the preview.'); } catch (error) { state.elements.logo.value = ''; state.logoCanvas = null; setStatus(state, error.message, true); }
  }

  async function generate(state) {
    if (!state.sourceCanvas || state.dirtyPoint || state.elements.generate.getAttribute('aria-busy') === 'true') return; global.cancelAnimationFrame(state.previewFrame); renderPreview(state); const revision = state.renderVersion; state.elements.generate.disabled = true; state.elements.generate.setAttribute('aria-busy', 'true'); state.options.onEvent?.('tool_start', 'processing'); setStatus(state, 'Creating the photo output…');
    try {
      const point = coordinates(state); const date = new Date(state.elements.date.value); if (Number.isNaN(date.getTime())) throw new Error('Choose a valid stamp date and time.'); const mode = state.elements.mode.value; let bytes; let blob;
      if (mode === 'metadata') { if (!global.GxaGpsPhotoCore.isJpeg(state.sourceBytes)) throw new Error('GPS metadata-only output requires a JPEG source. Choose a visible stamp for PNG or WebP.'); bytes = global.GxaGpsPhotoCore.insertGps(state.sourceBytes, { ...point, altitude: state.elements.alt.value }, date); blob = new Blob([bytes], { type: 'image/jpeg' }); }
      else { const outputCanvas = canvas(state.sourceCanvas.width, state.sourceCanvas.height); renderStamp(state, outputCanvas); const stamped = await canvasBlob(outputCanvas, mode === 'stamp' ? state.elements.format.value : 'image/jpeg', .92); if (mode === 'both') { bytes = global.GxaGpsPhotoCore.insertGps(new Uint8Array(await stamped.arrayBuffer()), { ...point, altitude: state.elements.alt.value }, date); blob = new Blob([bytes], { type: 'image/jpeg' }); } else blob = stamped; }
      if (mode !== 'stamp') { const parsed = global.GxaGpsPhotoCore.inspectJpeg(new Uint8Array(await blob.arrayBuffer())); if (!parsed.hasGps || Math.abs(parsed.gps.latitude - point.latitude) > .000001 || Math.abs(parsed.gps.longitude - point.longitude) > .000001) throw new Error('The GPS metadata could not be verified after export.'); }
      if (active !== state || revision !== state.renderVersion) { if (active === state) setStatus(state, 'Details changed during export. Create the updated photo again.'); return; }
      revoke(state.resultUrl); state.resultUrl = URL.createObjectURL(blob); state.result = { blob, mode }; state.elements.result.hidden = false; state.elements.resultMeta.textContent = `${mode === 'stamp' ? `Visible stamp ${blob.type === 'image/png' ? 'PNG' : 'JPG'}` : mode === 'metadata' ? 'Original-quality metadata-only JPEG' : 'Visible stamp and verified GPS EXIF'} • ${state.sourceCanvas.width} × ${state.sourceCanvas.height} • ${global.GxaWorkspace.formatBytes(blob.size)}`; global.GxaWorkspace.scrollToResult(state.elements.result, 'nearest'); setStatus(state, 'Output created. Review the privacy notice before downloading.'); state.options.onEvent?.('tool_complete', 'completed'); state.options.onComplete?.(blob.size, blob.type);
    } catch (error) { setStatus(state, error.message || 'The geotagged photo could not be created.', true); state.options.onEvent?.('tool_fail', 'failed'); }
    finally { state.elements.generate.removeAttribute('aria-busy'); state.elements.generate.disabled = !state.sourceCanvas || state.dirtyPoint; }
  }

  async function removeExistingGps(state) {
    if (!state.exif?.hasGps || !global.GxaGpsPhotoCore.isJpeg(state.sourceBytes)) return;
    try { const bytes = global.GxaGpsPhotoCore.removeGps(state.sourceBytes); const blob = new Blob([bytes], { type: 'image/jpeg' }); revoke(state.resultUrl); state.resultUrl = URL.createObjectURL(blob); state.result = { blob, mode: 'removed' }; state.elements.result.hidden = false; state.elements.resultMeta.textContent = `GPS removed • ${global.GxaWorkspace.formatBytes(blob.size)}. To ensure removal, all EXIF blocks were removed; pixel scan data was not recompressed.`; setStatus(state, 'A GPS-cleaned JPEG is ready. Other EXIF data is also removed from this copy.'); state.options.onEvent?.('tool_start', 'removing'); state.options.onEvent?.('tool_complete', 'completed'); state.options.onComplete?.(blob.size); } catch (error) { setStatus(state, error.message, true); state.options.onEvent?.('tool_fail', 'failed'); }
  }

  function reset(state) { stopCamera(state); global.cancelAnimationFrame(state.previewFrame); state.geocodeController?.abort(); state.lookupSeq += 1; clearLocationDetails(state); state.dirtyPoint = false; state.elements.resolved.removeAttribute('aria-busy'); state.elements.loadMap.disabled = true; state.elements.inspect.checked = false; revoke(state.resultUrl); state.resultUrl = ''; state.result = null; state.file = null; state.sourceBytes = null; state.sourceCanvas = null; state.logoCanvas = null; state.exif = null; state.sourceKind = ''; state.location = { latitude: null, longitude: null, accuracy: null, altitude: null, source: '' }; state.elements.file.value = ''; state.elements.logo.value = ''; state.elements.photo.hidden = true; state.elements.result.hidden = true; state.elements.upload.hidden = false; state.elements.reset.hidden = true; state.elements.generate.disabled = true; state.elements.results.replaceChildren(); state.elements.lat.value = ''; state.elements.lon.value = ''; state.elements.alt.value = ''; state.elements.accuracy.value = 'Not reported'; state.elements.date.value = localDateValue(); Object.values(state.elements.fields).forEach(field => { field.value = ''; }); if (state.marker) state.marker.setLatLng([20.5937, 78.9629]); if (state.map) state.map.setView([20.5937, 78.9629], 4); setStatus(state, ''); }

  function mount(root, options = {}) {
    dispose(); root.innerHTML = html; root.setAttribute('aria-busy', 'false'); const pick = selector => root.querySelector(selector); const fields = Object.fromEntries(['place', 'address', 'locality', 'city', 'state', 'postal', 'country', 'company', 'project', 'job', 'employee', 'remarks'].map(key => [key, root.querySelector(`[data-field="${key}"]`)]));
    const state = { root, options, resolved: {}, overrides: new Set(), lookupSeq: 0, mapRequest: 0, dirtyPoint: false, stream: null, map: null, marker: null, resultUrl: '', sourceKind: '', location: { latitude: null, longitude: null, accuracy: null, altitude: null, source: '' }, elements: { choose: pick('.gps-studio__choose'), cameraStart: pick('.gps-studio__camera-start'), file: pick('.gps-studio__file'), upload: pick('.gps-studio__upload'), camera: pick('.gps-studio__camera'), video: pick('video'), cameraLocation: pick('.gps-studio__camera-location'), capture: pick('.gps-studio__capture'), cameraCancel: pick('.gps-studio__camera-cancel'), reset: pick('.gps-studio__reset'), photo: pick('.gps-studio__photo'), fileMeta: pick('.gps-studio__file-meta'), exifStatus: pick('.gps-studio__exif-status'), existingActions: pick('.gps-studio__existing-actions'), useExisting: pick('.gps-studio__use-existing'), removeGps: pick('.gps-studio__remove-gps'), preview: pick('.gps-studio__preview canvas'), authenticity: pick('.gps-studio__authenticity'), current: pick('.gps-studio__current'), search: pick('.gps-studio__search'), searchInput: pick('.gps-studio__search input'), results: pick('.gps-studio__search-results'), lat: pick('.gps-studio__lat'), lon: pick('.gps-studio__lon'), alt: pick('.gps-studio__alt'), accuracy: pick('.gps-studio__accuracy'), applyCoordinates: pick('.gps-studio__apply-coordinates'), lookup: pick('.gps-studio__lookup'), map: pick('.gps-studio__map'), fields, resolved: pick('.gps-studio__resolved'), resolvedTitle: pick('.gps-studio__resolved-title'), resolvedAddress: pick('.gps-studio__resolved-address'), lookupState: pick('.gps-studio__lookup-state'), opacity: pick('.gps-studio__opacity'), opacityValue: pick('.gps-studio__opacity-value'), loadMap: pick('.gps-studio__load-map'), mapStatus: pick('.gps-studio__map-status'), inspect: pick('.gps-studio__inspect'), detail: pick('.gps-studio__detail'), detailCanvas: pick('.gps-studio__detail canvas'), previewWrap: pick('.gps-studio__preview'), templateName: pick('.gps-studio__template-name'), logo: pick('.gps-studio__logo'), template: pick('.gps-studio__template'), mapSize: pick('.gps-studio__map-size'), format: pick('.gps-studio__format'), position: pick('.gps-studio__position'), coordinateFormat: pick('.gps-studio__coordinate-format'), mode: pick('.gps-studio__mode'), date: pick('.gps-studio__date'), mapCard: pick('.gps-studio__map-card'), showAccuracy: pick('.gps-studio__show-accuracy'), privacy: pick('.gps-studio__privacy'), generate: pick('.gps-studio__generate'), status: pick('.gps-studio__status'), result: pick('.gps-studio__result'), resultMeta: pick('.gps-studio__result-meta'), download: pick('.gps-studio__download') } }; active = state; state.elements.date.value = localDateValue();
    state.elements.choose.addEventListener('click', () => state.elements.file.click()); state.elements.upload.addEventListener('click', () => state.elements.file.click()); state.elements.upload.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); state.elements.file.click(); } }); ['dragenter', 'dragover'].forEach(type => state.elements.upload.addEventListener(type, event => { event.preventDefault(); state.elements.upload.classList.add('is-dragging'); })); ['dragleave', 'drop'].forEach(type => state.elements.upload.addEventListener(type, event => { event.preventDefault(); state.elements.upload.classList.remove('is-dragging'); })); state.elements.upload.addEventListener('drop', event => { const file = event.dataTransfer?.files?.[0]; if (file) selectPhoto(state, file); }); state.elements.file.addEventListener('change', () => { const file = state.elements.file.files?.[0]; if (file) selectPhoto(state, file); });
    state.elements.cameraStart.addEventListener('click', () => startCamera(state)); state.elements.cameraCancel.addEventListener('click', () => { stopCamera(state); state.elements.upload.hidden = Boolean(state.sourceCanvas); setStatus(state, 'Camera closed. You can upload a photo instead.'); }); state.elements.capture.addEventListener('click', () => capturePhoto(state)); state.elements.current.addEventListener('click', () => useCurrentLocation(state)); state.elements.search.addEventListener('submit', event => { event.preventDefault(); searchLocation(state, state.elements.searchInput.value); }); state.elements.applyCoordinates.addEventListener('click', () => { try { updatePoint(state, { latitude: state.elements.lat.value, longitude: state.elements.lon.value, altitude: state.elements.alt.value === '' ? null : Number(state.elements.alt.value), source: 'manual' }, { reverse: true }); setStatus(state, 'Coordinates applied. Resolving the location name…'); } catch (error) { setStatus(state, error.message, true); } }); state.elements.lookup.addEventListener('click', () => reverseGeocode(state)); state.elements.useExisting.addEventListener('click', () => { if (state.exif?.gps) { updatePoint(state, { ...state.exif.gps, source: 'existing' }, { reverse: true }); setStatus(state, 'Existing GPS coordinates selected.'); } }); state.elements.removeGps.addEventListener('click', () => removeExistingGps(state)); state.elements.logo.addEventListener('change', () => loadLogo(state, state.elements.logo.files?.[0]));
    Object.entries(fields).forEach(([key, input]) => input.addEventListener('input', () => { state.overrides.add(key); updateLocationSummary(state, 'Manual details updated. Lookup refresh preserves your edits.'); }));
    [state.elements.lat, state.elements.lon].forEach(input => input.addEventListener('input', () => {
      state.dirtyPoint = true; state.geocodeController?.abort(); state.lookupSeq += 1; state.elements.resolved.removeAttribute('aria-busy');
      state.elements.generate.disabled = true; clearLocationDetails(state); state.elements.loadMap.disabled = true; renderPreview(state);
      updateLocationSummary(state, 'Apply coordinates to update the preview and resolve this point.');
    }));
    state.elements.loadMap.addEventListener('click', () => loadStreetMap(state));
    const detailZoom = root.querySelector('.gps-studio__detail-zoom input');
    detailZoom.addEventListener('input', () => {
      state.elements.detail.style.setProperty('--gps-detail-zoom', detailZoom.value + '%');
      root.querySelector('.gps-studio__detail-zoom output').textContent = detailZoom.value + '%';
    });
    [...Object.values(fields), ...root.querySelectorAll('[data-visible]'), state.elements.alt, state.elements.template, state.elements.mapSize, state.elements.format, state.elements.position, state.elements.coordinateFormat, state.elements.mode, state.elements.date, state.elements.mapCard, state.elements.showAccuracy, state.elements.opacity, state.elements.inspect].forEach(element => { element.addEventListener(element.matches('input[type="checkbox"]') || element.tagName === 'SELECT' ? 'change' : 'input', () => schedulePreview(state)); }); state.elements.generate.addEventListener('click', () => generate(state)); state.elements.download.addEventListener('click', () => { if (!state.resultUrl || !state.result) return; const link = document.createElement('a'); link.href = state.resultUrl; link.download = state.result.mode === 'removed' ? 'photo-without-gps.jpg' : state.result.blob.type === 'image/png' ? 'geotagged-photo.png' : 'geotagged-photo.jpg'; link.click(); state.options.onEvent?.('tool_download', 'downloaded'); }); state.elements.reset.addEventListener('click', () => reset(state)); initMap(state); global.lucide?.createIcons();
  }

  function dispose() { if (!active) return; stopCamera(active); global.cancelAnimationFrame(active.previewFrame); active.geocodeController?.abort(); active.mapController?.abort(); revoke(active.resultUrl); active.map?.remove(); active.root?.replaceChildren(); active = null; }
  global.GxaGpsMapCamera = Object.freeze({ mount, dispose });
})(window);
