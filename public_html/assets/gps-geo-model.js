/* Pure, shared location normalization. No provider calls, persistence or photo data. */
(function (root) {
  'use strict';
  const clean = (value, limit = 480) => typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\s+/g, ' ').trim().replace(/^(?:undefined|null|nan)$/i, '').slice(0, limit) : '';
  const unique = values => {
    const seen = new Set();
    return values.map(value => clean(value)).filter(value => {
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key); return true;
    });
  };
  const address = value => unique(clean(value).split(/[,\n]+/)).join(', ');
  function normalizeGeocodeResult(input = {}) {
    const item = input?.properties || input || {};
    const nested = item.address && typeof item.address === 'object' ? item.address : {};
    const first = (...values) => values.map(value => clean(value)).find(Boolean) || '';
    return {
      place: first(item.place, item.name, nested.name),
      address: address(first(typeof item.address === 'string' ? item.address : '', item.formatted, item.display_name,
        unique([item.address_line1, item.address_line2]).join(', '))),
      house: first(item.house, item.housenumber, item.house_number, nested.house_number),
      street: first(item.street, item.road, nested.road),
      locality: first(item.locality, item.neighbourhood, item.neighborhood, item.suburb, item.quarter, item.district,
        nested.neighbourhood, nested.suburb, nested.quarter),
      city: first(item.city, item.town, item.village, item.municipality, nested.city, nested.town, nested.village),
      state: first(item.state, nested.state), postal: first(item.postal, item.postcode, nested.postcode),
      country: first(item.country, nested.country),
      timezone: first(typeof item.timezone === 'string' ? item.timezone : item.timezone?.name),
      plusCode: first(item.plusCode, item.plus_code?.global_code, typeof item.plus_code === 'string' ? item.plus_code : '')
    };
  }
  function buildLocationTitle(input, override = '') {
    if (clean(override)) return clean(override, 160);
    const place = normalizeGeocodeResult(input);
    const primary = place.place || place.locality || place.city || place.state || place.country;
    const secondary = primary === place.city ? place.state : place.city;
    return unique([primary, secondary].flatMap(value => clean(value).split(','))).join(', ') || 'Location name unavailable';
  }
  function buildReadableAddress(input, override = '') {
    if (clean(override)) return address(override);
    const place = normalizeGeocodeResult(input);
    return place.address || unique([unique([place.house, place.street]).join(' '), place.locality, place.city,
      unique([place.state, place.postal]).join(' '), place.country]).join(', ');
  }
  function number(value, minimum, maximum) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : null;
  }
  function buildGeoMetadataModel({ location = {}, fields = {}, date, sourceKind = '', coordinateFormat = 'decimal', visible = {} } = {}) {
    const latitude = number(location.latitude, -90, 90), longitude = number(location.longitude, -180, 180);
    const timestamp = date ? new Date(date) : null;
    const validDate = timestamp && !Number.isNaN(timestamp.getTime());
    const dms = (n, positive, negative) => {
      const total = Math.round(Math.abs(n) * 360000), deg = Math.floor(total / 360000), min = Math.floor(total % 360000 / 6000), sec = total % 6000 / 100;
      return `${deg}°${min}′${sec.toFixed(2)}″ ${n < 0 ? negative : positive}`;
    };
    const coord = (n, p, m) => n === null ? 'Not selected' : coordinateFormat === 'dms' ? dms(n, p, m) : `${Math.abs(n).toFixed(6)}° ${n < 0 ? m : p}`;
    const metadata = [];
    const add = (key, label, value, suffix = '') => { if (value !== null && value !== '' && visible[key] !== false) metadata.push({ key, label, value: `${value}${suffix}` }); };
    add('altitude', 'Altitude', number(location.altitude, -20000, 20000), ' m');
    add('accuracy', 'Accuracy', number(location.accuracy, 0, 10000000), ' m');
    const speed = number(location.speed, 0, 2000);
    add('speed', 'Speed', speed === null ? null : Number((speed * 3.6).toFixed(1)), ' km/h');
    add('heading', 'Heading', number(location.heading, 0, 360), '°');
    add('postal', 'Postal code', clean(fields.postal, 30));
    add('country', 'Country', clean(fields.country, 100));
    add('timezone', 'Location zone', clean(fields.timezone, 100));
    add('plusCode', 'Plus code', clean(fields.plusCode, 100));
    const sources = { current: 'Device location', manual: 'Manual coordinates', map: 'Map selection', search: 'Search selection', existing: 'Original photo GPS' };
    const source = sources[location.source] || 'User-selected location';
    add('source', 'Source', source);
    // datetime-local describes the browser's clock, not necessarily the selected location's timezone.
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Device local time';
    return { latitude, longitude, latitudeText: coord(latitude, 'N', 'S'), longitudeText: coord(longitude, 'E', 'W'),
      date: validDate ? timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date not set',
      time: validDate ? timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Time not set',
      browserZone, source, metadata, captureLabel: sourceKind === 'live' ? 'Captured on' : 'Photo / stamp time' };
  }
  function buildExportOverlayModel(options = {}) {
    const fields = options.fields || {}, resolved = normalizeGeocodeResult(fields);
    const templates = { classic: 'Geo Card Classic', field: 'Field Proof Layout', travel: 'Travel Stamp Layout', corporate: 'Field Proof Layout', compact: 'Geo Card Classic', map: 'Travel Stamp Layout' };
    const template = ({ corporate: 'field', compact: 'classic', map: 'travel' })[options.template] || options.template || 'classic';
    return { ...buildGeoMetadataModel(options), title: buildLocationTitle(resolved, fields.place),
      address: buildReadableAddress(resolved, fields.address) || 'Address unavailable · coordinates retained',
      template, templateLabel: templates[template] || templates.classic,
      opacity: Math.max(.78, Math.min(1, Number(options.opacity) || .84)), position: options.position === 'top' ? 'top' : 'bottom',
      mapSize: ['small', 'medium', 'large'].includes(options.mapSize) ? options.mapSize : 'small',
      showMap: options.showMap !== false,
      professional: ['company', 'project', 'job', 'employee', 'remarks'].map(key => ({ key, value: clean(fields[key], 240) })).filter(item => item.value),
      disclaimer: 'User-selected location · not independently verified' };
  }
  const api = Object.freeze({ clean, normalizeGeocodeResult, buildLocationTitle, buildReadableAddress, buildGeoMetadataModel, buildExportOverlayModel });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GxaGeoModel = api;
})(typeof window === 'undefined' ? globalThis : window);
