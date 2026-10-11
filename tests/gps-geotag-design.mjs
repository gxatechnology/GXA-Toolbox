import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import geo from '../public_html/assets/gps-geo-model.js';
import mapHandler from '../netlify/functions/location-map.mjs';

const place = geo.normalizeGeocodeResult({ suburb: 'Palika Nagar', city: 'Agra', state: 'Uttar Pradesh', housenumber: '12/P-30F', street: 'Park Road', postcode: '282006', country: 'India', timezone: { name: 'Asia/Kolkata' } });
assert.equal(geo.buildLocationTitle(place), 'Palika Nagar, Agra');
assert.equal(geo.buildReadableAddress(place), '12/P-30F Park Road, Palika Nagar, Agra, Uttar Pradesh 282006, India');
assert.equal(geo.buildReadableAddress({ formatted: '  Agra, , Agra, undefined, Uttar Pradesh, null, India, India ' }), 'Agra, Uttar Pradesh, India');
assert.equal(geo.buildLocationTitle({ city: 'Agra', state: 'Agra' }), 'Agra');
assert.equal(geo.buildLocationTitle({ name: 'Agra, India', city: 'Agra' }), 'Agra, India');
assert.equal(geo.buildLocationTitle({}), 'Location name unavailable');
assert.equal(geo.buildLocationTitle(place, 'मेरा स्थल'), 'मेरा स्थल');
assert.equal(geo.buildReadableAddress(place, 'Manual street, 5'), 'Manual street, 5');
assert.equal(geo.buildReadableAddress({ address: { house_number: '4', road: 'Rue du Test', city: 'Paris' } }), '4 Rue du Test, Paris');
assert.equal(geo.normalizeGeocodeResult({ properties: { name: 'Test', timezone: { name: 'Europe/Paris' } } }).timezone, 'Europe/Paris');
const data = geo.buildGeoMetadataModel({ location: { latitude: 0, longitude: 0, altitude: 0, speed: 0, heading: 0, accuracy: 0, source: 'current' }, date: '2026-09-22T14:35', fields: place, visible: { country: false } });
assert.equal(data.latitude, 0); assert.equal(data.longitude, 0);
for (const key of ['altitude', 'speed', 'heading', 'accuracy']) assert(data.metadata.some(item => item.key === key && item.value.startsWith('0')));
assert(!data.metadata.some(item => item.key === 'country'));
assert.equal(geo.buildGeoMetadataModel({ location: { latitude: '', longitude: null } }).latitude, null);
const empty = geo.buildExportOverlayModel({ location: { latitude: -33.86882, longitude: 151.209296 }, date: 'invalid', fields: { place: null, address: undefined } });
assert.equal(empty.title, 'Location name unavailable'); assert.match(empty.address, /Coordinates|coordinates/); assert(!/undefined|null|NaN/.test(JSON.stringify(empty)));
assert(!empty.metadata.some(item => ['speed','accuracy','heading','altitude'].includes(item.key)));
assert.match(geo.buildGeoMetadataModel({ location: { latitude: -89.99999999, longitude: 180 }, coordinateFormat: 'dms' }).latitudeText, /^90°0′0.00″ S$/);
for (const template of ['classic','field','travel']) assert.equal(geo.buildExportOverlayModel({ template }).template, template);
assert.equal(geo.buildExportOverlayModel().mapSize, 'small');
assert.equal(geo.buildExportOverlayModel({mapSize: 'invalid'}).mapSize, 'small');
for (const mapSize of ['small','medium','large']) assert.equal(geo.buildExportOverlayModel({mapSize}).mapSize, mapSize);
assert.equal(geo.buildExportOverlayModel().opacity, .84);
assert.equal(geo.buildExportOverlayModel({opacity: .78}).opacity, .78);
assert.equal(geo.buildExportOverlayModel({opacity: 1}).opacity, 1);

const oldKey = process.env.GEOAPIFY_API_KEY, oldFetch = global.fetch;
const request = (point = { latitude: 27.18, longitude: 78.02 }, origin = 'https://gxatoolbox.in') => new Request('https://gxatoolbox.in/api/location-map', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(point) });
try {
  delete process.env.GEOAPIFY_API_KEY;
  assert.equal((await mapHandler(request())).status, 503);
  assert.equal((await mapHandler(new Request('https://gxatoolbox.in/api/location-map'))).status, 405);
  assert.equal((await mapHandler(request({}, 'https://evil.example'))).status, 403);
  for (const latitude of [null, '', 86, -91]) assert.equal((await mapHandler(request({ latitude, longitude: 0 }))).status, 400);
  assert.equal((await mapHandler(request({ latitude: 0, longitude: 181 }))).status, 400);
  process.env.GEOAPIFY_API_KEY = 'local-contract-placeholder';
  const bytes = new Uint8Array(24); bytes.set([137,80,78,71,13,10,26,10]); new DataView(bytes.buffer).setUint32(16,640); new DataView(bytes.buffer).setUint32(20,480);
  let upstream;
  global.fetch = async (url, options) => { upstream = new URL(url); assert.equal(options.redirect, 'error'); return new Response(bytes, { headers: { 'Content-Type': 'image/png' } }); };
  const response = await mapHandler(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(upstream.origin, 'https://maps.geoapify.com'); assert.equal(upstream.searchParams.get('center'), 'lonlat:78.020000,27.180000');
  assert.equal(upstream.searchParams.get('attribution'), 'default'); assert.equal(upstream.searchParams.get('style'), 'osm-carto');
  assert.equal(upstream.searchParams.has('marker'), false, 'Custom pin is drawn locally; no unlicensed icon dependency');
  for (const mock of [() => new Response('quota', {status:429}), () => new Response('<html>error</html>', {headers:{'Content-Type':'image/png'}}), () => new Response(bytes, {headers:{'Content-Type':'image/png','Content-Length':'3000000'}})]) {
    global.fetch = async () => mock(); const failure = await mapHandler(request()); assert.equal(failure.status, 503); assert.doesNotMatch(await failure.text(), /local-contract-placeholder|stack|quota/);
  }
} finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.GEOAPIFY_API_KEY; else process.env.GEOAPIFY_API_KEY = oldKey; }
for (const file of ['gps-geo-model.js', 'gps-export-renderer.js']) {
  const source = await readFile(new URL('../public_html/assets/' + file, import.meta.url), 'utf8');
  assert.equal(await readFile(new URL('../dist/assets/' + file, import.meta.url), 'utf8'), source);
}
console.log('Geotag design contracts passed: normalization, complete addresses, manual overrides, missing/zero values, templates, secret-safe static-map validation and fallback.');
