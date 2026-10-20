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
  const rawCode = String(error?.code || error?.cause?.code || error?.name || '').trim().toUpperCase();
  if (rawCode === '28P01' || rawCode === '28000' || rawCode === '3D000') return 'connection_configuration';
  if (rawCode.startsWith('08') || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(rawCode)) {
    return 'connection_unavailable';
  }
  if (['42P01', '42703', '42883', '3F000'].includes(rawCode)) return 'migration_required';
  if (rawCode === '42501') return 'permission_denied';
  if (['53300', '57P03'].includes(rawCode)) return 'database_unavailable';
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
