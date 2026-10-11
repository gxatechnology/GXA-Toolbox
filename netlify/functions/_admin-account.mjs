import { jsonResponse } from './_auth.mjs';
import { requireAdminSession } from './_admin-auth.mjs';
import { databaseErrorCategory, getDatabaseClient } from './_database.mjs';

class AdminAccountError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const adminAccountError = (status, message) => new AdminAccountError(status, message);

export function requireAdminMutation(request) {
  const session = requireAdminSession(request);
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try { sameOrigin = Boolean(origin) && new URL(origin).origin === new URL(request.url).origin; } catch { /* Invalid origin is rejected. */ }
  if (!sameOrigin || request.headers.get('x-gxa-admin-request') !== '1' || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw adminAccountError(403, 'The request could not be verified. Refresh this page and try again.');
  }
  return session;
}

export function adminAccountErrorResponse(error) {
  if (error instanceof AdminAccountError && [400, 403, 404, 413, 415, 422, 429].includes(error.status)) {
    return jsonResponse({ success: false, message: error.message }, error.status,
      error.status === 429 ? { 'Retry-After': '300' } : {});
  }
  if (error?.status === 401) return jsonResponse({ success: false, message: 'Administrator authentication required.' }, 401);
  if ([400, 413, 415].includes(error?.status)) {
    const messages = { 400: 'Invalid JSON request.', 413: 'Request body is too large.', 415: 'Expected a JSON request.' };
    return jsonResponse({ success: false, message: messages[error.status] }, error.status);
  }
  const category = databaseErrorCategory(error);
  console.error('Admin account service error:', category);
  return jsonResponse({ success: false, message: category === 'migration_required'
    ? 'Administrator account storage is not ready. Apply the database migrations through the next deployment.'
    : 'The administration service is temporarily unavailable. Please try again.' }, 503);
}

export async function consumeAdminRateLimit(sql, session, bucket, limit = 30, windowSeconds = 300) {
  if (!/^[a-z0-9_]{1,40}$/.test(bucket) || !Number.isInteger(limit) || limit < 1 || limit > 5000
      || !Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) throw new Error('Invalid admin rate-limit policy.');
  const rows = await sql`
    INSERT INTO public.admin_rate_limits (actor_subject, bucket) VALUES (${session.sub}, ${bucket})
    ON CONFLICT (actor_subject, bucket) DO UPDATE SET
      attempts = CASE WHEN admin_rate_limits.window_started_at <= CURRENT_TIMESTAMP - ${windowSeconds} * INTERVAL '1 second'
        THEN 1 ELSE admin_rate_limits.attempts + 1 END,
      window_started_at = CASE WHEN admin_rate_limits.window_started_at <= CURRENT_TIMESTAMP - ${windowSeconds} * INTERVAL '1 second'
        THEN CURRENT_TIMESTAMP ELSE admin_rate_limits.window_started_at END
    WHERE admin_rate_limits.window_started_at <= CURRENT_TIMESTAMP - ${windowSeconds} * INTERVAL '1 second'
       OR admin_rate_limits.attempts < ${limit}
    RETURNING attempts
  `;
  if (!rows.length) throw adminAccountError(429, 'Too many changes. Please wait a few minutes and try again.');
}

export async function recordAdminAudit(sql, session, action, resourceType, resourceId) {
  if (!/^[a-z0-9_]{1,64}$/.test(action) || !/^[a-z0-9_]{1,64}$/.test(resourceType)
      || !/^[a-zA-Z0-9_:@.\/-]{1,160}$/.test(String(resourceId))) throw new Error('Invalid admin audit descriptor.');
  await sql`INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
    VALUES (${session.sub}, ${action}, ${resourceType}, ${String(resourceId)})`;
}

export function serializeAdminProfile(row = {}) {
  const revision = row.avatar_revision || null;
  const avatarUrl = revision ? `/.netlify/functions/admin-avatar?v=${encodeURIComponent(revision)}` : null;
  return {
    full_name: row.full_name || '', display_name: row.display_name || '',
    label: row.display_name || row.full_name || 'Administrator',
    email: String(process.env.GXA_ADMIN_EMAIL || '').trim(), phone: row.phone || '', role: 'administrator',
    created_at: row.created_at || null, last_login_at: row.last_login_at || null,
    account_created_at: null, created_at_label: 'Profile record created',
    theme: row.theme || 'system', sidebar_collapsed: Boolean(row.sidebar_collapsed),
    avatar_url: avatarUrl, avatar_thumbnail_url: avatarUrl ? `${avatarUrl}&size=64` : null,
    avatar_revision: revision, credentials_management: 'environment', persisted: Boolean(row.subject)
  };
}

export async function loadAdminProfile(sql, session) {
  const rows = await sql`SELECT subject, full_name, display_name, phone, theme, sidebar_collapsed,
    avatar_revision, created_at, last_login_at FROM public.admin_profiles WHERE subject = ${session.sub}`;
  return serializeAdminProfile(rows[0]);
}

export async function recordAdminLogin(session = { sub: 'gxa-administrator' }) {
  // Login must remain available during rolling deploys before this additive migration exists.
  try {
    const { sql } = getDatabaseClient();
    await sql`WITH profile AS (
      INSERT INTO public.admin_profiles (subject, last_login_at) VALUES (${session.sub}, CURRENT_TIMESTAMP)
      ON CONFLICT (subject) DO UPDATE SET last_login_at = CURRENT_TIMESTAMP RETURNING subject
    ) INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
      SELECT subject, 'admin_login', 'admin_profile', subject FROM profile`;
    return true;
  } catch (error) {
    console.error('Admin login audit unavailable:', databaseErrorCategory(error));
    return false;
  }
}
