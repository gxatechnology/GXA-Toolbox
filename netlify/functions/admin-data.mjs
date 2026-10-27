import { ADMIN_BUILD_STATE } from './_admin-build-state.mjs';
import { ADMIN_PRODUCT_SNAPSHOT } from './_admin-product-snapshot.mjs';
import { buildToolAnalytics, safeRecentEvents } from './_admin-tool-analytics.mjs';
import { adminErrorResponse, requireAdminSession } from './_admin-auth.mjs';
import { getAdminDateRange, loadAdminIntegrations } from './_admin-integrations.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';
import { databaseErrorCategory, getDatabaseClient, recordSystemEvent } from './_database.mjs';

const number = value => Number(value) || 0;
function databaseIntegration(status, detail) {
  return { id: 'gxa-database', name: 'GXA Database', installed: true, status, label: status === 'connected' ? 'Connected' : status === 'configuration_required' ? 'Configuration Required' : 'Error', detail };
}

const toolNames = new Map(ADMIN_PRODUCT_SNAPSHOT.tools.map(tool => [tool.id, tool.name]));

export async function loadRatingsData(sql, from, until) {
  const presence = await sql`SELECT to_regclass('public.tool_ratings') IS NOT NULL AS ratings_table`;
  if (!presence[0]?.ratings_table) {
    return { available:false, reason:'migration_required', summary:null, tools:[], reviews:[] };
  }
  const [summaryRows, toolRows, reviewRows] = await Promise.all([
    sql`SELECT COUNT(*) FILTER (WHERE moderation_status <> 'spam')::INTEGER AS total_ratings,
      ROUND(AVG(rating) FILTER (WHERE moderation_status <> 'spam')::NUMERIC, 2) AS average_rating,
      COUNT(*) FILTER (WHERE review IS NOT NULL AND moderation_status = 'pending')::INTEGER AS pending_reviews,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 1)::INTEGER AS one_star,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 2)::INTEGER AS two_star,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 3)::INTEGER AS three_star,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 4)::INTEGER AS four_star,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 5)::INTEGER AS five_star
      FROM public.tool_ratings WHERE created_at >= ${from}::TIMESTAMPTZ AND created_at < ${until}::TIMESTAMPTZ`,
    sql`SELECT tool_id, COUNT(*) FILTER (WHERE moderation_status <> 'spam')::INTEGER AS rating_count,
      ROUND(AVG(rating) FILTER (WHERE moderation_status <> 'spam')::NUMERIC, 2) AS average_rating,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 1)::INTEGER AS one_star,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 2)::INTEGER AS two_star,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 3)::INTEGER AS three_star,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 4)::INTEGER AS four_star,
      COUNT(*) FILTER (WHERE moderation_status <> 'spam' AND rating = 5)::INTEGER AS five_star
      FROM public.tool_ratings WHERE created_at >= ${from}::TIMESTAMPTZ AND created_at < ${until}::TIMESTAMPTZ
      GROUP BY tool_id ORDER BY average_rating DESC NULLS LAST, rating_count DESC, tool_id ASC`,
    sql`SELECT id, tool_id, rating, review, moderation_status, created_at, moderated_at
      FROM public.tool_ratings WHERE review IS NOT NULL
      AND created_at >= ${from}::TIMESTAMPTZ AND created_at < ${until}::TIMESTAMPTZ
      ORDER BY created_at DESC, id DESC LIMIT 200`
  ]);
  const summary = summaryRows[0] || {};
  return {
    available:true,
    summary:{
      total_ratings:number(summary.total_ratings),
      average_rating:summary.average_rating === null ? null : Number(summary.average_rating),
      pending_reviews:number(summary.pending_reviews),
      distribution:[1,2,3,4,5].map(value=>({rating:value,count:number(summary[`${['one','two','three','four','five'][value-1]}_star`])}))
    },
    tools:toolRows.map(row=>({
      ...row,
      tool_name:toolNames.get(row.tool_id) || row.tool_id,
      rating_count:number(row.rating_count),
      average_rating:row.average_rating === null ? null : Number(row.average_rating),
      distribution:[1,2,3,4,5].map(value=>number(row[`${['one','two','three','four','five'][value-1]}_star`]))
    })),
    reviews:reviewRows.map(row=>({...row,tool_name:toolNames.get(row.tool_id) || row.tool_id,rating:number(row.rating)}))
  };
}

export async function loadInternalData(sql, from, until) {
  const [userSummary, eventTrend, eventSummary, recentSignups, users, toolRows, authFailures, systemErrors, supportMessages, recentEvents, supportSummary, ratings] = await Promise.all([
    sql`SELECT COUNT(*)::INTEGER AS total_accounts,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INTEGER AS signups_today,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::INTEGER AS signups_7d,
      COUNT(*) FILTER (WHERE created_at >= ${from}::TIMESTAMPTZ AND created_at < ${until}::TIMESTAMPTZ)::INTEGER AS signups_period,
      COUNT(*) FILTER (WHERE last_login_at >= ${from}::TIMESTAMPTZ AND last_login_at < ${until}::TIMESTAMPTZ)::INTEGER AS active_users
      FROM public.user_profiles`,
    sql`SELECT (occurred_at AT TIME ZONE 'UTC')::DATE AS date,
      COUNT(*) FILTER (WHERE event_type = 'tool_start')::INTEGER AS starts,
      COUNT(*) FILTER (WHERE event_type = 'tool_complete')::INTEGER AS completions,
      COUNT(*) FILTER (WHERE event_type = 'tool_download')::INTEGER AS downloads,
      COUNT(*) FILTER (WHERE event_type = 'tool_fail')::INTEGER AS failures
      FROM public.tool_analytics_events WHERE occurred_at >= ${from}::TIMESTAMPTZ AND occurred_at < ${until}::TIMESTAMPTZ
      GROUP BY (occurred_at AT TIME ZONE 'UTC')::DATE ORDER BY date ASC`,
    sql`SELECT COUNT(*) FILTER (WHERE event_type = 'tool_open')::INTEGER AS opens,
      COUNT(*) FILTER (WHERE event_type = 'tool_start')::INTEGER AS starts,
      COUNT(*) FILTER (WHERE event_type = 'tool_complete')::INTEGER AS completions,
      COUNT(*) FILTER (WHERE event_type = 'tool_fail')::INTEGER AS failures,
      COUNT(*) FILTER (WHERE event_type = 'tool_download')::INTEGER AS downloads
      FROM public.tool_analytics_events WHERE occurred_at >= ${from}::TIMESTAMPTZ AND occurred_at < ${until}::TIMESTAMPTZ`,
    sql`SELECT full_name AS name, email, created_at FROM public.user_profiles
      WHERE created_at >= ${from}::TIMESTAMPTZ AND created_at < ${until}::TIMESTAMPTZ ORDER BY created_at DESC LIMIT 8`,
    sql`SELECT full_name AS name, email, provider, is_premium, created_at, last_login_at, status FROM public.user_profiles
      WHERE created_at >= ${from}::TIMESTAMPTZ AND created_at < ${until}::TIMESTAMPTZ ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT tool_id, MAX(occurred_at) AS last_activity,
      COUNT(*) FILTER (WHERE event_type = 'tool_open')::INTEGER AS opens,
      COUNT(*) FILTER (WHERE event_type = 'tool_start')::INTEGER AS starts,
      COUNT(*) FILTER (WHERE event_type = 'tool_complete')::INTEGER AS successful_jobs,
      COUNT(*) FILTER (WHERE event_type = 'tool_fail')::INTEGER AS failed_jobs,
      COUNT(*) FILTER (WHERE event_type = 'tool_download')::INTEGER AS downloads
      FROM public.tool_analytics_events WHERE occurred_at >= ${from}::TIMESTAMPTZ AND occurred_at < ${until}::TIMESTAMPTZ
      GROUP BY tool_id ORDER BY opens DESC, successful_jobs DESC, tool_id ASC`,
    sql`SELECT event_type, category, COUNT(*)::INTEGER AS count FROM public.auth_events
      WHERE occurred_at >= ${from}::TIMESTAMPTZ AND occurred_at < ${until}::TIMESTAMPTZ
      AND event_type IN ('registration_failure', 'login_failure', 'session_failure') GROUP BY event_type, category ORDER BY count DESC`,
    sql`SELECT source, category, severity, MAX(occurred_at) AS occurred_at, COUNT(*)::INTEGER AS count,
      SUM(COUNT(*)) OVER ()::INTEGER AS total_count FROM public.system_events
      WHERE occurred_at >= ${from}::TIMESTAMPTZ AND occurred_at < ${until}::TIMESTAMPTZ
      AND severity = 'error'
      AND category NOT IN ('configuration_required', 'permission_required', 'authentication_required')
      GROUP BY source, category, severity ORDER BY MAX(occurred_at) DESC LIMIT 50`,
    sql`SELECT id, full_name AS name, email, message, status, created_at FROM public.support_messages
      WHERE created_at >= ${from}::TIMESTAMPTZ AND created_at < ${until}::TIMESTAMPTZ ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT tool_id, event_type, occurred_at FROM public.tool_analytics_events
      WHERE occurred_at >= ${from}::TIMESTAMPTZ AND occurred_at < ${until}::TIMESTAMPTZ ORDER BY occurred_at DESC LIMIT 50`,
    sql`SELECT status, COUNT(*)::INTEGER AS count FROM public.support_messages
      WHERE created_at >= ${from}::TIMESTAMPTZ AND created_at < ${until}::TIMESTAMPTZ GROUP BY status`,
    loadRatingsData(sql, from, until)
  ]);
  const events = eventSummary[0] || {}, summary = userSummary[0] || {};
  const toolAnalytics = buildToolAnalytics(toolRows);
  const errors = systemErrors.map(({ total_count, ...row }) => ({ ...row, count: number(row.count) }));
  return {
    overview: {
      internal: { tool_opens: number(events.opens), tool_runs: number(events.starts), downloads: number(events.downloads), errors: number(events.failures), successful_jobs: number(events.completions) },
      top_tools: toolAnalytics.rows.filter(row=>row.opens || row.starts).sort((a,b)=>b.opens-a.opens || b.successful_jobs-a.successful_jobs).slice(0,20),
      recent_signups: recentSignups, recent_system_errors: errors,
      trend: eventTrend.map(row=>({date:row.date, starts:number(row.starts), completions:number(row.completions), downloads:number(row.downloads), failures:number(row.failures)}))
    },
    users: { summary: { total_accounts:number(summary.total_accounts), signups_today:number(summary.signups_today), signups_7d:number(summary.signups_7d), signups_period:number(summary.signups_period), active_users:number(summary.active_users) }, rows:users },
    toolAnalytics, recentActivity: safeRecentEvents(recentEvents),
    support: { summary:supportSummary.map(row=>({status:row.status,count:number(row.count)})), rows:supportMessages },
    ratings,
    system: { auth_failures:authFailures.map(row=>({...row,count:number(row.count)})), errors, error_count:number(systemErrors[0]?.total_count) }
  };
}

function emptyInternalData() {
  return {
    overview: { internal:null, top_tools:[], recent_signups:[], recent_system_errors:[], trend:[] },
    users: {summary:null,rows:[]}, toolAnalytics:buildToolAnalytics([],false), recentActivity:[],
    support:{summary:null,rows:[]}, ratings:{available:false,reason:'database_unavailable',summary:null,tools:[],reviews:[]}, system:{auth_failures:[],errors:[],error_count:null}
  };
}

export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    requireAdminSession(request);
    const requestUrl = new URL(request.url);
    const requestedRange = requestUrl.searchParams.get('range');
    const customRange = { start: requestUrl.searchParams.get('start'), end: requestUrl.searchParams.get('end') };
    const dateRange = getAdminDateRange(requestedRange, new Date(), customRange);
    const range = dateRange.key;
    const externalPromise = loadAdminIntegrations(range, { customRange });
    let internal = emptyInternalData();
    let database;
    try {
      const { sql } = getDatabaseClient();
      await sql`SELECT 1 AS healthy`;
      const until = new Date(`${dateRange.end}T00:00:00Z`); until.setUTCDate(until.getUTCDate()+1);
      internal = await loadInternalData(sql, `${dateRange.start}T00:00:00.000Z`, until.toISOString());
      database = databaseIntegration('connected','Protected database queries completed successfully.');
    } catch (error) {
      console.error('Admin internal-data query failed:', error?.code || error?.name || 'unknown');
      const category = databaseErrorCategory(error);
      if (category !== 'configuration_required') await recordSystemEvent('admin_database', category);
      database = databaseIntegration(category === 'configuration_required' ? 'configuration_required':'error', category === 'migration_required' ? 'Database migration required.' : category === 'configuration_required' ? 'Netlify Database connection is not configured.' : 'Database unavailable.');
    }
    const external = await externalPromise;
    return jsonResponse({success:true,generated_at:new Date().toISOString(),range,dateRange,integrations:[database,...external.integrations],reports:external.reports,internalSeo:ADMIN_BUILD_STATE,...internal});
  } catch (error) { return adminErrorResponse(error); }
}
