import {
  assertSameOrigin,
  createSessionCookie,
  getDatabaseClient,
  jsonResponse,
  methodNotAllowed,
  publicUser,
  recordAuthEvent,
  readJsonBody,
  safeErrorResponse,
  validateLogin,
  verifyPassword
} from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    assertSameOrigin(request);
    const login = validateLogin(await readJsonBody(request));
    if (Object.keys(login.errors).length) {
      return jsonResponse({ success: false, message: Object.values(login.errors)[0], errors: login.errors }, 400);
    }

    const { sql } = getDatabaseClient();
    const rows = await sql`
      SELECT id, full_name AS name, email, password_hash, role, is_premium, status
        FROM public.users
       WHERE email = ${login.email}
       LIMIT 1
    `;
    const account = rows[0];
    const passwordAccepted = account ? await verifyPassword(login.password, account.password_hash) : false;
    if (!account || !passwordAccepted || account.status !== 'active') {
      await recordAuthEvent(sql, 'login_failure', 'invalid_credentials');
      return jsonResponse({ success: false, message: 'Incorrect email or password.' }, 401);
    }

    const user = publicUser(account);
    await sql`
      UPDATE public.users
         SET last_login_at = CURRENT_TIMESTAMP
       WHERE id = ${user.id}
    `;
    await recordAuthEvent(sql, 'login_success', 'accepted');
    return jsonResponse(
      { success: true, message: 'Signed in successfully.', user },
      200,
      { 'Set-Cookie': createSessionCookie(user, request) }
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}
