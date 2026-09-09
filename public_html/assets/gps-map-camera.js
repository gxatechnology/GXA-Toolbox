(function (global) {
  'use strict';

  let active = null;
  const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const MAX_TEXT = 240;

  const html = `
    <section class="gps-studio" aria-label="GPS Map Camera workspace">
      <div class="gps-studio__notice"><i data-lucide="shield-check" aria-hidden="true"></i><div><strong>Photo processing stays in this browser.</strong><p>The image, EXIF data, logo, coordinates, and professional fields are not sent to GXA Toolbox or analytics. Location search sends only the entered query or selected coordinates to the configured geocoder.</p></div></div>
      <div class="gps-studio__grid">
        <section class="gps-studio__panel" aria-labelledby="gps-photo-heading">
          <div class="gps-studio__panel-head"><div><p class="gps-studio__eyebrow">Photo & preview</p><h2 id="gps-photo-heading">Choose or capture a photo</h2></div><button type="button" class="btn btn-ghost gps-studio__reset" hidden>Start over</button></div>
          <div class="gps-studio__source-actions"><button type="button" class="btn btn-primary gps-studio__choose"><i data-lucide="image-up" aria-hidden="true"></i> Upload Photo</button><button type="button" class="btn btn-secondary gps-studio__camera-start"><i data-lucide="camera" aria-hidden="true"></i> Take Photo</button><input class="gps-studio__file" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden></div>
          <div class="gps-studio__upload" role="button" tabindex="0" aria-label="Choose a JPEG, PNG, or WebP photo"><i data-lucide="map-pinned" aria-hidden="true"></i><strong>Upload an existing photo</strong><span>JPEG, PNG, or WebP up to 30 MB. Drag and drop is optional.</span></div>
          <div class="gps-studio__camera" hidden><video playsinline muted aria-label="Live camera preview"></video><label class="gps-studio__camera-option"><input type="checkbox" class="gps-studio__camera-location" checked><span>Request current device location after I capture</span></label><div class="gps-studio__action-row"><button type="button" class="btn btn-primary gps-studio__capture">Capture Photo</button><button type="button" class="btn btn-ghost gps-studio__camera-cancel">Cancel Camera</button></div></div>
          <div class="gps-studio__photo" hidden>
            <p class="gps-studio__file-meta"></p>
            <div class="gps-studio__exif-box"><strong>Original photo information</strong><p class="gps-studio__exif-status"></p><div class="gps-studio__action-row gps-studio__existing-actions" hidden><button type="button" class="btn btn-secondary gps-studio__use-existing">Use Existing Location</button><button type="button" class="btn btn-ghost gps-studio__remove-gps">Remove Existing GPS</button></div></div>
            <div class="gps-studio__preview"><canvas aria-label="Location-stamped photo preview"></canvas></div>
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
            <label class="gps-studio__field"><span>Place / Site Name</span><input data-field="place" maxlength="120"></label>
            <label class="gps-studio__field"><span>Full Address</span><textarea data-field="address" maxlength="240"></textarea></label>
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
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Template</span><select class="gps-studio__template"><option value="corporate">Corporate</option><option value="compact">Compact</option><option value="map">Map Focus</option></select></label><label class="gps-studio__field"><span>Stamp Position</span><select class="gps-studio__position"><option value="bottom">Bottom</option><option value="top">Top</option></select></label></div>
            <div class="gps-studio__two"><label class="gps-studio__field"><span>Coordinate Format</span><select class="gps-studio__coordinate-format"><option value="decimal">Decimal degrees</option><option value="dms">Degrees, minutes, seconds</option></select></label><label class="gps-studio__field"><span>Output Mode</span><select class="gps-studio__mode"><option value="both" selected>Both stamp + GPS metadata</option><option value="stamp">Visible location stamp</option><option value="metadata">GPS metadata only</option></select></label></div>
            <label class="gps-studio__field"><span>Stamp Date & Time</span><input class="gps-studio__date" type="datetime-local"></label>
            <label class="gps-studio__check"><input class="gps-studio__map-card" type="checkbox" checked><span>Show generated location panel (no third-party map tiles)</span></label>
            <label class="gps-studio__check"><input class="gps-studio__show-accuracy" type="checkbox" checked><span>Show reported GPS accuracy when available</span></label>
            <div class="gps-studio__privacy">This image may contain precise GPS location information. Anyone with access to the file may be able to read that location.</div>
            <button type="button" class="btn btn-primary btn-lg gps-studio__generate" disabled><i data-lucide="map-pin-check" aria-hidden="true"></i> Create Geotagged Photo</button>
            <p class="gps-studio__status" role="status" aria-live="polite">Choose or capture a photo to begin.</p>
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

  function wrapText(context, text, maxWidth, maxLines = 2) {
    const words = cleanText(text).split(' ').filter(Boolean); const lines = [];
    for (const word of words) { const current = lines.at(-1) || ''; const candidate = current ? `${current} ${word}` : word; if (!current || context.measureText(candidate).width <= maxWidth) { if (lines.length) lines[lines.length - 1] = candidate; else lines.push(candidate); } else if (lines.length < maxLines) lines.push(word); }
    if (words.length && lines.length === maxLines) { while (context.measureText(`${lines[maxLines - 1]}…`).width > maxWidth && lines[maxLines - 1].length > 1) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1); }
    return lines.map((line, index) => index === maxLines - 1 && words.join(' ').length > lines.join(' ').length ? `${line}…` : line);
  }

  function stampFields(state) { return Object.fromEntries(Object.entries(state.elements.fields).map(([key, element]) => [key, cleanText(element.value)])); }
  function coordinateLabel(state, latitude, longitude) { const core = global.GxaGpsPhotoCore; return state.elements.coordinateFormat.value === 'dms' ? `${core.formatDms(latitude, 'N', 'S')}  ${core.formatDms(longitude, 'E', 'W')}` : `Lat: ${core.formatDecimal(latitude, 'N', 'S')}   Long: ${core.formatDecimal(longitude, 'E', 'W')}`; }

  function renderStamp(state, target) {
    const context = target.getContext('2d'); context.clearRect(0, 0, target.width, target.height); context.fillStyle = '#fff'; context.fillRect(0, 0, target.width, target.height); context.drawImage(state.sourceCanvas, 0, 0);
    if (state.elements.mode.value === 'metadata') return;
    const { latitude, longitude } = coordinates(state); const fields = stampFields(state); const scale = Math.max(.62, Math.min(2.4, target.width / 1200)); const pad = 22 * scale; const mapWidth = state.elements.mapCard.checked ? Math.min(target.width * .28, 300 * scale) : 0; const template = state.elements.template.value; const line = 25 * scale; const compact = template === 'compact'; const stampHeight = Math.min(target.height * .42, (compact ? 150 : 218) * scale); const top = state.elements.position.value === 'top' ? 0 : target.height - stampHeight;
    const gradient = context.createLinearGradient(0, top, target.width, top + stampHeight); gradient.addColorStop(0, 'rgba(5, 24, 55, .94)'); gradient.addColorStop(1, 'rgba(11, 67, 133, .91)'); context.fillStyle = gradient; context.fillRect(0, top, target.width, stampHeight);
    let textLeft = pad;
    if (mapWidth) {
      const boxX = pad; const boxY = top + pad; const boxH = stampHeight - pad * 2; const boxW = Math.max(92 * scale, mapWidth - pad); context.fillStyle = 'rgba(255,255,255,.12)'; context.fillRect(boxX, boxY, boxW, boxH); context.strokeStyle = 'rgba(255,255,255,.32)'; context.lineWidth = Math.max(1, scale); context.strokeRect(boxX, boxY, boxW, boxH); const cx = boxX + boxW / 2; const cy = boxY + boxH * .38; context.strokeStyle = 'rgba(255,255,255,.36)'; context.beginPath(); context.moveTo(boxX + 12 * scale, cy); context.lineTo(boxX + boxW - 12 * scale, cy); context.moveTo(cx, boxY + 12 * scale); context.lineTo(cx, boxY + boxH - 12 * scale); context.stroke(); context.fillStyle = '#fbbf24'; context.beginPath(); context.arc(cx, cy, 10 * scale, 0, Math.PI * 2); context.fill(); context.fillStyle = '#fff'; context.font = `700 ${Math.max(9, 10 * scale)}px system-ui, sans-serif`; context.textAlign = 'center'; context.fillText('SELECTED LOCATION', cx, boxY + boxH - 25 * scale); context.font = `500 ${Math.max(8, 9 * scale)}px system-ui, sans-serif`; context.fillText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, cx, boxY + boxH - 10 * scale); context.textAlign = 'left'; textLeft = boxX + boxW + pad;
    }
    const logoMaxW = Math.min(160 * scale, target.width * .18); const logoMaxH = 44 * scale; if (state.logoCanvas) { const ratio = Math.min(logoMaxW / state.logoCanvas.width, logoMaxH / state.logoCanvas.height, 1); context.drawImage(state.logoCanvas, target.width - pad - state.logoCanvas.width * ratio, top + pad, state.logoCanvas.width * ratio, state.logoCanvas.height * ratio); }
    const maxWidth = Math.max(100, target.width - textLeft - pad - (state.logoCanvas ? logoMaxW + pad : 0)); let y = top + pad + 17 * scale; context.fillStyle = '#fff'; context.font = `700 ${Math.max(15, 22 * scale)}px system-ui, sans-serif`; const primary = fields.place || fields.company || 'Selected location'; for (const value of wrapText(context, primary, maxWidth, compact ? 1 : 2)) { context.fillText(value, textLeft, y); y += line; }
    const address = fields.address || [fields.locality, fields.city, fields.state, fields.country].filter(Boolean).join(', '); context.fillStyle = 'rgba(255,255,255,.84)'; context.font = `500 ${Math.max(11, 14 * scale)}px system-ui, sans-serif`; for (const value of wrapText(context, address, maxWidth, compact ? 1 : 2)) { context.fillText(value, textLeft, y); y += 19 * scale; }
    context.fillStyle = '#fff'; context.font = `650 ${Math.max(10, 13 * scale)}px ui-monospace, monospace`; context.fillText(coordinateLabel(state, latitude, longitude), textLeft, y); y += 20 * scale;
    const date = new Date(state.elements.date.value); const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); const detail = [dateText, state.elements.showAccuracy.checked && Number.isFinite(state.location.accuracy) ? `Accuracy ${accuracyText(state)}` : '', fields.project, fields.job].filter(Boolean).join(' • '); context.fillStyle = 'rgba(255,255,255,.82)'; context.font = `500 ${Math.max(9, 12 * scale)}px system-ui, sans-serif`; for (const value of wrapText(context, detail, target.width - textLeft - pad, 2)) { if (y < top + stampHeight - 7 * scale) context.fillText(value, textLeft, y); y += 17 * scale; }
    const finalText = [fields.employee, fields.remarks].filter(Boolean).join(' • '); if (finalText && y < top + stampHeight - 7 * scale) { context.fillStyle = 'rgba(255,255,255,.72)'; for (const value of wrapText(context, finalText, target.width - textLeft - pad, 1)) context.fillText(value, textLeft, y); }
  }

  function renderPreview(state) {
    if (!state.sourceCanvas) return;
    if (state.result) { revoke(state.resultUrl); state.resultUrl = ''; state.result = null; state.elements.result.hidden = true; }
    const previewContext = state.elements.preview.getContext('2d'); previewContext.clearRect(0, 0, state.elements.preview.width, state.elements.preview.height); previewContext.drawImage(state.sourceCanvas, 0, 0);
    if (state.elements.lat.value !== '' && state.elements.lon.value !== '') {
      try { renderStamp(state, state.elements.preview); setStatus(state, 'Preview updated. Confirm the details before creating the output.'); } catch (error) { setStatus(state, error.message, true); }
    }
    state.elements.privacy.hidden = state.elements.mode.value === 'stamp';
  }

  function applyAddress(state, item) {
    const map = { place: item.place, address: item.address, locality: item.locality, city: item.city, state: item.state, postal: item.postal, country: item.country };
    for (const [key, value] of Object.entries(map)) if (value) state.elements.fields[key].value = cleanText(value, key === 'address' ? 240 : 120);
  }

  async function geocode(state, action, parameters) {
    const query = new URLSearchParams({ action, ...parameters }); const controller = new AbortController(); state.geocodeController?.abort(); state.geocodeController = controller;
    const timeout = global.setTimeout(() => controller.abort(), 8000);
    try { const response = await fetch(`/api/location-geocode?${query}`, { headers: { Accept: 'application/json' }, signal: controller.signal }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || 'Location lookup is unavailable.'); return body; }
    finally { global.clearTimeout(timeout); if (state.geocodeController === controller) state.geocodeController = null; }
  }

  async function reverseGeocode(state) {
    try { const point = coordinates(state); setStatus(state, 'Looking up this location…'); const body = await geocode(state, 'reverse', { lat: String(point.latitude), lon: String(point.longitude) }); if (body.result) applyAddress(state, body.result); renderPreview(state); setStatus(state, body.result ? 'Address found. Review and correct it if necessary.' : 'No address was returned for this point. You can enter one manually.'); }
    catch (error) { setStatus(state, error.name === 'AbortError' ? 'Location lookup timed out. Coordinates remain selected.' : error.message, true); }
  }

  function updatePoint(state, location, { moveMap = true, zoom = 16, reverse = false } = {}) {
    const point = global.GxaGpsPhotoCore.validateCoordinates(location.latitude, location.longitude); state.location = { latitude: point.latitude, longitude: point.longitude, accuracy: Number.isFinite(location.accuracy) ? Number(location.accuracy) : null, altitude: Number.isFinite(location.altitude) ? Number(location.altitude) : null, source: location.source || 'manual' }; state.elements.lat.value = point.latitude.toFixed(6); state.elements.lon.value = point.longitude.toFixed(6); state.elements.alt.value = state.location.altitude ?? ''; state.elements.accuracy.value = accuracyText(state); if (state.marker) state.marker.setLatLng([point.latitude, point.longitude]); if (moveMap && state.map) state.map.setView([point.latitude, point.longitude], zoom); state.elements.generate.disabled = !state.sourceCanvas; updateAuthenticity(state); renderPreview(state); if (reverse) reverseGeocode(state); }

  async function searchLocation(state, query) {
    const value = cleanText(query, 160); state.elements.results.replaceChildren(); if (value.length < 2) { setStatus(state, 'Enter at least two characters to search.', true); return; }
    try { setStatus(state, 'Searching for locations…'); const body = await geocode(state, 'search', { q: value }); const results = Array.isArray(body.results) ? body.results.slice(0, 5) : [];
      for (const item of results) { const li = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.className = 'gps-studio__search-result'; button.textContent = item.address || item.place || `${item.latitude}, ${item.longitude}`; button.addEventListener('click', () => { applyAddress(state, item); updatePoint(state, { latitude: item.latitude, longitude: item.longitude, source: 'search' }); state.elements.results.replaceChildren(); setStatus(state, 'Search result selected. Review the marker and address.'); }); li.appendChild(button); state.elements.results.appendChild(li); }
      setStatus(state, results.length ? 'Select a search result.' : 'No matching location was returned. Try a broader query or use coordinates.', !results.length);
    } catch (error) { setStatus(state, error.name === 'AbortError' ? 'Location search timed out.' : error.message, true); }
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
  function useCurrentLocation(state) { if (!('geolocation' in navigator)) { setStatus(state, 'This browser does not provide the Geolocation API. Enter coordinates or use the map.', true); return Promise.resolve(false); } state.elements.current.disabled = true; setStatus(state, 'Waiting for device location…'); return new Promise(resolve => navigator.geolocation.getCurrentPosition(position => { state.elements.current.disabled = false; updatePoint(state, { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, altitude: position.coords.altitude, source: 'current' }, { reverse: true }); setStatus(state, `Current location received with reported accuracy ${accuracyText(state)}.`); resolve(true); }, error => { state.elements.current.disabled = false; setStatus(state, geolocationMessage(error), true); resolve(false); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })); }

  async function selectPhoto(state, file, sourceKind = 'upload') {
    stopCamera(state); revoke(state.resultUrl); state.resultUrl = ''; state.result = null; state.elements.result.hidden = true; state.elements.generate.disabled = true; setStatus(state, 'Validating and decoding the photo…');
    try {
      if (!file || !ACCEPTED_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.'); if (file.size < 1 || file.size > global.GxaGpsPhotoCore.MAX_IMAGE_BYTES) throw new Error('Choose a photo between 1 byte and 30 MB.'); const bytes = new Uint8Array(await file.arrayBuffer()); if (!isSupportedSignature(bytes)) throw new Error('The file signature does not match a supported JPEG, PNG, or WebP image.'); const decoded = await decodePhoto(file);
      state.file = file; state.sourceBytes = bytes; state.sourceCanvas = decoded; state.sourceKind = sourceKind; state.exif = null; if (global.GxaGpsPhotoCore.isJpeg(bytes)) state.exif = global.GxaGpsPhotoCore.inspectJpeg(bytes); state.elements.preview.width = decoded.width; state.elements.preview.height = decoded.height; state.elements.photo.hidden = false; state.elements.upload.hidden = true; state.elements.reset.hidden = false; state.elements.fileMeta.textContent = `${sourceKind === 'live' ? 'Live camera capture' : cleanText(file.name, 180)} • ${decoded.width} × ${decoded.height} • ${global.GxaWorkspace.formatBytes(file.size)}`;
      const captureDate = state.exif?.dateTimeOriginal ? parsedExifDate(state.exif.dateTimeOriginal) : ''; state.elements.date.value = sourceKind === 'live' ? localDateValue(new Date()) : captureDate || localDateValue(new Date()); state.elements.exifStatus.textContent = state.exif ? `${state.exif.hasGps ? `Existing GPS found: ${state.exif.gps.latitude.toFixed(6)}, ${state.exif.gps.longitude.toFixed(6)}.` : 'Existing GPS: not found.'} Original capture date: ${state.exif.dateTimeOriginal || 'unavailable'}.` : 'GPS EXIF inspection and metadata-only output are available for JPEG files. Original capture date: unavailable.'; state.elements.existingActions.hidden = !state.exif?.hasGps; updateAuthenticity(state); state.elements.generate.disabled = !(state.elements.lat.value && state.elements.lon.value); renderPreview(state); setStatus(state, 'Photo ready. Choose or confirm its location.');
    } catch (error) { state.file = null; state.sourceBytes = null; state.sourceCanvas = null; state.elements.photo.hidden = true; state.elements.upload.hidden = false; state.elements.reset.hidden = true; setStatus(state, error.message || 'The photo could not be opened.', true); state.options.onEvent?.('tool_fail', 'invalid_input'); }
  }

  async function startCamera(state) {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus(state, 'Camera capture is unavailable in this browser. Use Upload Photo instead.', true); return; } stopCamera(state); setStatus(state, 'Requesting camera permission…');
    try { state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); state.elements.video.srcObject = state.stream; state.elements.camera.hidden = false; state.elements.upload.hidden = true; await state.elements.video.play(); setStatus(state, 'Camera ready. Frame the photo, then select Capture Photo.'); }
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
    if (!state.sourceCanvas) return; state.elements.generate.disabled = true; state.elements.generate.setAttribute('aria-busy', 'true'); state.options.onEvent?.('tool_start', 'processing'); setStatus(state, 'Creating the photo output…');
    try {
      const point = coordinates(state); const date = new Date(state.elements.date.value); if (Number.isNaN(date.getTime())) throw new Error('Choose a valid stamp date and time.'); const mode = state.elements.mode.value; let bytes; let blob;
      if (mode === 'metadata') { if (!global.GxaGpsPhotoCore.isJpeg(state.sourceBytes)) throw new Error('GPS metadata-only output requires a JPEG source. Choose a visible stamp for PNG or WebP.'); bytes = global.GxaGpsPhotoCore.insertGps(state.sourceBytes, { ...point, altitude: state.elements.alt.value }, date); blob = new Blob([bytes], { type: 'image/jpeg' }); }
      else { const outputCanvas = canvas(state.sourceCanvas.width, state.sourceCanvas.height); renderStamp(state, outputCanvas); const stamped = await canvasBlob(outputCanvas, 'image/jpeg', .92); if (mode === 'both') { bytes = global.GxaGpsPhotoCore.insertGps(new Uint8Array(await stamped.arrayBuffer()), { ...point, altitude: state.elements.alt.value }, date); blob = new Blob([bytes], { type: 'image/jpeg' }); } else blob = stamped; }
      if (mode !== 'stamp') { const parsed = global.GxaGpsPhotoCore.inspectJpeg(new Uint8Array(await blob.arrayBuffer())); if (!parsed.hasGps || Math.abs(parsed.gps.latitude - point.latitude) > .000001 || Math.abs(parsed.gps.longitude - point.longitude) > .000001) throw new Error('The GPS metadata could not be verified after export.'); }
      revoke(state.resultUrl); state.resultUrl = URL.createObjectURL(blob); state.result = { blob, mode }; state.elements.result.hidden = false; state.elements.resultMeta.textContent = `${mode === 'stamp' ? 'Visible stamp' : mode === 'metadata' ? 'Original-quality metadata-only JPEG' : 'Visible stamp and verified GPS EXIF'} • ${state.sourceCanvas.width} × ${state.sourceCanvas.height} • ${global.GxaWorkspace.formatBytes(blob.size)}`; global.GxaWorkspace.scrollToResult(state.elements.result, 'nearest'); setStatus(state, 'Output created. Review the privacy notice before downloading.'); state.options.onEvent?.('tool_complete', 'completed'); state.options.onComplete?.(blob.size);
    } catch (error) { setStatus(state, error.message || 'The geotagged photo could not be created.', true); state.options.onEvent?.('tool_fail', 'failed'); }
    finally { state.elements.generate.removeAttribute('aria-busy'); state.elements.generate.disabled = !state.sourceCanvas; }
  }

  async function removeExistingGps(state) {
    if (!state.exif?.hasGps || !global.GxaGpsPhotoCore.isJpeg(state.sourceBytes)) return;
    try { const bytes = global.GxaGpsPhotoCore.removeGps(state.sourceBytes); const blob = new Blob([bytes], { type: 'image/jpeg' }); revoke(state.resultUrl); state.resultUrl = URL.createObjectURL(blob); state.result = { blob, mode: 'removed' }; state.elements.result.hidden = false; state.elements.resultMeta.textContent = `GPS removed • ${global.GxaWorkspace.formatBytes(blob.size)}. To ensure removal, all EXIF blocks were removed; pixel scan data was not recompressed.`; setStatus(state, 'A GPS-cleaned JPEG is ready. Other EXIF data is also removed from this copy.'); state.options.onEvent?.('tool_start', 'removing'); state.options.onEvent?.('tool_complete', 'completed'); state.options.onComplete?.(blob.size); } catch (error) { setStatus(state, error.message, true); state.options.onEvent?.('tool_fail', 'failed'); }
  }

  function reset(state) { stopCamera(state); state.geocodeController?.abort(); revoke(state.resultUrl); state.resultUrl = ''; state.result = null; state.file = null; state.sourceBytes = null; state.sourceCanvas = null; state.logoCanvas = null; state.exif = null; state.sourceKind = ''; state.location = { latitude: null, longitude: null, accuracy: null, altitude: null, source: '' }; state.elements.file.value = ''; state.elements.logo.value = ''; state.elements.photo.hidden = true; state.elements.result.hidden = true; state.elements.upload.hidden = false; state.elements.reset.hidden = true; state.elements.generate.disabled = true; state.elements.results.replaceChildren(); state.elements.lat.value = ''; state.elements.lon.value = ''; state.elements.alt.value = ''; state.elements.accuracy.value = 'Not reported'; state.elements.date.value = localDateValue(); Object.values(state.elements.fields).forEach(field => { field.value = ''; }); if (state.marker) state.marker.setLatLng([20.5937, 78.9629]); if (state.map) state.map.setView([20.5937, 78.9629], 4); setStatus(state, 'Choose or capture a photo to begin.'); }

  function mount(root, options = {}) {
    dispose(); root.innerHTML = html; root.setAttribute('aria-busy', 'false'); const pick = selector => root.querySelector(selector); const fields = Object.fromEntries(['place', 'address', 'locality', 'city', 'state', 'postal', 'country', 'company', 'project', 'job', 'employee', 'remarks'].map(key => [key, root.querySelector(`[data-field="${key}"]`)]));
    const state = { root, options, stream: null, map: null, marker: null, resultUrl: '', sourceKind: '', location: { latitude: null, longitude: null, accuracy: null, altitude: null, source: '' }, elements: { choose: pick('.gps-studio__choose'), cameraStart: pick('.gps-studio__camera-start'), file: pick('.gps-studio__file'), upload: pick('.gps-studio__upload'), camera: pick('.gps-studio__camera'), video: pick('video'), cameraLocation: pick('.gps-studio__camera-location'), capture: pick('.gps-studio__capture'), cameraCancel: pick('.gps-studio__camera-cancel'), reset: pick('.gps-studio__reset'), photo: pick('.gps-studio__photo'), fileMeta: pick('.gps-studio__file-meta'), exifStatus: pick('.gps-studio__exif-status'), existingActions: pick('.gps-studio__existing-actions'), useExisting: pick('.gps-studio__use-existing'), removeGps: pick('.gps-studio__remove-gps'), preview: pick('.gps-studio__preview canvas'), authenticity: pick('.gps-studio__authenticity'), current: pick('.gps-studio__current'), search: pick('.gps-studio__search'), searchInput: pick('.gps-studio__search input'), results: pick('.gps-studio__search-results'), lat: pick('.gps-studio__lat'), lon: pick('.gps-studio__lon'), alt: pick('.gps-studio__alt'), accuracy: pick('.gps-studio__accuracy'), applyCoordinates: pick('.gps-studio__apply-coordinates'), lookup: pick('.gps-studio__lookup'), map: pick('.gps-studio__map'), fields, logo: pick('.gps-studio__logo'), template: pick('.gps-studio__template'), position: pick('.gps-studio__position'), coordinateFormat: pick('.gps-studio__coordinate-format'), mode: pick('.gps-studio__mode'), date: pick('.gps-studio__date'), mapCard: pick('.gps-studio__map-card'), showAccuracy: pick('.gps-studio__show-accuracy'), privacy: pick('.gps-studio__privacy'), generate: pick('.gps-studio__generate'), status: pick('.gps-studio__status'), result: pick('.gps-studio__result'), resultMeta: pick('.gps-studio__result-meta'), download: pick('.gps-studio__download') } }; active = state; state.elements.date.value = localDateValue();
    state.elements.choose.addEventListener('click', () => state.elements.file.click()); state.elements.upload.addEventListener('click', () => state.elements.file.click()); state.elements.upload.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); state.elements.file.click(); } }); ['dragenter', 'dragover'].forEach(type => state.elements.upload.addEventListener(type, event => { event.preventDefault(); state.elements.upload.classList.add('is-dragging'); })); ['dragleave', 'drop'].forEach(type => state.elements.upload.addEventListener(type, event => { event.preventDefault(); state.elements.upload.classList.remove('is-dragging'); })); state.elements.upload.addEventListener('drop', event => { const file = event.dataTransfer?.files?.[0]; if (file) selectPhoto(state, file); }); state.elements.file.addEventListener('change', () => { const file = state.elements.file.files?.[0]; if (file) selectPhoto(state, file); });
    state.elements.cameraStart.addEventListener('click', () => startCamera(state)); state.elements.cameraCancel.addEventListener('click', () => { stopCamera(state); state.elements.upload.hidden = Boolean(state.sourceCanvas); setStatus(state, 'Camera closed. You can upload a photo instead.'); }); state.elements.capture.addEventListener('click', () => capturePhoto(state)); state.elements.current.addEventListener('click', () => useCurrentLocation(state)); state.elements.search.addEventListener('submit', event => { event.preventDefault(); searchLocation(state, state.elements.searchInput.value); }); state.elements.applyCoordinates.addEventListener('click', () => { try { updatePoint(state, { latitude: state.elements.lat.value, longitude: state.elements.lon.value, altitude: state.elements.alt.value === '' ? null : Number(state.elements.alt.value), source: 'manual' }); setStatus(state, 'Coordinates applied. Use Find Address if you want an address lookup.'); } catch (error) { setStatus(state, error.message, true); } }); state.elements.lookup.addEventListener('click', () => reverseGeocode(state)); state.elements.useExisting.addEventListener('click', () => { if (state.exif?.gps) { applyAddress(state, {}); updatePoint(state, { ...state.exif.gps, source: 'existing' }); setStatus(state, 'Existing GPS coordinates selected.'); } }); state.elements.removeGps.addEventListener('click', () => removeExistingGps(state)); state.elements.logo.addEventListener('change', () => loadLogo(state, state.elements.logo.files?.[0]));
    [...Object.values(fields), state.elements.template, state.elements.position, state.elements.coordinateFormat, state.elements.mode, state.elements.date, state.elements.mapCard, state.elements.showAccuracy].forEach(element => { element.addEventListener(element.matches('input[type="checkbox"]') || element.tagName === 'SELECT' ? 'change' : 'input', () => renderPreview(state)); }); state.elements.generate.addEventListener('click', () => generate(state)); state.elements.download.addEventListener('click', () => { if (!state.resultUrl || !state.result) return; const link = document.createElement('a'); link.href = state.resultUrl; link.download = state.result.mode === 'removed' ? 'photo-without-gps.jpg' : 'geotagged-photo.jpg'; link.click(); state.options.onEvent?.('tool_download', 'downloaded'); }); state.elements.reset.addEventListener('click', () => reset(state)); initMap(state); global.lucide?.createIcons();
  }

  function dispose() { if (!active) return; stopCamera(active); active.geocodeController?.abort(); revoke(active.resultUrl); active.map?.remove(); active.root?.replaceChildren(); active = null; }
  global.GxaGpsMapCamera = Object.freeze({ mount, dispose });
})(window);
