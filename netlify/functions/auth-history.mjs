import { jsonResponse, methodNotAllowed, safeErrorResponse } from './_auth.mjs';
import { getDatabaseClient } from './_database.mjs';
import { requireIdentityUser } from './_identity-profile.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const auth = await requireIdentityUser();
    if (auth.response) return auth.response;
    const { sql } = getDatabaseClient();
    const countRows = await sql`
      SELECT COUNT(*)::INTEGER AS processed_count
        FROM public.file_jobs
       WHERE (identity_user_id = ${auth.user.id}
          OR user_id = (SELECT legacy_user_id FROM public.user_profiles WHERE identity_user_id = ${auth.user.id}))
         AND status = 'done'
    `;
    const rows = await sql`
      SELECT id,
             original_file AS name,
             tool_name AS tool,
             TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
             TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM size_mb::TEXT)) || ' MB' AS size,
             status
        FROM public.file_jobs
       WHERE (identity_user_id = ${auth.user.id}
          OR user_id = (SELECT legacy_user_id FROM public.user_profiles WHERE identity_user_id = ${auth.user.id}))
       ORDER BY created_at DESC
       LIMIT 100
    `;
    return jsonResponse({ success: true, processedCount: Number(countRows[0]?.processed_count) || 0, history: rows });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
