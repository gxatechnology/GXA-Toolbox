import { getDatabasePool, jsonResponse, methodNotAllowed, publicUser, readSession, safeErrorResponse } from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = readSession(request);
    if (!session) return jsonResponse({ success: true, authenticated: false, user: null });

    const [rows] = await getDatabasePool().execute(
      'SELECT id, name, email, role, is_premium, status FROM users WHERE id = ? LIMIT 1',
      [session.id]
    );
    const account = rows[0];
    if (!account || account.status !== 'active') {
      return jsonResponse({ success: true, authenticated: false, user: null });
    }
    return jsonResponse({ success: true, authenticated: true, user: publicUser(account) });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

