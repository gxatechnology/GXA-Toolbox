import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getDatabase } from '@netlify/database';
import { NetlifyDB } from '@netlify/database-dev';
import { setDatabaseClientForTests } from '../netlify/functions/_auth.mjs';
import { setIdentityUserProviderForTests } from '../netlify/functions/_identity-profile.mjs';
import historyHandler from '../netlify/functions/auth-history.mjs';
import saveJobHandler from '../netlify/functions/auth-save-job.mjs';
import sessionHandler from '../netlify/functions/auth-session.mjs';

if (process.env.RUN_POSTGRES_INTEGRATION !== 'true') {
  console.log('PostgreSQL auth integration skipped.');
  console.log('Set RUN_POSTGRES_INTEGRATION=true to run the isolated database integration test.');
} else {
  await runPostgresAuthIntegration();
}

async function runPostgresAuthIntegration() {
  const migrationsDirectory = fileURLToPath(new URL('../netlify/database/migrations', import.meta.url));
  const localDatabase = new NetlifyDB({ logger: () => {} });
  let database;

  const request = (path, body) => new Request(`https://gxatoolbox.in${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://gxatoolbox.in' },
    body: JSON.stringify(body)
  });

  try {
    const connectionString = await localDatabase.start();
    const expectedMigrations = [
      '0001_create_auth_schema',
      '0002_repair_auth_schema_after_site_reconnect',
      '0003_create_admin_analytics_schema',
      '0004_link_netlify_identity_profiles'
    ];
    assert.deepEqual(await localDatabase.applyMigrations(migrationsDirectory), expectedMigrations);
    assert.deepEqual(await localDatabase.applyMigrations(migrationsDirectory), []);

    database = getDatabase({ connectionString });
    setDatabaseClientForTests(database);
    setIdentityUserProviderForTests(async () => ({
      id: 'postgres-identity-subject',
      email: 'postgres.test@example.com',
      provider: 'google',
      userMetadata: { full_name: 'Postgres Identity User' }
    }));

    const tracked = await database.pool.query('SELECT name FROM netlify.migrations ORDER BY name');
    assert.deepEqual(tracked.rows.map(row => row.name), expectedMigrations);

    const tables = await database.sql`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('users', 'user_profiles', 'file_jobs', 'tool_analytics_events', 'auth_events', 'system_events')
       ORDER BY table_name
    `;
    assert.deepEqual(tables.map(row => row.table_name), ['auth_events', 'file_jobs', 'system_events', 'tool_analytics_events', 'user_profiles', 'users']);

    const foreignKeys = await database.sql`
      SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = 'public' AND table_name = 'file_jobs' AND constraint_type = 'FOREIGN KEY'
       ORDER BY constraint_name
    `;
    assert.deepEqual(foreignKeys.map(row => row.constraint_name), ['file_jobs_identity_user_fk', 'file_jobs_user_fk']);

    const sessionResponse = await sessionHandler(new Request('https://gxatoolbox.in/api/session.php'));
    const session = await sessionResponse.json();
    assert.equal(session.authenticated, true);
    assert.equal(session.user.id, 'postgres-identity-subject');

    const storedProfiles = await database.sql`
      SELECT identity_user_id, full_name, email, provider FROM public.user_profiles
       WHERE identity_user_id = ${'postgres-identity-subject'}
    `;
    assert.deepEqual(storedProfiles[0], {
      identity_user_id: 'postgres-identity-subject',
      full_name: 'Postgres Identity User',
      email: 'postgres.test@example.com',
      provider: 'google'
    });

    const saveResponse = await saveJobHandler(request('/api/save-job.php', {
      tool_name: 'Add Watermark', original_file: 'source.pdf', output_file: 'watermarked.pdf', status: 'done',
      size: 2.5, processing_time_ms: 123, metadata: { pages: 3 }
    }));
    assert.equal(saveResponse.status, 201);

    const historyResponse = await historyHandler(new Request('https://gxatoolbox.in/api/get-history.php'));
    const history = await historyResponse.json();
    assert.equal(history.processedCount, 1);
    assert.equal(history.history[0].tool, 'Add Watermark');

    const storedJobs = await database.sql`
      SELECT identity_user_id, user_id, metadata, processing_time_ms FROM public.file_jobs
       WHERE identity_user_id = ${'postgres-identity-subject'}
    `;
    assert.equal(storedJobs[0].identity_user_id, 'postgres-identity-subject');
    assert.equal(storedJobs[0].user_id, null);
    assert.deepEqual(storedJobs[0].metadata, { pages: 3 });
    assert.equal(storedJobs[0].processing_time_ms, 123);

    console.log('PostgreSQL Identity-profile integration passed against an isolated Netlify development database.');
  } finally {
    await database?.pool.end();
    await localDatabase.stop();
  }
}
