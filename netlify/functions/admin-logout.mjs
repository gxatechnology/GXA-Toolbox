import { adminErrorResponse, assertAdminSameOrigin, clearAdminSessionCookie } from './_admin-auth.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    assertAdminSameOrigin(request);
    return jsonResponse(
      { success: true, message: 'Administrator signed out.' },
      200,
      { 'Set-Cookie': clearAdminSessionCookie(request) }
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
