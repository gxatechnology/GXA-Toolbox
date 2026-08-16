import { ADMIN_BUILD_STATE } from './_admin-build-state.mjs';
import { adminErrorResponse, requireAdminSession } from './_admin-auth.mjs';
import { getAdminDateRange, loadAdminIntegrations } from './_admin-integrations.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';
import { databaseErrorCategory, getDatabaseClient, recordSystemEvent } from './_database.mjs';

const RANGE_DAYS = Object.freeze({ today: 1, '7d': 7, '28d': 28, '30d': 30, '3m': 90 });

function rangeStart(range) {
  return `${getAdminDateRange(range).start}T00:00:00.000Z`;
}

function number(value) {
  return Number(value) || 0;
}

function databaseIntegration(status, detail) {
  return {
    id: 'gxa-database',
    name: 'GXA Database',
    installed: true,
    status,
    label: status === 'connected' ? 'Connected' : status === 'configuration_required' ? 'Configuration Required' : 'Error',
    detail
  };
}

async function loadInternalData(sql, from) {
  const [userSummary, eventTrend, eventSummary, topTools, recentSignups, users, toolRows, authFailures, systemErrors] = await Promise.all([
    sql`
      SELECT COUNT(*)::INTEGER AS total_accounts,
             COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INTEGER AS signups_today,
             COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::INTEGER AS signups_7d,
             COUNT(*) FILTER (WHERE last_login_at >= ${from}::TIMESTAMPTZ)::INTEGER AS active_users
        FROM public.user_profiles
    `,
    sql`
      SELECT occurred_at::DATE AS date,
             COUNT(*) FILTER (WHERE event_type = 'tool_start')::INTEGER AS starts,
             COUNT(*) FILTER (WHERE event_type = 'tool_complete')::INTEGER AS completions,
             COUNT(*) FILTER (WHERE event_type = 'tool_download')::INTEGER AS downloads,
             COUNT(*) FILTER (WHERE event_type = 'tool_fail')::INTEGER AS failures
        FROM public.tool_analytics_events
       WHERE occurred_at >= ${from}::TIMESTAMPTZ
       GROUP BY occurred_at::DATE
       ORDER BY date ASC
    `,
    sql`
      SELECT COUNT(*) FILTER (WHERE event_type = 'tool_open')::INTEGER AS opens,
             COUNT(*) FILTER (WHERE event_type = 'tool_start')::INTEGER AS starts,
             COUNT(*) FILTER (WHERE event_type = 'tool_complete')::INTEGER AS completions,
             COUNT(*) FILTER (WHERE event_type = 'tool_fail')::INTEGER AS failures,
             COUNT(*) FILTER (WHERE event_type = 'tool_download')::INTEGER AS downloads
        FROM public.tool_analytics_events
       WHERE occurred_at >= ${from}::TIMESTAMPTZ
    `,
    sql`
      SELECT tool_id, MAX(tool_name) AS tool_name, MAX(tool_category) AS category,
             COUNT(*) FILTER (WHERE event_type = 'tool_open')::INTEGER AS opens,
             COUNT(*) FILTER (WHERE event_type = 'tool_start')::INTEGER AS starts,
             COUNT(*) FILTER (WHERE event_type = 'tool_complete')::INTEGER AS successful_jobs,
             COUNT(*) FILTER (WHERE event_type = 'tool_fail')::INTEGER AS failed_jobs,
             COUNT(*) FILTER (WHERE event_type = 'tool_download')::INTEGER AS downloads
        FROM public.tool_analytics_events
       WHERE occurred_at >= ${from}::TIMESTAMPTZ
       GROUP BY tool_id
       ORDER BY opens DESC, successful_jobs DESC, tool_id ASC
       LIMIT 20
    `,
    sql`
      SELECT full_name AS name, email, created_at
        FROM public.user_profiles
       ORDER BY created_at DESC
       LIMIT 8
    `,
    sql`
      SELECT identity_user_id AS id, full_name AS name, email, provider, is_premium, created_at, last_login_at, status
        FROM public.user_profiles
       ORDER BY created_at DESC
       LIMIT 100
    `,
    sql`
      SELECT tool_id, MAX(tool_name) AS tool_name, MAX(tool_category) AS category,
             COUNT(*) FILTER (WHERE event_type = 'tool_open')::INTEGER AS opens,
             COUNT(*) FILTER (WHERE event_type = 'tool_start')::INTEGER AS starts,
             COUNT(*) FILTER (WHERE event_type = 'tool_complete')::INTEGER AS successful_jobs,
             COUNT(*) FILTER (WHERE event_type = 'tool_fail')::INTEGER AS failed_jobs,
             COUNT(*) FILTER (WHERE event_type = 'tool_download')::INTEGER AS downloads
        FROM public.tool_analytics_events
       WHERE occurred_at >= ${from}::TIMESTAMPTZ
       GROUP BY tool_id
       ORDER BY opens DESC, successful_jobs DESC, tool_id ASC
    `,
    sql`
      SELECT event_type, category, COUNT(*)::INTEGER AS count
        FROM public.auth_events
       WHERE occurred_at >= ${from}::TIMESTAMPTZ
         AND event_type IN ('registration_failure', 'login_failure', 'session_failure')
       GROUP BY event_type, category
       ORDER BY count DESC
    `,
    sql`
      SELECT source, category, severity, occurred_at
        FROM public.system_events
       WHERE occurred_at >= ${from}::TIMESTAMPTZ
       ORDER BY occurred_at DESC
       LIMIT 50
    `
  ]);

  const events = eventSummary[0] || {};
  const summary = userSummary[0] || {};
  const withConversion = rows => rows.map(row => ({
    tool_id: row.tool_id,
    tool_name: row.tool_name,
    category: row.category,
    opens: number(row.opens),
    starts: number(row.starts),
    successful_jobs: number(row.successful_jobs),
    failed_jobs: number(row.failed_jobs),
    downloads: number(row.downloads),
    conversion_rate: number(row.starts) > 0 ? Number(((number(row.successful_jobs) / number(row.starts)) * 100).toFixed(1)) : null
  }));

  return {
    overview: {
      internal: {
        tool_runs: number(events.starts),
        downloads: number(events.downloads),
        errors: number(events.failures),
        successful_jobs: number(events.completions)
      },
      top_tools: withConversion(topTools),
      recent_signups: recentSignups,
      recent_system_errors: systemErrors,
      trend: eventTrend.map(row => ({ date: row.date, starts: number(row.starts), completions: number(row.completions), downloads: number(row.downloads), failures: number(row.failures) }))
    },
    users: {
      summary: {
        total_accounts: number(summary.total_accounts),
        signups_today: number(summary.signups_today),
        signups_7d: number(summary.signups_7d),
        active_users: number(summary.active_users)
      },
      rows: users
    },
    toolAnalytics: {
      formula: 'Successful Tool Completions / Tool Starts × 100',
      rows: withConversion(toolRows)
    },
    system: {
      auth_failures: authFailures.map(row => ({ ...row, count: number(row.count) })),
      errors: systemErrors
    }
  };
}

function emptyInternalData() {
  return {
    overview: { internal: null, top_tools: [], recent_signups: [], recent_system_errors: [], trend: [] },
    users: { summary: null, rows: [] },
    toolAnalytics: { formula: 'Successful Tool Completions / Tool Starts × 100', rows: [] },
    system: { auth_failures: [], errors: [] }
  };
}

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    requireAdminSession(request);
    const url = new URL(request.url);
    const range = Object.hasOwn(RANGE_DAYS, url.searchParams.get('range')) ? url.searchParams.get('range') : '30d';
    const external = await loadAdminIntegrations(range);
    let internal = emptyInternalData();
    let database = databaseIntegration('error', 'Database status is unknown.');
    try {
      const { sql } = getDatabaseClient();
      await sql`SELECT 1 AS healthy`;
      internal = await loadInternalData(sql, rangeStart(range));
      database = databaseIntegration('connected', 'Protected database queries completed successfully.');
    } catch (error) {
      console.error('Admin internal-data query failed:', error?.code || error?.name || 'unknown');
      const category = databaseErrorCategory(error);
      await recordSystemEvent('admin_database', category);
      database = databaseIntegration(
        category === 'configuration_required' ? 'configuration_required' : 'error',
        category === 'migration_required' ? 'Database migration required.' : category === 'configuration_required' ? 'Netlify Database connection is not configured.' : 'Database unavailable.'
      );
    }

    return jsonResponse({
      success: true,
      generated_at: new Date().toISOString(),
      range,
      integrations: [database, ...external.integrations],
      reports: external.reports,
      internalSeo: ADMIN_BUILD_STATE,
      ...internal
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
