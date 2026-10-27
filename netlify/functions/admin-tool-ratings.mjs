import { assertAdminSameOrigin, adminErrorResponse, readAdminJson, requireAdminSession } from './_admin-auth.mjs';
import { consumeAdminRateLimit, recordAdminAudit } from './_admin-account.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';
import { getDatabaseClient } from './_database.mjs';

const STATUSES = new Set(['accepted', 'rejected', 'spam']);

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const session = requireAdminSession(request);
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    const id = Number(body.id);
    const status = String(body.status || '').trim().toLowerCase();
    if (!Number.isSafeInteger(id) || id < 1 || !STATUSES.has(status)) {
      return jsonResponse({ success: false, message: 'Choose a valid rating and moderation state.' }, 400);
    }
    const { sql } = getDatabaseClient();
    await consumeAdminRateLimit(sql, session, 'rating_moderation', 60, 300);
    const rows = await sql`
      UPDATE public.tool_ratings
         SET moderation_status = ${status}, moderated_at = CURRENT_TIMESTAMP, moderated_by = ${session.sub}
       WHERE id = ${id}
       RETURNING id, tool_id, rating, review, moderation_status, created_at
    `;
    if (!rows.length) return jsonResponse({ success: false, message: 'The requested rating was not found.' }, 404);
    await recordAdminAudit(sql, session, `rating_${status}`, 'tool_rating', String(id));
    return jsonResponse({ success: true, rating: rows[0] });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
