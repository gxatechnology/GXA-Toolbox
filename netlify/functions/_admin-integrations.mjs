import { getRefreshTokenAccessToken, getServiceAccountAccessToken, GoogleIntegrationError } from './_google-auth.mjs';
import { recordSystemEvent } from './_database.mjs';
import { ADSENSE_PUBLISHER_ID } from '../../config/adsense-config.mjs';

const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const SEARCH_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const RANGE_DAYS = Object.freeze({ today: 1, '7d': 7, '28d': 28, '30d': 30, '3m': 90 });
const REQUEST_TIMEOUT_MS = 10_000;
const REPORT_CACHE_TTL_MS = 120_000;
const reportCache = new Map();
const number = value => Number(value) || 0;
const text = value => String(value || '').trim();
const configured = (env, names) => names.every(name => Boolean(text(env[name])));
const serviceAccountConfigured = env => Boolean(text(env.GOOGLE_SERVICE_ACCOUNT_JSON))
  || configured(env, ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY']);

function integration(id, name, requiredEnvironment, env, readyOverride) {
  const ready = readyOverride ?? configured(env, requiredEnvironment);
  return {
    id, name, installed: true,
    status: ready ? 'configured_unverified' : 'configuration_required',
    label: ready ? 'Configured · Connection Pending' : 'Configuration Required'
  };
}

export function getGoogleIntegrationStates(env = process.env) {
  return [
    integration('ga4', 'Google Analytics 4', ['GA4_PROPERTY_ID', 'GOOGLE_SERVICE_ACCOUNT_JSON'], env, configured(env, ['GA4_PROPERTY_ID']) && serviceAccountConfigured(env)),
    integration('search-console', 'Google Search Console', ['SEARCH_CONSOLE_SITE_URL', 'GOOGLE_SERVICE_ACCOUNT_JSON'], env, configured(env, ['SEARCH_CONSOLE_SITE_URL']) && serviceAccountConfigured(env)),
    integration('adsense-reporting', 'Google AdSense Reporting', ['ADSENSE_ACCOUNT_ID', 'GOOGLE_ADSENSE_OAUTH_CLIENT_ID', 'GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET', 'GOOGLE_ADSENSE_REFRESH_TOKEN'], env),
    { id: 'gtm', name: 'Google Tag Manager', installed: true, status: 'installed_unverified', label: 'Installed · Reporting Unverified', containerId: 'GTM-TBQN2SJ4' },
    { id: 'adsense-site-code', name: 'Google AdSense Site Code', installed: true, status: 'installed_unverified', label: 'Installed · Approval External', publisherId: ADSENSE_PUBLISHER_ID },
    { id: 'netlify-identity', name: 'Netlify Identity', installed: true, status: 'installed_unverified', label: 'Installed · Provider Status External' }
  ];
}

export function getAdminDateRange(range, now = new Date()) {
  const days = RANGE_DAYS[range] || 30;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const iso = date => date.toISOString().slice(0, 10);
  return { key: Object.hasOwn(RANGE_DAYS, range) ? range : '30d', days, start: iso(start), end: iso(end) };
}

async function googleJson(url, options, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new GoogleIntegrationError('Google reporting could not be reached.');
  }
  if (!response.ok) {
    const state = response.status === 401 || response.status === 403 ? 'permission_required' : 'api_error';
    throw new GoogleIntegrationError('Google reporting rejected the request.', state, response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new GoogleIntegrationError('Google reporting returned an invalid response.', 'api_error', response.status);
  }
}

function reportFailure(error, fallback) {
  const status = error instanceof GoogleIntegrationError ? error.state : 'api_error';
  const labels = { configuration_required: 'Configuration Required', permission_required: 'Permission Required', api_error: 'Error' };
  return { status, label: labels[status] || fallback, dataState: null, metrics: null, rows: [], trend: [], groups: {} };
}

function metricValues(report, expectedNames = []) {
  const headers = (report.metricHeaders || []).map(item => item.name);
  const values = report.totals?.[0]?.metricValues || report.rows?.[0]?.metricValues || [];
  return Object.fromEntries([...new Set([...expectedNames, ...headers])].map(name => {
    const index = headers.indexOf(name);
    return [name, index >= 0 ? number(values[index]?.value) : 0];
  }));
}

function connectedReport(payload, hasData) {
  return {
    status: 'connected',
    label: hasData ? 'Connected' : 'Connected · No Data',
    dataState: hasData ? 'available' : 'no_data',
    ...payload
  };
}

function rowsWithDimensions(report) {
  const dimensions = (report.dimensionHeaders || []).map(item => item.name);
  const metrics = (report.metricHeaders || []).map(item => item.name);
  return (report.rows || []).map(row => ({
    ...Object.fromEntries(dimensions.map((name, index) => [name, row.dimensionValues?.[index]?.value || ''])),
    ...Object.fromEntries(metrics.map((name, index) => [name, number(row.metricValues?.[index]?.value)]))
  }));
}

async function loadGa4(range, options) {
  const env = options.env;
  if (!configured(env, ['GA4_PROPERTY_ID']) || !serviceAccountConfigured(env)) return reportFailure(new GoogleIntegrationError('', 'configuration_required'), 'Google Analytics not connected.');
  try {
    const accessToken = await getServiceAccountAccessToken([GA4_SCOPE], options);
    const property = text(env.GA4_PROPERTY_ID).replace(/^properties\//, '');
    const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(property)}:runReport`;
    const dates = getAdminDateRange(range, options.now);
    const request = body => googleJson(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: dates.start, endDate: dates.end }], limit: '25', ...body })
    }, options.fetchImpl);
    const metricNames = ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'engagementRate'];
    const metrics = metricNames.map(name => ({ name }));
    const [summary, trend, sources, countries, devices, pages] = await Promise.all([
      request({ metrics, metricAggregations: ['TOTAL'] }),
      request({ dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      request({ dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
      request({ dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }),
      request({ dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }),
      request({ dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }] })
    ]);
    const mappedMetrics = metricValues(summary, metricNames);
    const hasData = Object.values(mappedMetrics).some(value => value !== 0)
      || [trend, sources, countries, devices, pages].some(report => report.rows?.length);
    return connectedReport({
      metrics: mappedMetrics,
      rows: rowsWithDimensions(pages),
      trend: rowsWithDimensions(trend),
      groups: { sources: rowsWithDimensions(sources), countries: rowsWithDimensions(countries), devices: rowsWithDimensions(devices) },
      dateRange: dates
    }, hasData);
  } catch (error) {
    await recordSystemEvent('ga4_api', error?.state || 'api_error');
    return reportFailure(error, 'Google Analytics not connected.');
  }
}

async function searchQuery(siteUrl, accessToken, dates, body, fetchImpl) {
  return googleJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: dates.start, endDate: dates.end, rowLimit: 25, ...body })
  }, fetchImpl);
}

function searchRows(report, keyName) {
  return (report.rows || []).map(row => ({ [keyName]: row.keys?.[0] || '', clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), position: number(row.position) }));
}

async function loadSearchConsole(range, options) {
  const env = options.env;
  if (!configured(env, ['SEARCH_CONSOLE_SITE_URL']) || !serviceAccountConfigured(env)) return reportFailure(new GoogleIntegrationError('', 'configuration_required'), 'Google Search Console not connected.');
  try {
    const accessToken = await getServiceAccountAccessToken([SEARCH_SCOPE], options);
    const dates = getAdminDateRange(range, options.now);
    const [summary, trend, queries, pages] = await Promise.all([
      searchQuery(text(env.SEARCH_CONSOLE_SITE_URL), accessToken, dates, {}, options.fetchImpl),
      searchQuery(text(env.SEARCH_CONSOLE_SITE_URL), accessToken, dates, { dimensions: ['date'] }, options.fetchImpl),
      searchQuery(text(env.SEARCH_CONSOLE_SITE_URL), accessToken, dates, { dimensions: ['query'] }, options.fetchImpl),
      searchQuery(text(env.SEARCH_CONSOLE_SITE_URL), accessToken, dates, { dimensions: ['page'] }, options.fetchImpl)
    ]);
    const first = summary.rows?.[0] || {};
    const hasData = [summary, trend, queries, pages].some(report => report.rows?.length);
    return connectedReport({
      metrics: { clicks: number(first.clicks), impressions: number(first.impressions), ctr: number(first.ctr), position: number(first.position) },
      rows: searchRows(queries, 'query'),
      trend: searchRows(trend, 'date'),
      groups: { pages: searchRows(pages, 'page') },
      dateRange: dates,
      note: hasData ? null : 'No finalized Search Console data is available for this date range yet.'
    }, hasData);
  } catch (error) {
    await recordSystemEvent('search_console_api', error?.state || 'api_error');
    return reportFailure(error, 'Google Search Console not connected.');
  }
}

function adsenseCells(report, cells) {
  return Object.fromEntries((report.headers || []).map((header, index) => [header.name, header.type === 'DIMENSION' ? (cells?.[index]?.value || '') : number(cells?.[index]?.value)]));
}

async function loadAdsense(range, options) {
  const env = options.env;
  if (!configured(env, ['ADSENSE_ACCOUNT_ID', 'GOOGLE_ADSENSE_OAUTH_CLIENT_ID', 'GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET', 'GOOGLE_ADSENSE_REFRESH_TOKEN'])) return reportFailure(new GoogleIntegrationError('', 'configuration_required'), 'AdSense Reporting Not Connected');
  try {
    const accessToken = await getRefreshTokenAccessToken(options);
    const account = text(env.ADSENSE_ACCOUNT_ID).replace(/^accounts\//, '');
    const dates = getAdminDateRange(range, options.now);
    const url = new URL(`https://adsense.googleapis.com/v2/accounts/${encodeURIComponent(account)}/reports:generate`);
    url.searchParams.set('dateRange', 'CUSTOM');
    for (const [part, value] of Object.entries({ year: dates.start.slice(0, 4), month: Number(dates.start.slice(5, 7)), day: Number(dates.start.slice(8, 10)) })) url.searchParams.set(`startDate.${part}`, value);
    for (const [part, value] of Object.entries({ year: dates.end.slice(0, 4), month: Number(dates.end.slice(5, 7)), day: Number(dates.end.slice(8, 10)) })) url.searchParams.set(`endDate.${part}`, value);
    url.searchParams.append('dimensions', 'DATE');
    for (const metric of ['ESTIMATED_EARNINGS', 'PAGE_VIEWS', 'IMPRESSIONS', 'CLICKS', 'PAGE_VIEWS_RPM', 'COST_PER_CLICK']) url.searchParams.append('metrics', metric);
    url.searchParams.set('orderBy', '+DATE');
    const report = await googleJson(url, { headers: { Authorization: `Bearer ${accessToken}` } }, options.fetchImpl);
    const metrics = adsenseCells(report, report.totals?.cells || []);
    const rows = (report.rows || []).map(row => adsenseCells(report, row.cells));
    return connectedReport({ metrics, rows, trend: rows, groups: {}, currencyCode: report.headers?.find(item => item.currencyCode)?.currencyCode || null, dateRange: dates }, rows.length > 0 || Object.values(metrics).some(value => number(value) !== 0));
  } catch (error) {
    await recordSystemEvent('adsense_api', error?.state || 'api_error');
    return reportFailure(error, 'AdSense Reporting Not Connected');
  }
}

function reconcileIntegrations(states, reports) {
  const reportById = { ga4: reports.ga4, 'search-console': reports.searchConsole, 'adsense-reporting': reports.adsense };
  const details = {
    connected: 'Authenticated reporting request completed successfully.',
    configuration_required: 'Required server-side environment variables are missing.',
    permission_required: 'Configured Google identity does not have the required reporting permission.',
    api_error: 'The reporting service could not complete the request.'
  };
  return states.map(item => reportById[item.id] ? {
    ...item,
    status: reportById[item.id].status,
    label: reportById[item.id].label,
    detail: reportById[item.id].dataState === 'no_data'
      ? 'Authenticated reporting succeeded, but no data is available for the selected range.'
      : details[reportById[item.id].status]
  } : item);
}

async function loadUncachedAdminIntegrations(range, options) {
  const runtime = { env: options.env || process.env, fetchImpl: options.fetchImpl || fetch, now: options.now };
  const settled = await Promise.allSettled([
    loadGa4(range, runtime),
    loadSearchConsole(range, runtime),
    loadAdsense(range, runtime)
  ]);
  const [ga4, searchConsole, adsense] = settled.map(result => result.status === 'fulfilled'
    ? result.value
    : reportFailure(result.reason, 'Reporting Error'));
  const reports = { ga4, searchConsole, adsense };
  return { reports, integrations: reconcileIntegrations(getGoogleIntegrationStates(runtime.env), reports) };
}

export async function loadAdminIntegrations(range, options = {}) {
  const rangeKey = Object.hasOwn(RANGE_DAYS, range) ? range : '30d';
  const useProductionCache = options.cache !== false && !options.env && !options.fetchImpl && !options.now;
  if (!useProductionCache) return loadUncachedAdminIntegrations(rangeKey, options);

  const cached = reportCache.get(rangeKey);
  if (cached?.expiresAt > Date.now()) return cached.value;
  const value = await loadUncachedAdminIntegrations(rangeKey, options);
  reportCache.set(rangeKey, { value, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
  return value;
}

export function resetAdminIntegrationCacheForTests() {
  if (process.env.NODE_ENV === 'production') throw new Error('Admin integration cache test adapter is unavailable in production.');
  reportCache.clear();
}
