import { jsonResponse, methodNotAllowed, safeErrorResponse } from './_auth.mjs';
import { getIdentityUser, publicIdentityProfile, syncIdentityProfile } from './_identity-profile.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const identityUser = await getIdentityUser();
    if (!identityUser) return jsonResponse({ success: true, authenticated: false, user: null });
    const profile = await syncIdentityProfile(identityUser);
    if (!profile || profile.status !== 'active') {
      return jsonResponse({ success: true, authenticated: false, user: null });
    }
    return jsonResponse({ success: true, authenticated: true, user: publicIdentityProfile(profile) });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
