import { jsonResponse, methodNotAllowed } from './_auth.mjs';

// Retained so old clients receive an explicit migration response and cannot
// create a second kind of normal-user session.
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  return jsonResponse({
    success: false,
    retired: true,
    message: 'This legacy signup endpoint has been retired. Use the GXA Toolbox Netlify Identity sign-up flow.'
  }, 410);
}
