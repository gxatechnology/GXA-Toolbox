import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createSessionCookie,
  createSessionToken,
  hashPassword,
  normalizeEmail,
  setDatabaseClientForTests,
  validateLogin,
  validateRegistration,
  verifyPassword,
  verifySessionToken
} from '../netlify/functions/_auth.mjs';
import historyHandler from '../netlify/functions/auth-history.mjs';
import loginHandler from '../netlify/functions/auth-login.mjs';
import logoutHandler from '../netlify/functions/auth-logout.mjs';
import registerHandler from '../netlify/functions/auth-register.mjs';
import saveJobHandler from '../netlify/functions/auth-save-job.mjs';
import sessionHandler from '../netlify/functions/auth-session.mjs';

process.env.AUTH_SESSION_SECRET = 'test-only-session-secret-with-at-least-32-characters';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [netlifyConfig, redirects, client, styles, schema, packageJson, ...functionSources] = await Promise.all([
  read('netlify.toml'),
  read('_redirects'),
  read('public_html/assets/app.js'),
  read('public_html/assets/style.css'),
  read('netlify/database/migrations/0001_create_auth_schema.sql'),
  read('package.json'),
  ...['_auth', 'auth-register', 'auth-login', 'auth-session', 'auth-logout', 'auth-history', 'auth-save-job']
    .map(name => read(`netlify/functions/${name}.mjs`))
]);
const functions = functionSources.join('\n');

for (const route of ['register', 'login', 'session', 'logout', 'get-history', 'save-job']) {
  assert.match(netlifyConfig, new RegExp(`/api/${route}\\.php`), `Netlify ${route} route is missing.`);
  assert.match(redirects, new RegExp(`/api/${route}\\.php /.netlify/functions/[^ ]+ 200`));
}
assert.match(netlifyConfig, /publish\s*=\s*"dist"/, 'Netlify must publish the generated static site.');
assert.doesNotMatch(netlifyConfig, /from\s*=\s*"\/\*"/, 'A broad SPA catch-all would bypass generated routes and real 404s.');
assert.match(packageJson, /"@netlify\/database"/);
assert.doesNotMatch(packageJson, /"mysql2"/);
assert.match(functions, /from '@netlify\/database'/);
assert.doesNotMatch(functions, /mysql2|DATE_FORMAT|LAST_INSERT_ID|ON DUPLICATE KEY|ER_DUP_ENTRY/);
assert.doesNotMatch(functions, /WHERE email = \?/);

for (const requiredSchemaToken of [
  'CREATE TABLE IF NOT EXISTS public.users',
  'full_name VARCHAR(120) NOT NULL',
  'email VARCHAR(254) NOT NULL',
  'password_hash VARCHAR(255) NOT NULL',
  'CONSTRAINT users_email_unique UNIQUE (email)',
  'CREATE TABLE IF NOT EXISTS public.file_jobs',
  'metadata JSONB NOT NULL',
  'REFERENCES public.users (id)',
  'CREATE INDEX IF NOT EXISTS file_jobs_user_created_idx',
  'CREATE OR REPLACE FUNCTION public.gxa_set_updated_at()',
  'CREATE TRIGGER users_set_updated_at',
  'CREATE TRIGGER file_jobs_set_updated_at'
]) {
  assert(schema.includes(requiredSchemaToken), `PostgreSQL schema is missing: ${requiredSchemaToken}`);
}
assert.doesNotMatch(schema, /DROP\s+TABLE/i);
assert.doesNotMatch(schema, /INSERT\s+INTO\s+public\.users/i);
assert.doesNotMatch(schema, /AUTO_INCREMENT|ON UPDATE CURRENT_TIMESTAMP|ENGINE=/i);

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
const user = { id: 7, name: 'Test User', email: 'test@example.com', role: 'user', is_premium: false };
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
const jobs = [];
const normalizeStatement = strings => strings.join('$value').replace(/\s+/g, ' ').trim();
setDatabaseClientForTests({
  sql: async (strings, ...values) => {
    const statement = normalizeStatement(strings);
    if (statement.startsWith('SELECT id FROM public.users') && statement.includes('WHERE email')) {
      return users.filter(record => record.email === values[0]).map(({ id }) => ({ id }));
    }
    if (statement.startsWith('INSERT INTO public.users')) {
      const record = {
        id: users.length + 1,
        full_name: values[0],
        email: values[1],
        password_hash: values[2],
        role: 'user',
        is_premium: false,
        status: 'active'
      };
      users.push(record);
      return [{ id: record.id, name: record.full_name, email: record.email, role: record.role, is_premium: record.is_premium }];
    }
    if (statement.startsWith('SELECT id, full_name AS name') && statement.includes('password_hash')) {
      return users
        .filter(record => record.email === values[0])
        .map(record => ({ ...record, name: record.full_name }));
    }
    if (statement.startsWith('SELECT id, full_name AS name') && statement.includes('WHERE id')) {
      return users
        .filter(record => record.id === Number(values[0]))
        .map(record => ({ ...record, name: record.full_name }));
    }
    if (statement.startsWith('INSERT INTO public.file_jobs')) {
      const record = {
        id: jobs.length + 1,
        user_id: Number(values[0]),
        tool_name: values[1],
        original_file: values[2],
        output_file: values[3],
        status: values[4],
        size_mb: Number(values[5]),
        processing_time_ms: Number(values[6]),
        metadata: JSON.parse(values[7]),
        created_at: '2026-08-12T00:00:00.000Z'
      };
      jobs.push(record);
      return [{ id: record.id }];
    }
    if (statement.startsWith('SELECT COUNT(*)::INTEGER AS processed_count')) {
      return [{ processed_count: jobs.filter(job => job.user_id === Number(values[0]) && job.status === 'done').length }];
    }
    if (statement.startsWith('SELECT id, original_file AS name')) {
      return jobs
        .filter(job => job.user_id === Number(values[0]))
        .map(job => ({
          id: job.id,
          name: job.original_file,
          tool: job.tool_name,
          date: '2026-08-12',
          size: `${job.size_mb} MB`,
          status: job.status
        }));
    }
    throw new Error(`Unexpected PostgreSQL auth test query: ${statement}`);
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

const invalidRegistrationResponse = await registerHandler(authRequest('/api/register.php', {
  name: 'A', email: 'bad', password: 'short'
}));
assert.equal(invalidRegistrationResponse.status, 400);

const registrationResponse = await registerHandler(authRequest('/api/register.php', {
  name: 'Integration User', email: 'integration@example.com', password: 'ValidPass!9'
}));
assert.equal(registrationResponse.status, 201);
assert.equal((await registrationResponse.clone().json()).success, true);
assert.notEqual(users[0].password_hash, 'ValidPass!9');
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

const unknownUserResponse = await loginHandler(authRequest('/api/login.php', {
  email: 'unknown@example.com', password: 'ValidPass!9'
}));
assert.equal(unknownUserResponse.status, 401);
assert.equal((await unknownUserResponse.json()).message, 'Incorrect email or password.');

const loginResponse = await loginHandler(authRequest('/api/login.php', {
  email: 'integration@example.com', password: 'ValidPass!9'
}));
assert.equal(loginResponse.status, 200);
const refreshedCookie = loginResponse.headers.get('set-cookie').split(';')[0];
const persistedSessionResponse = await sessionHandler(new Request('https://gxatoolbox.in/api/session.php', {
  headers: { Cookie: refreshedCookie }
}));
assert.equal((await persistedSessionResponse.json()).authenticated, true);

const unauthenticatedSaveResponse = await saveJobHandler(authRequest('/api/save-job.php', {
  tool_name: 'Crop Image', original_file: 'before.png', output_file: 'after.png', size: 1.25
}));
assert.equal(unauthenticatedSaveResponse.status, 401);

const saveResponse = await saveJobHandler(authRequest('/api/save-job.php', {
  tool_name: 'Crop Image',
  original_file: 'before.png',
  output_file: 'after.png',
  status: 'done',
  size: 1.25,
  processing_time_ms: 87,
  metadata: { format: 'png' }
}, refreshedCookie));
assert.equal(saveResponse.status, 201);
assert.equal(jobs[0].user_id, users[0].id);
assert.deepEqual(jobs[0].metadata, { format: 'png' });

const historyResponse = await historyHandler(new Request('https://gxatoolbox.in/api/get-history.php', {
  headers: { Cookie: refreshedCookie }
}));
const history = await historyResponse.json();
assert.equal(historyResponse.status, 200);
assert.equal(history.processedCount, 1);
assert.equal(history.history.length, 1);
assert.equal(history.history[0].name, 'before.png');

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

console.log('Authentication contract passed: Netlify PostgreSQL queries, secure hashing/sessions, history isolation, and mobile modal scrolling.');
