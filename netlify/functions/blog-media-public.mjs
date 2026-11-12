import { getDatabaseClient, databaseErrorCategory } from './_database.mjs';
import { blogMediaStore } from './_blog-media.mjs';
import { BLOG_UUID } from './_blog-core.mjs';

export default async function handler(request, context) {
  if (!['GET','HEAD'].includes(request.method)) return new Response('', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const id = new URL(request.url).searchParams.get('id');
  if (!BLOG_UUID.test(id || '')) return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  try {
    const { sql } = getDatabaseClient();
    const rows = await sql`SELECT m.blob_key FROM public.blog_media m WHERE m.id = ${id}
      AND EXISTS (SELECT 1 FROM public.blog_post_media pm JOIN public.blog_posts p ON p.id = pm.post_id WHERE pm.media_id = m.id AND
        ((p.status = 'published' AND p.published_at <= CURRENT_TIMESTAMP) OR (p.status = 'scheduled' AND p.scheduled_at <= CURRENT_TIMESTAMP))
      ) LIMIT 1`;
    if (!rows.length) return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const bytes = request.method === 'HEAD' ? null : await blogMediaStore(context).get(rows[0].blob_key, { type: 'arrayBuffer' });
    if (request.method !== 'HEAD' && !bytes) return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('Blog media unavailable:', databaseErrorCategory(error));
    return new Response('', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
