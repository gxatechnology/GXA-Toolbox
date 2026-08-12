import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getDatabase } from '@netlify/database';
import { NetlifyDB } from '@netlify/database-dev';
import { setDatabaseClientForTests } from '../netlify/functions/_auth.mjs';
import historyHandler from '../netlify/functions/auth-history.mjs';
import loginHandler from '../netlify/functions/auth-login.mjs';
import logoutHandler from '../netlify/functions/auth-logout.mjs';
import registerHandler from '../netlify/functions/auth-register.mjs';
import saveJobHandler from '../netlify/functions/auth-save-job.mjs';
import sessionHandler from '../netlify/functions/auth-session.mjs';

process.env.AUTH_SESSION_SECRET = 'postgres-integration-session-secret-at-least-32-chars';

const migrationsDirectory = fileURLToPath(new URL('../netlify/database/migrations', import.meta.url));
const localDatabase = new NetlifyDB({ logger: () => {} });
let database;

const request = (path, body, cookie = '') => new Request(`https://gxatoolbox.in${path}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://gxatoolbox.in',
    ...(cookie ? { Cookie: cookie } : {})
  },
  body: JSON.stringify(body)
});

try {
  const connectionString = await localDatabase.start();
  const appliedMigrations = await localDatabase.applyMigrations(migrationsDirectory);
  assert.deepEqual(appliedMigrations, ['0001_create_auth_schema']);
  assert.deepEqual(await localDatabase.applyMigrations(migrationsDirectory), []);

  database = getDatabase({ connectionString });
  setDatabaseClientForTests(database);

  const trackedMigrations = await database.pool.query(`
    SELECT name
      FROM netlify.migrations
     ORDER BY name
  `);
  assert.deepEqual(trackedMigrations.rows.map(row => row.name), ['0001_create_auth_schema']);

  const tables = await database.sql`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('users', 'file_jobs')
     ORDER BY table_name
  `;
  assert.deepEqual(tables.map(row => row.table_name), ['file_jobs', 'users']);

  const foreignKeys = await database.sql`
    SELECT constraint_name
      FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = 'file_jobs'
       AND constraint_type = 'FOREIGN KEY'
  `;
  assert.deepEqual(foreignKeys.map(row => row.constraint_name), ['file_jobs_user_fk']);

  const indexes = await database.sql`
    SELECT indexname
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN ('file_jobs_user_created_idx', 'file_jobs_user_status_idx')
     ORDER BY indexname
  `;
  assert.deepEqual(indexes.map(row => row.indexname), ['file_jobs_user_created_idx', 'file_jobs_user_status_idx']);

  const registrationResponse = await registerHandler(request('/api/register.php', {
    name: 'Postgres Integration User',
    email: ' POSTGRES.TEST@EXAMPLE.COM ',
    password: 'ValidPass!9'
  }));
  assert.equal(registrationResponse.status, 201);
  const registration = await registrationResponse.clone().json();
  assert.equal(registration.user.email, 'postgres.test@example.com');
  assert.equal(Object.hasOwn(registration.user, 'password_hash'), false);
  const registrationCookie = registrationResponse.headers.get('set-cookie').split(';')[0];

  const storedUsers = await database.sql`
    SELECT full_name, email, password_hash, status
      FROM public.users
     WHERE email = ${'postgres.test@example.com'}
  `;
  assert.equal(storedUsers.length, 1);
  assert.equal(storedUsers[0].full_name, 'Postgres Integration User');
  assert.notEqual(storedUsers[0].password_hash, 'ValidPass!9');
  assert.equal(storedUsers[0].status, 'active');

  const duplicateResponse = await registerHandler(request('/api/register.php', {
    name: 'Postgres Integration User',
    email: 'postgres.test@example.com',
    password: 'ValidPass!9'
  }));
  assert.equal(duplicateResponse.status, 409);

  const wrongPasswordResponse = await loginHandler(request('/api/login.php', {
    email: 'postgres.test@example.com',
    password: 'WrongPass!9'
  }));
  assert.equal(wrongPasswordResponse.status, 401);
  assert.equal((await wrongPasswordResponse.json()).message, 'Incorrect email or password.');

  const loginResponse = await loginHandler(request('/api/login.php', {
    email: 'postgres.test@example.com',
    password: 'ValidPass!9'
  }));
  assert.equal(loginResponse.status, 200);
  const loginCookie = loginResponse.headers.get('set-cookie').split(';')[0];

  const sessionResponse = await sessionHandler(new Request('https://gxatoolbox.in/api/session.php', {
    headers: { Cookie: loginCookie }
  }));
  const session = await sessionResponse.json();
  assert.equal(session.authenticated, true);
  assert.equal(session.user.email, 'postgres.test@example.com');

  const saveResponse = await saveJobHandler(request('/api/save-job.php', {
    tool_name: 'Add Watermark',
    original_file: 'source.pdf',
    output_file: 'watermarked.pdf',
    status: 'done',
    size: 2.5,
    processing_time_ms: 123,
    metadata: { pages: 3 }
  }, loginCookie));
  assert.equal(saveResponse.status, 201);

  const historyResponse = await historyHandler(new Request('https://gxatoolbox.in/api/get-history.php', {
    headers: { Cookie: loginCookie }
  }));
  const history = await historyResponse.json();
  assert.equal(historyResponse.status, 200);
  assert.equal(history.processedCount, 1);
  assert.equal(history.history.length, 1);
  assert.equal(history.history[0].tool, 'Add Watermark');

  const storedJobs = await database.sql`
    SELECT metadata, processing_time_ms
      FROM public.file_jobs
     WHERE user_id = ${registration.user.id}
  `;
  assert.deepEqual(storedJobs[0].metadata, { pages: 3 });
  assert.equal(storedJobs[0].processing_time_ms, 123);

  const logoutResponse = await logoutHandler(new Request('https://gxatoolbox.in/api/logout.php', {
    method: 'POST',
    headers: { Origin: 'https://gxatoolbox.in', Cookie: registrationCookie }
  }));
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get('set-cookie'), /Max-Age=0/);

  console.log('PostgreSQL auth integration passed against an isolated Netlify development database.');
} finally {
  await database?.pool.end();
  await localDatabase.stop();
}
