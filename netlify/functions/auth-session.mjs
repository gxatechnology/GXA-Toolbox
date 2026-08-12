import { getDatabaseClient, jsonResponse, methodNotAllowed, publicUser, readSession, safeErrorResponse } from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = readSession(request);
    if (!session) return jsonResponse({ success: true, authenticated: false, user: null });

    const { sql } = getDatabaseClient();
    const rows = await sql`
      SELECT id, full_name AS name, email, role, is_premium, status
        FROM public.users
       WHERE id = ${session.id}
       LIMIT 1
    `;
    const account = rows[0];
    if (!account || account.status !== 'active') {
      return jsonResponse({ success: true, authenticated: false, user: null });
    }
    return jsonResponse({ success: true, authenticated: true, user: publicUser(account) });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
