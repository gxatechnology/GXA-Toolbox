import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { requireAdminSession } from './_admin-auth.mjs';
import { requireAdminMutation, adminAccountErrorResponse, consumeAdminRateLimit } from './_admin-account.mjs';
import { getDatabaseClient } from './_database.mjs';
import { blogMediaStore } from './_blog-media.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';
import { BLOG_UUID } from './_blog-core.mjs';

const MAX_UPLOAD = 6 * 1024 * 1024;
async function readBounded(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error('Choose an image.'), { status: 400 });
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD) { await reader.cancel(); throw Object.assign(new Error('Image must be under 6 MB.'), { status: 413 }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw Object.assign(new Error('Choose an image.'), { status: 400 });
  return Buffer.concat(chunks);
}

export default async function handler(request, context) {
  if (!['GET','POST'].includes(request.method)) return methodNotAllowed(['GET','POST']);
  try {
    const session = request.method === 'GET' ? requireAdminSession(request) : requireAdminMutation(request);
    const { sql } = getDatabaseClient();
    if (request.method === 'GET') {
      const mediaId = new URL(request.url).searchParams.get('id');
      if (mediaId) {
        if (!BLOG_UUID.test(mediaId)) return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
        const result = await sql`SELECT blob_key FROM public.blog_media WHERE id = ${mediaId} LIMIT 1`;
        if (!result.length) return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
        const bytes = await blogMediaStore(context).get(result[0].blob_key, { type: 'arrayBuffer' });
        return bytes ? new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } })
          : new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
      }
      const rows = await sql`SELECT id, alt_text, caption, byte_size, width, height, created_at FROM public.blog_media ORDER BY created_at DESC LIMIT 100`;
      return jsonResponse({ success: true, items: rows });
    }
    await consumeAdminRateLimit(sql, session, 'blog_media', 30, 300);
    const contentType = request.headers.get('content-type')?.toLowerCase();
    if (!['image/jpeg','image/png','image/webp'].includes(contentType)) return jsonResponse({ success: false, message: 'Use a JPEG, PNG or WebP image.' }, 415);
    let alt, caption;
    try {
      alt = decodeURIComponent(request.headers.get('x-gxa-image-alt') || '').trim();
      caption = decodeURIComponent(request.headers.get('x-gxa-image-caption') || '').trim();
    } catch { return jsonResponse({ success: false, message: 'Invalid image description.' }, 400); }
    if (!alt || alt.length > 240 || caption.length > 300) return jsonResponse({ success: false, message: 'A concise image description is required.' }, 400);
    const input = await readBounded(request);
    const processor = sharp(input, { limitInputPixels: 36_000_000, failOn: 'error' });
    const metadata = await processor.metadata();
    if (!['jpeg','png','webp'].includes(metadata.format) || `image/${metadata.format}` !== contentType) return jsonResponse({ success: false, message: 'Image format does not match the file.' }, 400);
    const { data, info } = await processor.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (data.length > 5_000_000) return jsonResponse({ success: false, message: 'Optimized image is too large.' }, 413);
    const id = randomUUID(); const key = `${id}.webp`; const store = blogMediaStore(context);
    await store.set(key, data, { metadata: { contentType: 'image/webp' } });
    try {
      await sql`INSERT INTO public.blog_media (id, blob_key, content_type, byte_size, width, height, alt_text, caption, created_by)
        VALUES (${id}, ${key}, 'image/webp', ${data.length}, ${info.width}, ${info.height}, ${alt}, ${caption}, ${session.sub})`;
    } catch (error) { await store.delete(key).catch(() => {}); throw error; }
    return jsonResponse({ success: true, media: { id, url: `/blog-media/${id}`, width: info.width, height: info.height, alt_text: alt, caption } });
  } catch (error) {
    if ([400,413].includes(error?.status)) return jsonResponse({ success: false, message: error.message }, error.status);
    if (error?.name === 'Error' && /Input image exceeds|Input buffer contains|unsupported image format/i.test(error.message)) return jsonResponse({ success: false, message: 'Image could not be processed.' }, 400);
    return adminAccountErrorResponse(error);
  }
}
