import { indexNowKey } from './_blog-indexnow.mjs';

export default async function handler(request, context) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const key = indexNowKey(context);
  if (!key) return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(request.method === 'HEAD' ? null : key, { status: 200, headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff'
  } });
}
