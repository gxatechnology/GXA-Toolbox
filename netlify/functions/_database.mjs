import { getDatabase, MissingDatabaseConnectionError } from '@netlify/database';

let databaseClientOverride;
let databaseClient;

export { MissingDatabaseConnectionError };

export function getDatabaseClient() {
  if (databaseClientOverride) return databaseClientOverride;
  databaseClient ||= getDatabase();
  return databaseClient;
}

export function setDatabaseClientForTests(client) {
  if (process.env.NODE_ENV === 'production') throw new Error('Database test adapter is unavailable in production.');
  databaseClientOverride = client;
}

function safeToken(value, maxLength) {
  return String(value || 'unspecified')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength) || 'unspecified';
}

export function databaseErrorCategory(error) {
  if (error instanceof MissingDatabaseConnectionError) return 'configuration_required';
  const code = safeToken(error?.code || error?.name, 48);
  if (code === '28p01' || code === '3d000') return 'connection_configuration';
  if (code === '42p01' || code === '42703') return 'migration_required';
  return 'query_failed';
}

export async function recordSystemEvent(source, category, severity = 'error', client) {
  const safeSource = safeToken(source, 64);
  const safeCategory = safeToken(category, 80);
  const safeSeverity = new Set(['info', 'warning', 'error']).has(severity) ? severity : 'error';
  try {
    const { sql } = client || getDatabaseClient();
    await sql`
      INSERT INTO public.system_events (source, category, severity)
      VALUES (${safeSource}, ${safeCategory}, ${safeSeverity})
    `;
    return true;
  } catch (error) {
    console.error('System event recording failed:', error?.code || error?.name || 'unknown');
    return false;
  }
}
