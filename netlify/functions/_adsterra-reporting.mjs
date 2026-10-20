const ADSTERRA_STATS_ENDPOINT = 'https://api3.adsterratools.com/publisher/stats.json';
export const ADSTERRA_WEBSITE_ID = '6091425';
export const ADSTERRA_PLACEMENTS = Object.freeze([
  { id: '31513079', name: 'Native Banner' },
  { id: '31513008', name: 'Banner 160×600' },
  { id: '31513009', name: 'Banner 468×60' },
  { id: '31513010', name: 'Banner 320×50' },
  { id: '31513011', name: 'Banner 728×90' },
  { id: '31513012', name: 'Banner 300×250' },
  { id: '31513013', name: 'Banner 160×300' },
  { id: '31513006', name: 'Popunder' },
  { id: '31513007', name: 'Social Bar' }
]);

const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 120_000;
const reportCache = new Map();
const pendingReports = new Map();
const recentLoadStarts = [];
const MAX_UNCACHED_LOADS_PER_MINUTE = 6;

export class AdsterraReportingError extends Error {
  constructor(message, state = 'api_error', httpStatus = 0) {
    super(message);
    this.name = 'AdsterraReportingError';
    this.state = state;
    this.httpStatus = httpStatus;
  }
}

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const clean = value => String(value ?? '').trim();
const rowList = payload => Array.isArray(payload) ? payload
  : Array.isArray(payload?.items) ? payload.items
    : Array.isArray(payload?.rows) ? payload.rows
      : Array.isArray(payload?.data) ? payload.data
        : [];
const valueOf = (row, names) => {
  for (const name of names) if (row?.[name] !== undefined && row?.[name] !== null) return row[name];
  return null;
};
const metric = (row, names) => finite(valueOf(row, names));
const label = (row, names) => clean(valueOf(row, names));

function statusForResponse(response) {
  if (response.status === 401) return 'authentication_required';
  if (response.status === 403) return 'permission_required';
  if (response.status === 429) return 'rate_limited';
  if (response.status >= 500) return 'api_unavailable';
  return 'api_error';
}

async function requestStats(groupBy, dates, options) {
  const url = new URL(ADSTERRA_STATS_ENDPOINT);
  url.searchParams.set('domain', ADSTERRA_WEBSITE_ID);
  url.searchParams.set('start_date', dates.start);
  url.searchParams.set('finish_date', dates.end);
  url.searchParams.set('group_by', groupBy);
  let response;
  try {
    response = await options.fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-API-Key': options.apiToken },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new AdsterraReportingError('Adsterra reporting could not be reached.', 'api_unavailable');
  }
  if (!response.ok) throw new AdsterraReportingError('Adsterra reporting rejected the request.', statusForResponse(response), response.status);
  try {
    return await response.json();
  } catch {
    throw new AdsterraReportingError('Adsterra reporting returned invalid JSON.', 'api_error', response.status);
  }
}

function normalizeRows(payload, dimension) {
  return rowList(payload).map(row => ({
    [dimension]: label(row, dimension === 'placement' ? ['placement', 'placement_id', 'id'] : dimension === 'domain' ? ['domain', 'domain_id', 'website', 'website_id', 'title'] : [dimension]),
    title: label(row, ['title', 'name', 'placement_name', 'domain_name']),
    impressions: metric(row, ['impressions', 'impression']),
    clicks: metric(row, ['clicks', 'click']),
    ctr: metric(row, ['ctr']),
    cpm: metric(row, ['cpm']),
    revenue: metric(row, ['revenue', 'earnings', 'profit']),
    currency: label(row, ['currency', 'currency_code'])
  }));
}

function aggregate(rows) {
  const sum = key => rows.reduce((total, row) => total + (finite(row[key]) || 0), 0);
  const impressions = sum('impressions');
  const clicks = sum('clicks');
  const revenue = sum('revenue');
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpm: impressions > 0 ? revenue * 1000 / impressions : 0,
    revenue
  };
}

function currencyFrom(payloads, rows) {
  const values = [
    ...payloads.flatMap(payload => [payload?.currency, payload?.currency_code, payload?.meta?.currency, payload?.meta?.currency_code]),
    ...rows.map(row => row.currency)
  ].map(clean).filter(Boolean);
  return values[0] || null;
}

function placementRows(rows) {
  const reported = new Map(rows.map(row => [String(row.placement), row]));
  return ADSTERRA_PLACEMENTS.map(placement => {
    const row = reported.get(placement.id);
    return {
      placement: placement.id,
      title: placement.name,
      impressions: row?.impressions ?? 0,
      clicks: row?.clicks ?? 0,
      ctr: row?.ctr ?? 0,
      cpm: row?.cpm ?? 0,
      revenue: row?.revenue ?? 0,
      reported: Boolean(row)
    };
  }).sort((left, right) => right.revenue - left.revenue || right.impressions - left.impressions || left.title.localeCompare(right.title));
}

function failure(error) {
  const status = error instanceof AdsterraReportingError ? error.state : 'api_error';
  const labels = {
    authentication_required: 'Authentication required',
    permission_required: 'Permission denied',
    rate_limited: 'Rate limited',
    api_unavailable: 'API unavailable',
    api_error: 'Request failed'
  };
  return { status, label: labels[status] || 'Request failed', dataState: null, metrics: null, rows: [], trend: [], groups: {}, currencyCode: null };
}

async function loadUncached(dates, options) {
  const apiToken = clean(options.env?.ADSTERRA_API_TOKEN);
  if (!apiToken) return { status: 'configuration_required', label: 'Reporting not connected', dataState: null, metrics: null, rows: [], trend: [], groups: {}, currencyCode: null };
  try {
    const payloads = await Promise.all(['date', 'placement', 'domain', 'country'].map(groupBy => requestStats(groupBy, dates, { apiToken, fetchImpl: options.fetchImpl })));
    const [dailyPayload, placementPayload, domainPayload, countryPayload] = payloads;
    const trend = normalizeRows(dailyPayload, 'date');
    const rawPlacements = normalizeRows(placementPayload, 'placement');
    const domains = normalizeRows(domainPayload, 'domain');
    const countries = normalizeRows(countryPayload, 'country');
    const sourceRows = trend.length ? trend : rawPlacements.length ? rawPlacements : domains;
    const metrics = aggregate(sourceRows);
    const hasData = [...trend, ...rawPlacements, ...domains, ...countries].some(row => ['impressions', 'clicks', 'revenue'].some(key => (finite(row[key]) || 0) !== 0));
    return {
      status: 'connected',
      label: hasData ? 'Connected' : 'Connected · No Data',
      dataState: hasData ? 'available' : 'no_data',
      metrics,
      rows: placementRows(rawPlacements),
      trend,
      groups: { domains, countries },
      currencyCode: currencyFrom(payloads, [...trend, ...rawPlacements, ...domains, ...countries]),
      dateRange: dates,
      websiteId: ADSTERRA_WEBSITE_ID,
      note: hasData ? null : 'Adsterra authenticated successfully but returned no activity for this website and period.'
    };
  } catch (error) {
    return failure(error);
  }
}

export function getAdsterraIntegrationState(env = process.env, report = null) {
  if (report) {
    const detail = report.dataState === 'no_data'
      ? 'Authenticated reporting succeeded, but no data is available for the selected range.'
      : {
        connected: 'Authenticated publisher reporting request completed successfully.',
        authentication_required: 'The publisher API token was rejected or expired.',
        permission_required: 'The token cannot read publisher statistics.',
        rate_limited: 'Adsterra temporarily rate-limited reporting requests.',
        api_unavailable: 'Adsterra reporting is temporarily unavailable.',
        api_error: 'Adsterra reporting returned an unexpected response.'
      }[report.status] || 'Set ADSTERRA_API_TOKEN in the server environment.';
    return { id: 'adsterra-reporting', name: 'Adsterra Publisher Reporting', installed: true, status: report.status, label: report.label, detail };
  }
  const ready = Boolean(clean(env.ADSTERRA_API_TOKEN));
  return { id: 'adsterra-reporting', name: 'Adsterra Publisher Reporting', installed: true, status: ready ? 'configured_unverified' : 'configuration_required', label: ready ? 'Configured · Connection Pending' : 'Configuration Required', detail: ready ? 'Publisher token is present; live access has not yet been verified.' : 'Set ADSTERRA_API_TOKEN in the server environment.' };
}

export async function loadAdsterraReport(dates, options = {}) {
  const runtime = { env: options.env || process.env, fetchImpl: options.fetchImpl || fetch };
  const useCache = options.cache !== false && !options.env && !options.fetchImpl;
  if (!useCache) return { ...(await loadUncached(dates, runtime)), refreshedAt: new Date().toISOString() };
  const key = `${dates.start}:${dates.end}`;
  const cached = reportCache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.value;
  if (pendingReports.has(key)) return pendingReports.get(key);
  const cutoff = Date.now() - 60_000;
  while (recentLoadStarts.length && recentLoadStarts[0] < cutoff) recentLoadStarts.shift();
  if (recentLoadStarts.length >= MAX_UNCACHED_LOADS_PER_MINUTE) return { ...failure(new AdsterraReportingError('', 'rate_limited', 429)), refreshedAt: new Date().toISOString() };
  recentLoadStarts.push(Date.now());
  const pending = loadUncached(dates, runtime).then(report => {
    const value = { ...report, refreshedAt: new Date().toISOString() };
    reportCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }).finally(() => pendingReports.delete(key));
  pendingReports.set(key, pending);
  return pending;
}

export function resetAdsterraReportingCacheForTests() {
  if (process.env.NODE_ENV === 'production') throw new Error('Adsterra reporting cache test adapter is unavailable in production.');
  reportCache.clear();
  pendingReports.clear();
  recentLoadStarts.length = 0;
}
