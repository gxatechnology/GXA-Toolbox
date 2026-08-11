import { assertSameOrigin, clearSessionCookie, jsonResponse, methodNotAllowed, safeErrorResponse } from './_auth.mjs';

export default async function handler(request) {
  if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(['GET', 'POST']);
  try {
    if (request.method === 'POST') assertSameOrigin(request);
    return jsonResponse(
      { success: true, message: 'Signed out successfully.' },
      200,
      { 'Set-Cookie': clearSessionCookie(request) }
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

