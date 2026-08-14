import {
  adminErrorResponse,
  assertAdminSameOrigin,
  createAdminSessionCookie,
  readAdminJson,
  verifyAdminCredentials
} from './_admin-auth.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    if (!verifyAdminCredentials(body.email, body.password)) {
      return jsonResponse({ success: false, message: 'Invalid email or password.' }, 401);
    }
    return jsonResponse(
      { success: true, message: 'Administrator signed in.' },
      200,
      { 'Set-Cookie': createAdminSessionCookie(request) }
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
