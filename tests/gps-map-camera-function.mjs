import assert from 'node:assert/strict';
import handler, { normalizeGeoapifyResult } from '../netlify/functions/location-geocode.mjs';

const previousKey = process.env.GEOAPIFY_API_KEY;
const previousFetch = global.fetch;
const request = query => new Request(`https://gxatoolbox.in/api/location-geocode?${query}`, { headers: { Origin: 'https://gxatoolbox.in' } });

try {
  assert.deepEqual(normalizeGeoapifyResult({ lat: 28.61, lon: 77.2, name: 'Site', formatted: 'Site, New Delhi', suburb: 'Area', city: 'New Delhi', state: 'Delhi', postcode: '110001', country: 'India' }), { latitude: 28.61, longitude: 77.2, place: 'Site', address: 'Site, New Delhi', locality: 'Area', city: 'New Delhi', state: 'Delhi', postal: '110001', country: 'India' });
  assert.equal(normalizeGeoapifyResult({ lat: 'bad', lon: 1 }), null);
  delete process.env.GEOAPIFY_API_KEY;
  assert.equal((await handler(request('action=search&q=Delhi'))).status, 503);
  process.env.GEOAPIFY_API_KEY = 'synthetic-test-key';
  assert.equal((await handler(new Request('https://gxatoolbox.in/api/location-geocode', { method: 'POST' }))).status, 405);
  assert.equal((await handler(request('action=search&q=x'))).status, 400);
  assert.equal((await handler(request('action=reverse&lat=91&lon=0'))).status, 400);
  assert.equal((await handler(new Request('https://gxatoolbox.in/api/location-geocode?action=search&q=Delhi', { headers: { Origin: 'https://evil.example' } }))).status, 403);
  let providerUrl = '';
  global.fetch = async url => { providerUrl = String(url); return new Response(JSON.stringify({ results: [{ lat: 28.613939, lon: 77.209021, name: '<Site>', formatted: '<Site>, New Delhi', city: 'New Delhi', state: 'Delhi', postcode: '110001', country: 'India' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const searchResponse = await handler(request('action=search&q=Connaught%20Place'));
  assert.equal(searchResponse.status, 200); const searchBody = await searchResponse.json(); assert.equal(searchBody.results.length, 1); assert.equal(searchBody.results[0].place, '<Site>'); assert.match(providerUrl, /^https:\/\/api\.geoapify\.com\/v1\/geocode\/search\?/); assert.match(providerUrl, /apiKey=synthetic-test-key/); assert.doesNotMatch(JSON.stringify(searchBody), /synthetic-test-key/);
  global.fetch = async () => new Response(JSON.stringify({ results: [{ lat: -33.86882, lon: 151.209296, formatted: 'Sydney NSW, Australia', city: 'Sydney', state: 'New South Wales', country: 'Australia' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const reverseResponse = await handler(request('action=reverse&lat=-33.86882&lon=151.209296')); assert.equal(reverseResponse.status, 200); const reverseBody = await reverseResponse.json(); assert.equal(reverseBody.result.city, 'Sydney');
  global.fetch = async () => new Response('unavailable', { status: 429 });
  const failure = await handler(request('action=search&q=Unique%20offline%20fixture')); assert.equal(failure.status, 503); assert.doesNotMatch(await failure.text(), /429|Provider response|synthetic-test-key/);
} finally {
  global.fetch = previousFetch;
  if (previousKey === undefined) delete process.env.GEOAPIFY_API_KEY; else process.env.GEOAPIFY_API_KEY = previousKey;
}

console.log('Location geocoder function passed: configuration fallback, origin/method/range validation, normalized search/reverse mocks, secret filtering, and sanitized provider failure.');
