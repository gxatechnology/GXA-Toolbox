import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';
import { requireAdminSession } from './_admin-auth.mjs';
import { getDatabaseClient } from './_database.mjs';
import {
  adminAccountError, adminAccountErrorResponse, consumeAdminRateLimit,
  requireAdminMutation, serializeAdminProfile
} from './_admin-account.mjs';

const MAX_BYTES = 5 * 1024 * 1024;
const acceptedTypes = new Map([['image/jpeg', 'jpeg'], ['image/png', 'png'], ['image/webp', 'webp']]);

async function readImageBytes(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) throw adminAccountError(413, 'Choose an image no larger than 5 MB.');
  const reader = request.body?.getReader();
  if (!reader) throw adminAccountError(422, 'Choose a JPEG, PNG or WebP photo.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw adminAccountError(413, 'Choose an image no larger than 5 MB.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw adminAccountError(422, 'Choose a JPEG, PNG or WebP photo.');
  return Buffer.concat(chunks);
}

export async function optimizeAdminAvatar(bytes, contentType) {
  if (!acceptedTypes.has(contentType)) throw adminAccountError(415, 'Choose a JPEG, PNG or WebP photo.');
  if (!bytes.length || bytes.length > MAX_BYTES) throw adminAccountError(413, 'Choose an image no larger than 5 MB.');
  try {
    const input = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'warning', animated: false });
    const metadata = await input.metadata();
    if (metadata.format !== acceptedTypes.get(contentType) || (metadata.pages || 1) !== 1
        || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096
        || metadata.width * metadata.height > 16_000_000) throw new Error('Invalid image dimensions or content.');
    // Sharp removes EXIF, GPS, XMP and other metadata by default; never call keepMetadata().
    const avatar = await input.rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 82 }).timeout({ seconds: 5 }).toBuffer();
    const thumbnail = await sharp(avatar).resize(64, 64).webp({ quality: 80 }).timeout({ seconds: 2 }).toBuffer();
    if (avatar.length > 131072 || thumbnail.length > 32768) throw new Error('Encoded image exceeds storage bound.');
    return { avatar, thumbnail };
  } catch { throw adminAccountError(422, 'This photo could not be decoded safely. Choose a still JPEG, PNG or WebP up to 4096 pixels per side and 16 megapixels.'); }
}

export default async function handler(request) {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return methodNotAllowed(['GET', 'POST', 'DELETE']);
  try {
    const session = request.method === 'GET' ? requireAdminSession(request) : requireAdminMutation(request);
    const { sql } = getDatabaseClient();
    if (request.method === 'GET') {
      const thumbnail = new URL(request.url).searchParams.get('size') === '64';
      const rows = thumbnail
        ? await sql`SELECT avatar_thumbnail AS image FROM public.admin_profiles WHERE subject = ${session.sub}`
        : await sql`SELECT avatar_image AS image FROM public.admin_profiles WHERE subject = ${session.sub}`;
      if (!rows[0]?.image) throw adminAccountError(404, 'No profile photo has been saved.');
      return new Response(rows[0].image, { headers: {
        'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline; filename="admin-avatar.webp"', 'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin', 'X-Robots-Tag': 'noindex, nofollow, noarchive'
      } });
    }
    await consumeAdminRateLimit(sql, session, 'avatar_update', 6, 300);
    let rows;
    if (request.method === 'DELETE') {
      rows = await sql`WITH changed AS (
        UPDATE public.admin_profiles SET avatar_revision = NULL, avatar_image = NULL, avatar_thumbnail = NULL
        WHERE subject = ${session.sub}
        RETURNING subject, full_name, display_name, phone, theme, sidebar_collapsed, avatar_revision, created_at, last_login_at
      ), audit AS (
        INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
        SELECT subject, 'avatar_removed', 'admin_profile', subject FROM changed RETURNING id
      ) SELECT changed.* FROM changed CROSS JOIN audit`;
    } else {
      const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!acceptedTypes.has(type)) throw adminAccountError(415, 'Choose a JPEG, PNG or WebP photo.');
      const { avatar, thumbnail } = await optimizeAdminAvatar(await readImageBytes(request), type);
      const revision = randomUUID();
      rows = await sql`WITH changed AS (
        INSERT INTO public.admin_profiles (subject, avatar_revision, avatar_image, avatar_thumbnail)
        VALUES (${session.sub}, ${revision}, ${avatar}, ${thumbnail})
        ON CONFLICT (subject) DO UPDATE SET avatar_revision = EXCLUDED.avatar_revision,
          avatar_image = EXCLUDED.avatar_image, avatar_thumbnail = EXCLUDED.avatar_thumbnail
        RETURNING subject, full_name, display_name, phone, theme, sidebar_collapsed, avatar_revision, created_at, last_login_at
      ), audit AS (
        INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
        SELECT subject, 'avatar_updated', 'admin_profile', subject FROM changed RETURNING id
      ) SELECT changed.* FROM changed CROSS JOIN audit`;
    }
    if (request.method === 'POST' && !rows[0]) throw new Error('Avatar save did not return a persisted profile.');
    return jsonResponse({ success: true, message: request.method === 'DELETE' ? 'Profile photo removed.' : 'Profile photo saved.', profile: serializeAdminProfile(rows[0]) });
  } catch (error) { return adminAccountErrorResponse(error); }
}
