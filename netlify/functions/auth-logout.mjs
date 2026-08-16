import { clearSessionCookie, jsonResponse, methodNotAllowed } from './_auth.mjs';

// Netlify Identity logout runs in the browser. This compatibility endpoint only
// clears the obsolete normal-user cookie and never touches the admin cookie.
export default async function handler(request) {
  if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(['GET', 'POST']);
  return jsonResponse({
    success: false,
    retired: true,
    message: 'Normal-user logout is handled by Netlify Identity.'
  }, 410, { 'Set-Cookie': clearSessionCookie(request) });
}
