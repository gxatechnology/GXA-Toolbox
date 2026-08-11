import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createSessionCookie,
  createSessionToken,
  hashPassword,
  normalizeEmail,
  setDatabasePoolForTests,
  validateLogin,
  validateRegistration,
  verifyPassword,
  verifySessionToken
} from '../netlify/functions/_auth.mjs';
import loginHandler from '../netlify/functions/auth-login.mjs';
import logoutHandler from '../netlify/functions/auth-logout.mjs';
import registerHandler from '../netlify/functions/auth-register.mjs';
import sessionHandler from '../netlify/functions/auth-session.mjs';

process.env.AUTH_SESSION_SECRET = 'test-only-session-secret-with-at-least-32-characters';

const netlifyConfig = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
const redirects = await readFile(new URL('../_redirects', import.meta.url), 'utf8');
const client = await readFile(new URL('../public_html/assets/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public_html/assets/style.css', import.meta.url), 'utf8');

for (const route of ['register', 'login', 'session', 'logout']) {
  assert.match(netlifyConfig, new RegExp(`/api/${route}\\.php[\\s\\S]*auth-${route}`), `Netlify ${route} route is missing.`);
  assert.match(redirects, new RegExp(`/api/${route}\\.php /.netlify/functions/auth-${route} 200`));
}
assert(netlifyConfig.indexOf('/api/register.php') < netlifyConfig.indexOf('from = "/*"'), 'Auth routes must precede the SPA fallback.');

const registration = validateRegistration({ name: '  Test   User  ', email: ' TEST@Example.COM ', password: 'ValidPass!9' });
assert.equal(registration.name, 'Test User');
assert.equal(registration.email, 'test@example.com');
assert.deepEqual(registration.errors, {});
assert.equal(normalizeEmail(' PERSON@EXAMPLE.COM '), 'person@example.com');
assert.equal(validateRegistration({ name: 'A', email: 'bad', password: 'short' }).errors.password.length > 0, true);
assert.equal(validateLogin({ email: 'bad', password: '' }).errors.email, 'Invalid email address.');

const hash = await hashPassword('ValidPass!9');
assert.notEqual(hash, 'ValidPass!9');
assert.equal(await verifyPassword('ValidPass!9', hash), true);
assert.equal(await verifyPassword('WrongPass!9', hash), false);

const now = Date.now();
const user = { id: 7, name: 'Test User', email: 'test@example.com', role: 'user', is_premium: 0 };
const token = createSessionToken(user, now);
assert.equal(verifySessionToken(token, now + 1000).email, 'test@example.com');
assert.equal(verifySessionToken(`${token.slice(0, -1)}x`, now + 1000), null);
assert.equal(verifySessionToken(token, now + (8 * 24 * 60 * 60 * 1000)), null);
const cookie = createSessionCookie(user, new Request('https://gxatoolbox.in/api/login.php'));
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /SameSite=Lax/);
assert.match(cookie, /Secure/);
assert.doesNotMatch(cookie, /ValidPass/);

const users = [];
setDatabasePoolForTests({
  async execute(sql, params) {
    if (sql.startsWith('SELECT id FROM users WHERE email')) {
      return [users.filter(userRecord => userRecord.email === params[0]).map(({ id }) => ({ id }))];
    }
    if (sql.startsWith('INSERT INTO users')) {
      const record = { id: users.length + 1, name: params[0], email: params[1], password: params[2], role: 'user', is_premium: 0, status: 'active' };
      users.push(record);
      return [{ insertId: record.id }];
    }
    if (sql.includes('password, role') && sql.includes('WHERE email')) {
      return [users.filter(userRecord => userRecord.email === params[0])];
    }
    if (sql.includes('WHERE id = ?')) {
      return [users.filter(userRecord => userRecord.id === Number(params[0]))];
    }
    throw new Error(`Unexpected auth test query: ${sql}`);
  }
});

const authRequest = (path, body, cookieHeader = '') => new Request(`https://gxatoolbox.in${path}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://gxatoolbox.in',
    ...(cookieHeader ? { Cookie: cookieHeader } : {})
  },
  body: JSON.stringify(body)
});
const registrationResponse = await registerHandler(authRequest('/api/register.php', {
  name: 'Integration User', email: 'integration@example.com', password: 'ValidPass!9'
}));
assert.equal(registrationResponse.status, 201);
assert.equal((await registrationResponse.clone().json()).success, true);
const sessionCookie = registrationResponse.headers.get('set-cookie').split(';')[0];

const duplicateResponse = await registerHandler(authRequest('/api/register.php', {
  name: 'Integration User', email: 'INTEGRATION@example.com', password: 'ValidPass!9'
}));
assert.equal(duplicateResponse.status, 409);

const wrongPasswordResponse = await loginHandler(authRequest('/api/login.php', {
  email: 'integration@example.com', password: 'WrongPass!9'
}));
assert.equal(wrongPasswordResponse.status, 401);
assert.equal((await wrongPasswordResponse.json()).message, 'Incorrect email or password.');

const loginResponse = await loginHandler(authRequest('/api/login.php', {
  email: 'integration@example.com', password: 'ValidPass!9'
}));
assert.equal(loginResponse.status, 200);
const refreshedCookie = loginResponse.headers.get('set-cookie').split(';')[0];
const persistedSessionResponse = await sessionHandler(new Request('https://gxatoolbox.in/api/session.php', {
  headers: { Cookie: refreshedCookie }
}));
assert.equal((await persistedSessionResponse.json()).authenticated, true);

const logoutResponse = await logoutHandler(new Request('https://gxatoolbox.in/api/logout.php', {
  method: 'POST',
  headers: { Origin: 'https://gxatoolbox.in', Cookie: sessionCookie }
}));
assert.equal(logoutResponse.status, 200);
assert.match(logoutResponse.headers.get('set-cookie'), /Max-Age=0/);

assert.match(client, /fetch\('\/api\/session\.php'/);
assert.match(client, /credentials: 'same-origin'/);
assert.match(client, /function readApiJson/);
assert.doesNotMatch(client, /window\.location\.href = '\/dashboard\/index\.php'/);
assert.match(styles, /max-height: min\(780px, calc\(100dvh - 32px\)\)/);
assert.match(styles, /\.auth-form \{[^}]*overflow-y: auto/);
assert.match(styles, /\.auth-modal-card \.modal-close \{[^}]*width: 44px; height: 44px/);

console.log('Authentication contract passed: secure hashing, signed sessions, production routes, and mobile modal scrolling.');
