import {
  assertSameOrigin,
  createSessionCookie,
  getDatabasePool,
  jsonResponse,
  methodNotAllowed,
  publicUser,
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

    const [rows] = await getDatabasePool().execute(
      'SELECT id, name, email, password, role, is_premium, status FROM users WHERE email = ? LIMIT 1',
      [login.email]
    );
    const account = rows[0];
    const passwordAccepted = account ? await verifyPassword(login.password, account.password) : false;
    if (!account || !passwordAccepted || account.status !== 'active') {
      return jsonResponse({ success: false, message: 'Incorrect email or password.' }, 401);
    }

    const user = publicUser(account);
    return jsonResponse(
      { success: true, message: 'Signed in successfully.', user },
      200,
      { 'Set-Cookie': createSessionCookie(user, request) }
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

