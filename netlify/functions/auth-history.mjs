import { getDatabasePool, jsonResponse, methodNotAllowed, readSession, safeErrorResponse } from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = readSession(request);
    if (!session) return jsonResponse({ success: false, message: 'Sign in to view account history.' }, 401);
    const [rows] = await getDatabasePool().execute(
      `SELECT id, original_file AS name, tool_name AS tool,
              DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
              CONCAT(TRIM(TRAILING '0' FROM TRIM(TRAILING '.' FROM size_mb)), ' MB') AS size,
              status
         FROM file_jobs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 100`,
      [session.id]
    );
    return jsonResponse({ success: true, processedCount: rows.filter(row => row.status === 'done').length, history: rows });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

