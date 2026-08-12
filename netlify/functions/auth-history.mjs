import { getDatabaseClient, jsonResponse, methodNotAllowed, readSession, safeErrorResponse } from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = readSession(request);
    if (!session) return jsonResponse({ success: false, message: 'Sign in to view account history.' }, 401);
    const { sql } = getDatabaseClient();
    const countRows = await sql`
      SELECT COUNT(*)::INTEGER AS processed_count
        FROM public.file_jobs
       WHERE user_id = ${session.id}
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
       WHERE user_id = ${session.id}
       ORDER BY created_at DESC
       LIMIT 100
    `;
    return jsonResponse({ success: true, processedCount: Number(countRows[0]?.processed_count) || 0, history: rows });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
