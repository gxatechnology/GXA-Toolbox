import { assertSameOrigin, jsonResponse, methodNotAllowed } from './_auth.mjs';
import geoModel from '../../public_html/assets/gps-geo-model.js';

const MAX_QUERY_LENGTH = 160;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function coordinate(value, minimum, maximum, label) {
  const number = Number(value);
  if (value === null || String(value).trim() === '' || !Number.isFinite(number) || number < minimum || number > maximum) {
    const error = new Error(`${label} is outside its valid range.`);
    error.status = 400;
    throw error;
  }
  return number;
}

function clean(value, maximum = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

export function normalizeGeoapifyResult(item) {
  if ([item?.lat, item?.lon].some(value => value === null || value === undefined || String(value).trim() === '')) return null;
  const latitude = Number(item?.lat);
  const longitude = Number(item?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const normalized = geoModel.normalizeGeocodeResult(item);
  return {
    latitude,
    longitude,
    ...normalized,
    address: geoModel.buildReadableAddress(normalized)
  };
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.createdAt > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.value;
}

async function providerRequest(parameters, apiKey) {
  const endpoint = parameters.get('text') ? 'search' : 'reverse';
  parameters.set('apiKey', apiKey);
  parameters.set('format', 'json');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`https://api.geoapify.com/v1/geocode/${endpoint}?${parameters}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Provider response ${response.status}`);
    const body = await response.json();
    return Array.isArray(body.results) ? body.results.map(normalizeGeoapifyResult).filter(Boolean) : [];
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    assertSameOrigin(request);
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) return jsonResponse({ success: false, message: 'Location search is not configured. Use current location, the map, or manual coordinates.' }, 503);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    let parameters;
    let cacheKey;
    if (action === 'search') {
      const query = clean(url.searchParams.get('q'), MAX_QUERY_LENGTH);
      if (query.length < 2) return jsonResponse({ success: false, message: 'Enter at least two characters to search.' }, 400);
      parameters = new URLSearchParams({ text: query, limit: '5', lang: 'en' });
      cacheKey = `search:${query.toLocaleLowerCase('en')}`;
    } else if (action === 'reverse') {
      const latitude = coordinate(url.searchParams.get('lat'), -90, 90, 'Latitude');
      const longitude = coordinate(url.searchParams.get('lon'), -180, 180, 'Longitude');
      parameters = new URLSearchParams({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), limit: '1', lang: 'en' });
      cacheKey = `reverse:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    } else return jsonResponse({ success: false, message: 'Choose a supported location lookup action.' }, 400);
    const cached = cacheGet(cacheKey);
    const results = cached || await providerRequest(parameters, apiKey);
    if (!cached) cache.set(cacheKey, { createdAt: Date.now(), value: results });
    return jsonResponse(action === 'search' ? { success: true, results } : { success: true, result: results[0] || null });
  } catch (error) {
    if (error?.status) return jsonResponse({ success: false, message: error.message }, error.status);
    console.error('Location geocoder request failed:', error?.name || 'unknown');
    return jsonResponse({ success: false, message: 'Location lookup is temporarily unavailable. Your photo and form details were not sent.' }, 503);
  }
}
