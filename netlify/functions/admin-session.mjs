import { adminErrorResponse, readAdminSession } from './_admin-auth.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const session = readAdminSession(request);
    return jsonResponse({
      success: true,
      authenticated: Boolean(session),
      administrator: session ? { label: 'Administrator' } : null
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
