import { assertSameOrigin, jsonResponse, methodNotAllowed } from './_auth.mjs';

// Fixed provider, style and dimensions: never proxy arbitrary URLs or leak the API key.
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    assertSameOrigin(request);
    const raw = await request.text();
    if (raw.length > 256) return jsonResponse({ success: false, message: 'Map request is too large.' }, 413);
    let point;
    try { point = JSON.parse(raw); } catch { return jsonResponse({ success: false, message: 'Choose valid map coordinates.' }, 400); }
    const { latitude, longitude } = point || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 85 || Math.abs(longitude) > 180) {
      return jsonResponse({ success: false, message: 'Street maps support latitudes from −85 to 85°. The coordinate locator remains available.' }, 400);
    }
    if (!process.env.GEOAPIFY_API_KEY) return jsonResponse({ success: false, message: 'Street maps are not configured. The coordinate locator will be used.' }, 503);
    const params = new URLSearchParams({ style: 'osm-carto', width: '640', height: '480', format: 'png',
      center: `lonlat:${longitude.toFixed(6)},${latitude.toFixed(6)}`, zoom: '15', attribution: 'default', apiKey: process.env.GEOAPIFY_API_KEY });
    const response = await fetch(`https://maps.geoapify.com/v1/staticmap?${params}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'image/png' }, redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) throw new Error('Map unavailable');
    if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error('Map too large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 24 || bytes.length > 2_000_000 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) throw new Error('Invalid map image');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(16) !== 640 || view.getUint32(20) !== 480) throw new Error('Unexpected map size');
    return new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    if (error?.status) return jsonResponse({ success: false, message: error.message }, error.status);
    console.error('Static map unavailable:', error?.name || 'Error');
    return jsonResponse({ success: false, message: 'Street map unavailable. The coordinate locator will be used; your photo was not sent.' }, 503);
  }
}
