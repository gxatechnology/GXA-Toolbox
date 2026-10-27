import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { databaseErrorCategory } from '../netlify/functions/_database.mjs';

const diagnostics = await readFile(new URL('../netlify/functions/admin-database-diagnostics.mjs', import.meta.url), 'utf8');
const migration = await readFile(new URL('../netlify/database/migrations/0008_recover_expected_application_schema.sql', import.meta.url), 'utf8');
const ratingsMigration = await readFile(new URL('../netlify/database/migrations/0009_create_tool_ratings.sql', import.meta.url), 'utf8');
const expectedTables = [
  'admin_audit_events', 'admin_profiles', 'admin_rate_limits', 'admin_resource_reads',
  'auth_events', 'file_jobs', 'support_message_notes', 'support_messages',
  'system_events', 'tool_analytics_events', 'user_profiles', 'users'
];

assert.match(diagnostics, /requireAdminSession\(request\)/u);
assert.match(diagnostics, /information_schema\.tables/u);
assert.match(diagnostics, /netlify\.migrations/u);
assert.match(diagnostics, /empty_public_schema/u);
assert.match(diagnostics, /current_setting\('search_path'\)/u);
assert.match(diagnostics, /has_schema_privilege/u);
assert.match(diagnostics, /site_id: process\.env\.SITE_ID/u);
assert.match(diagnostics, /EXPECTED_OPTIONAL_TABLES/u);
assert.match(diagnostics, /0009_create_tool_ratings/u);
assert.match(diagnostics, /missing_optional_tables/u);
assert.doesNotMatch(diagnostics, /connectionString|NETLIFY_DATABASE_URL|password_hash/u);
for (const table of expectedTables) {
  assert.match(diagnostics, new RegExp(`['"]${table}['"]`, 'u'));
  assert.match(migration, new RegExp(`public\\.${table}\\b`, 'u'));
}
assert.doesNotMatch(migration, /^\s*(?:DROP\b|TRUNCATE\b|DELETE\s+FROM\b|INSERT\s+INTO\b|UPDATE\s+[a-z_])/imu);
assert.match(ratingsMigration, /CREATE TABLE IF NOT EXISTS public\.tool_ratings/u);
assert.doesNotMatch(ratingsMigration, /^\s*(?:DROP\b|TRUNCATE\b|DELETE\s+FROM\b|INSERT\s+INTO\b|UPDATE\s+[a-z_])/imu);

for (const [code, expected] of [
  ['42P01', 'migration_required'],
  ['42703', 'migration_required'],
  ['28P01', 'connection_configuration'],
  ['08006', 'connection_unavailable'],
  ['ECONNREFUSED', 'connection_unavailable'],
  ['42501', 'permission_denied'],
  ['57P03', 'database_unavailable']
]) assert.equal(databaseErrorCategory({ code }), expected);

console.log('Database recovery patch contract passed.');
