import { adminErrorResponse, requireAdminSession } from './_admin-auth.mjs';
import { databaseErrorCategory, getDatabaseClient } from './_database.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';

export const EXPECTED_PUBLIC_TABLES = Object.freeze([
  'admin_audit_events',
  'admin_profiles',
  'admin_rate_limits',
  'admin_resource_reads',
  'auth_events',
  'file_jobs',
  'support_message_notes',
  'support_messages',
  'system_events',
  'tool_analytics_events',
  'user_profiles',
  'users'
]);

export const EXPECTED_MIGRATIONS = Object.freeze([
  '0001_create_auth_schema',
  '0002_repair_auth_schema_after_site_reconnect',
  '0003_create_admin_analytics_schema',
  '0004_link_netlify_identity_profiles',
  '0005_create_support_messages',
  '0006_admin_accounts',
  '0007_admin_resource_workflows',
  '0008_recover_expected_application_schema'
]);

function diagnosticsFailure(error) {
  const category = databaseErrorCategory(error);
  const messages = {
    configuration_required: 'Netlify Database is not configured for this function runtime.',
    connection_configuration: 'The database connection exists but its credentials or database selection are invalid.',
    connection_unavailable: 'The configured database endpoint could not be reached.',
    permission_denied: 'The database connection does not have permission to inspect the schema.',
    database_unavailable: 'The database is temporarily unavailable.',
    migration_required: 'The database is reachable but the expected schema is missing or incomplete.',
    query_failed: 'The database diagnostic query failed.'
  };
  return jsonResponse({ success: false, database: { status: category, message: messages[category] } }, 503);
}

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    requireAdminSession(request);
    const { sql } = getDatabaseClient();
    try {
      await sql`SELECT 1 AS healthy`;
      const expected = [...EXPECTED_PUBLIC_TABLES];
      const identityRows = await sql`
        SELECT current_database() AS database_name,
               current_user AS database_user,
               current_schema() AS current_schema,
               current_setting('search_path') AS search_path,
               has_schema_privilege(current_user, 'public', 'USAGE') AS public_usage,
               has_schema_privilege(current_user, 'public', 'CREATE') AS public_create
      `;
      const found = await sql`
        SELECT table_schema, table_name
          FROM information_schema.tables
         WHERE table_type = 'BASE TABLE'
           AND table_name = ANY(${expected}::TEXT[])
         ORDER BY table_schema, table_name
      `;
      const publicTables = found.filter(row => row.table_schema === 'public').map(row => row.table_name);
      const publicSet = new Set(publicTables);
      const missingTables = expected.filter(name => !publicSet.has(name));
      const otherSchemas = found
        .filter(row => row.table_schema !== 'public')
        .map(row => ({ schema: row.table_schema, table: row.table_name }));
      let appliedMigrations = null;
      try {
        const rows = await sql`SELECT name FROM netlify.migrations ORDER BY name`;
        appliedMigrations = rows.map(row => row.name);
      } catch (error) {
        if (databaseErrorCategory(error) !== 'migration_required') throw error;
      }
      const status = missingTables.length === 0
        ? 'ready'
        : publicTables.length === 0
          ? 'empty_public_schema'
          : 'migration_required';
      return jsonResponse({
        success: true,
        deployment: {
          site_id: process.env.SITE_ID || null,
          deploy_id: process.env.DEPLOY_ID || null,
          context: process.env.CONTEXT || null,
          branch: process.env.BRANCH || null
        },
        database: {
          status,
          identity: identityRows[0] || null,
          expected_table_count: expected.length,
          public_table_count: publicTables.length,
          public_tables: publicTables,
          missing_tables: missingTables,
          expected_tables_in_other_schemas: otherSchemas,
          migration_tracking_available: appliedMigrations !== null,
          applied_migrations: appliedMigrations,
          migration_status: EXPECTED_MIGRATIONS.map(name => ({
            name,
            applied: appliedMigrations?.includes(name) || false
          }))
        }
      });
    } catch (error) {
      console.error('Admin database diagnostics failed:', error?.code || error?.name || 'unknown');
      return diagnosticsFailure(error);
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
