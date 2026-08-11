import {
  assertSameOrigin,
  createSessionCookie,
  getDatabasePool,
  hashPassword,
  jsonResponse,
  methodNotAllowed,
  publicUser,
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

    const pool = getDatabasePool();
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [registration.email]);
    if (existing.length) {
      return jsonResponse({ success: false, message: 'This email is already registered.' }, 409);
    }

    const passwordHash = await hashPassword(registration.password);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password, role, is_premium, status) VALUES (?, ?, ?, 'user', 0, 'active')",
      [registration.name, registration.email, passwordHash]
    );
    const user = publicUser({
      id: result.insertId,
      name: registration.name,
      email: registration.email,
      role: 'user',
      is_premium: 0
    });

    return jsonResponse(
      { success: true, message: 'Account created successfully.', user },
      201,
      { 'Set-Cookie': createSessionCookie(user, request) }
    );
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return jsonResponse({ success: false, message: 'This email is already registered.' }, 409);
    }
    return safeErrorResponse(error);
  }
}

