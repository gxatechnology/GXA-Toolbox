import { jsonResponse, methodNotAllowed } from './_auth.mjs';
import { readAdminJson, requireAdminSession } from './_admin-auth.mjs';
import { getDatabaseClient } from './_database.mjs';
import {
  adminAccountError, adminAccountErrorResponse, consumeAdminRateLimit, loadAdminProfile,
  requireAdminMutation, serializeAdminProfile
} from './_admin-account.mjs';

const fields = new Set(['full_name', 'display_name', 'phone', 'theme', 'sidebar_collapsed']);

function textField(body, name, maxLength) {
  if (!(name in body)) return '';
  if (typeof body[name] !== 'string' || body[name].length > maxLength || /[\u0000-\u001f\u007f]/.test(body[name])) {
    throw adminAccountError(422, `Enter a valid ${name.replaceAll('_', ' ')} (up to ${maxLength} characters).`);
  }
  return body[name].trim();
}

export default async function handler(request) {
  if (!['GET', 'PUT'].includes(request.method)) return methodNotAllowed(['GET', 'PUT']);
  try {
    const session = request.method === 'GET' ? requireAdminSession(request) : requireAdminMutation(request);
    const { sql } = getDatabaseClient();
    if (request.method === 'GET') return jsonResponse({ success: true, profile: await loadAdminProfile(sql, session) });
    const body = await readAdminJson(request);
    if (!Object.keys(body).length || Object.keys(body).some(name => !fields.has(name))) {
      throw adminAccountError(422, 'Only name, phone, theme and sidebar preferences can be updated here.');
    }
    const fullName = textField(body, 'full_name', 120);
    const displayName = textField(body, 'display_name', 80);
    const phone = textField(body, 'phone', 40);
    if (phone && !/^[+\d().\s-]{3,40}$/.test(phone)) throw adminAccountError(422, 'Enter a valid phone number or leave it empty.');
    if ('theme' in body && !['light', 'dark', 'system'].includes(body.theme)) throw adminAccountError(422, 'Choose light, dark or system appearance.');
    if ('sidebar_collapsed' in body && typeof body.sidebar_collapsed !== 'boolean') throw adminAccountError(422, 'Sidebar preference must be true or false.');
    await consumeAdminRateLimit(sql, session, 'profile_update', 30, 300);
    const rows = await sql`WITH changed AS (
      INSERT INTO public.admin_profiles (subject, full_name, display_name, phone, theme, sidebar_collapsed)
      VALUES (${session.sub}, ${fullName}, ${displayName}, ${phone}, ${body.theme || 'system'}, ${body.sidebar_collapsed || false})
      ON CONFLICT (subject) DO UPDATE SET
        full_name = CASE WHEN ${'full_name' in body} THEN EXCLUDED.full_name ELSE admin_profiles.full_name END,
        display_name = CASE WHEN ${'display_name' in body} THEN EXCLUDED.display_name ELSE admin_profiles.display_name END,
        phone = CASE WHEN ${'phone' in body} THEN EXCLUDED.phone ELSE admin_profiles.phone END,
        theme = CASE WHEN ${'theme' in body} THEN EXCLUDED.theme ELSE admin_profiles.theme END,
        sidebar_collapsed = CASE WHEN ${'sidebar_collapsed' in body} THEN EXCLUDED.sidebar_collapsed ELSE admin_profiles.sidebar_collapsed END
      RETURNING subject, full_name, display_name, phone, theme, sidebar_collapsed, avatar_revision, created_at, last_login_at
    ), audit AS (
      INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
      SELECT subject, 'profile_updated', 'admin_profile', subject FROM changed RETURNING id
    ) SELECT changed.* FROM changed CROSS JOIN audit`;
    if (!rows[0]) throw new Error('Profile save did not return a persisted profile.');
    return jsonResponse({ success: true, message: 'Profile saved.', profile: serializeAdminProfile(rows[0]) });
  } catch (error) { return adminAccountErrorResponse(error); }
}
