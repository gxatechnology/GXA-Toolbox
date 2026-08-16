import { jsonResponse, methodNotAllowed } from './_auth.mjs';

// Retained so old clients cannot establish a SQL-backed normal-user session
// alongside a Netlify Identity session.
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  return jsonResponse({
    success: false,
    retired: true,
    message: 'This legacy login endpoint has been retired. Use the GXA Toolbox Netlify Identity sign-in flow.'
  }, 410);
}
