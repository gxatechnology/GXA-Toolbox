import {
  assertSameOrigin,
  createSessionCookie,
  getDatabaseClient,
  hashPassword,
  jsonResponse,
  methodNotAllowed,
  publicUser,
  recordAuthEvent,
  readJsonBody,
  safeErrorResponse,
  validateRegistration
} from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    assertSameOrigin(request);
    const registration = validateRegistration(await readJsonBody(request));
    if (Object.keys(registration.errors).length) {
      return jsonResponse({ success: false, message: Object.values(registration.errors)[0], errors: registration.errors }, 400);
    }

    const { sql } = getDatabaseClient();
    const existing = await sql`
      SELECT id
        FROM public.users
       WHERE email = ${registration.email}
       LIMIT 1
    `;
    if (existing.length) {
      await recordAuthEvent(sql, 'registration_failure', 'duplicate_account');
      return jsonResponse({ success: false, message: 'This email is already registered.' }, 409);
    }

    const passwordHash = await hashPassword(registration.password);
    const inserted = await sql`
      INSERT INTO public.users (full_name, email, password_hash, role, is_premium, status)
      VALUES (${registration.name}, ${registration.email}, ${passwordHash}, 'user', FALSE, 'active')
      RETURNING id, full_name AS name, email, role, is_premium
    `;
    const user = publicUser(inserted[0]);
    await recordAuthEvent(sql, 'registration_success', 'accepted');

    return jsonResponse(
      { success: true, message: 'Account created successfully.', user },
      201,
      { 'Set-Cookie': createSessionCookie(user, request) }
    );
  } catch (error) {
    if (error?.code === '23505') {
      return jsonResponse({ success: false, message: 'This email is already registered.' }, 409);
    }
    return safeErrorResponse(error);
  }
}
