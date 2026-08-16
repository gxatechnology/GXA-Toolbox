import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { getAdminDateRange, loadAdminIntegrations, resetAdminIntegrationCacheForTests } from '../netlify/functions/_admin-integrations.mjs';
import { getGoogleServiceAccountCredentials, resetGoogleTokenCacheForTests } from '../netlify/functions/_google-auth.mjs';
import { setDatabaseClientForTests } from '../netlify/functions/_database.mjs';

process.env.NODE_ENV = 'test';
const recordedSystemEvents = [];
setDatabaseClientForTests({ sql: async (strings, ...values) => {
  assert.match(strings.join('$value'), /INSERT INTO public\.system_events/);
  recordedSystemEvents.push({ source: values[0], category: values[1], severity: values[2] });
  return [];
} });

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const serviceAccount = {
  type: 'service_account',
  project_id: 'gxa-toolbox-contract',
  client_email: 'reporting@example.test',
  private_key: privateKeyPem
};
const env = {
  GA4_PROPERTY_ID: '123456789',
  SEARCH_CONSOLE_SITE_URL: 'sc-domain:gxatoolbox.in',
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount),
  ADSENSE_ACCOUNT_ID: 'pub-9226826319752464',
  GOOGLE_ADSENSE_OAUTH_CLIENT_ID: 'oauth-client-id.example.test',
  GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET: 'test-only-client-secret',
  GOOGLE_ADSENSE_REFRESH_TOKEN: 'test-only-refresh-token'
};

const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
let gaRequestCount = 0;
let searchRequestCount = 0;
let adsenseRequestCount = 0;
let tokenRequestCount = 0;

async function fetchMock(url, options = {}) {
  const href = String(url);
  if (href === 'https://oauth2.googleapis.com/token') {
    tokenRequestCount += 1;
    assert.equal(options.method, 'POST');
    assert.ok(options.body instanceof URLSearchParams);
    if (options.body.get('grant_type') === 'refresh_token') {
      assert.equal(options.body.get('client_id'), env.GOOGLE_ADSENSE_OAUTH_CLIENT_ID);
      assert.equal(options.body.get('client_secret'), env.GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET);
      assert.equal(options.body.get('refresh_token'), env.GOOGLE_ADSENSE_REFRESH_TOKEN);
    }
    return json({ access_token: `mock-token-${tokenRequestCount}`, expires_in: 3600 });
  }
  if (href.includes('analyticsdata.googleapis.com')) {
    gaRequestCount += 1;
    assert.match(options.headers.Authorization, /^Bearer mock-token-/);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.dateRanges, [{ startDate: '2026-08-10', endDate: '2026-08-16' }]);
    const dimension = body.dimensions?.[0]?.name;
    if (!dimension) return json({ metricHeaders: ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'engagementRate'].map(name => ({ name })), totals: [{ metricValues: ['12', '5', '18', '42', '14', '0.777'].map(value => ({ value })) }] });
    const metricName = body.metrics[0].name;
    const metricNames = body.metrics.map(item => ({ name: item.name }));
    return json({ dimensionHeaders: [{ name: dimension }], metricHeaders: metricNames, rows: [{ dimensionValues: [{ value: dimension === 'date' ? '20260816' : `sample-${dimension}` }], metricValues: body.metrics.map((_, index) => ({ value: String(index + (metricName === 'screenPageViews' ? 20 : 3)) })) }] });
  }
  if (href.includes('/webmasters/v3/sites/')) {
    searchRequestCount += 1;
    assert.match(decodeURIComponent(href), /sc-domain:gxatoolbox\.in/);
    const body = JSON.parse(options.body);
    assert.equal(body.startDate, '2026-08-10');
    assert.equal(body.endDate, '2026-08-16');
    const key = body.dimensions?.[0];
    return json({ rows: [{ ...(key ? { keys: [key === 'date' ? '2026-08-16' : `sample-${key}`] } : {}), clicks: 9, impressions: 90, ctr: 0.1, position: 4.2 }] });
  }
  if (href.includes('adsense.googleapis.com')) {
    adsenseRequestCount += 1;
    assert.match(href, /accounts\/pub-9226826319752464\/reports:generate/);
    assert.equal(new URL(href).searchParams.get('dateRange'), 'CUSTOM');
    const headers = [
      { name: 'DATE', type: 'DIMENSION' },
      { name: 'ESTIMATED_EARNINGS', type: 'METRIC_CURRENCY', currencyCode: 'USD' },
      { name: 'PAGE_VIEWS', type: 'METRIC_TALLY' },
      { name: 'IMPRESSIONS', type: 'METRIC_TALLY' },
      { name: 'CLICKS', type: 'METRIC_TALLY' },
      { name: 'PAGE_VIEWS_RPM', type: 'METRIC_CURRENCY', currencyCode: 'USD' },
      { name: 'COST_PER_CLICK', type: 'METRIC_CURRENCY', currencyCode: 'USD' }
    ];
    return json({ headers, totals: { cells: [{ value: '' }, { value: '1.25' }, { value: '100' }, { value: '80' }, { value: '4' }, { value: '12.5' }, { value: '0.31' }] }, rows: [{ cells: [{ value: '2026-08-16' }, { value: '1.25' }, { value: '100' }, { value: '80' }, { value: '4' }, { value: '12.5' }, { value: '0.31' }] }] });
  }
  throw new Error(`Unexpected reporting request: ${href}`);
}

resetGoogleTokenCacheForTests();
resetAdminIntegrationCacheForTests();
const connected = await loadAdminIntegrations('7d', { env, fetchImpl: fetchMock, now: new Date('2026-08-16T23:59:00.000Z') });
assert.equal(connected.reports.ga4.status, 'connected');
assert.equal(connected.reports.ga4.metrics.activeUsers, 12);
assert.equal(connected.reports.ga4.groups.devices[0].deviceCategory, 'sample-deviceCategory');
assert.equal(connected.reports.searchConsole.status, 'connected');
assert.equal(connected.reports.searchConsole.metrics.clicks, 9);
assert.equal(connected.reports.searchConsole.groups.pages[0].page, 'sample-page');
assert.equal(connected.reports.adsense.status, 'connected');
assert.equal(connected.reports.adsense.metrics.ESTIMATED_EARNINGS, 1.25);
assert.equal(connected.reports.adsense.currencyCode, 'USD');
assert.equal(gaRequestCount, 6);
assert.equal(searchRequestCount, 4);
assert.equal(adsenseRequestCount, 1);
assert.equal(tokenRequestCount, 3, 'GA4, Search Console, and AdSense must use their intended independent authorization scopes/flows.');
for (const id of ['ga4', 'search-console', 'adsense-reporting']) assert.equal(connected.integrations.find(item => item.id === id).status, 'connected');
assert.ok(connected.integrations.filter(item => ['ga4', 'search-console', 'adsense-reporting'].includes(item.id)).every(item => item.detail === 'Authenticated reporting request completed successfully.'));

assert.deepEqual(getAdminDateRange('today', new Date('2026-08-16T23:59:00.000Z')), { key: 'today', days: 1, start: '2026-08-16', end: '2026-08-16' });
assert.deepEqual(getAdminDateRange('7d', new Date('2026-08-16T00:01:00.000Z')), { key: '7d', days: 7, start: '2026-08-10', end: '2026-08-16' });
assert.deepEqual(getAdminDateRange('28d', new Date('2026-08-16T00:01:00.000Z')), { key: '28d', days: 28, start: '2026-07-20', end: '2026-08-16' });
assert.deepEqual(getAdminDateRange('30d', new Date('2026-08-16T00:01:00.000Z')), { key: '30d', days: 30, start: '2026-07-18', end: '2026-08-16' });
assert.deepEqual(getAdminDateRange('3m', new Date('2026-08-16T00:01:00.000Z')), { key: '3m', days: 90, start: '2026-05-19', end: '2026-08-16' });

const parsedCredentials = getGoogleServiceAccountCredentials({ env });
assert.equal(parsedCredentials.client_email, serviceAccount.client_email);
assert.equal(parsedCredentials.project_id, serviceAccount.project_id);
assert.equal(parsedCredentials.private_key, privateKeyPem.trim());
for (const [name, value] of [
  ['malformed JSON', '{not-json'],
  ['missing client_email', JSON.stringify({ private_key: privateKeyPem })],
  ['missing private_key', JSON.stringify({ client_email: serviceAccount.client_email })]
]) {
  resetGoogleTokenCacheForTests();
  assert.throws(
    () => getGoogleServiceAccountCredentials({ env: { GOOGLE_SERVICE_ACCOUNT_JSON: value } }),
    error => error?.state === 'configuration_required',
    `${name} must be a sanitized configuration error.`
  );
}
resetGoogleTokenCacheForTests();
const escapedNewlineCredentials = getGoogleServiceAccountCredentials({
  env: { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ ...serviceAccount, private_key: privateKeyPem.replace(/\n/g, '\\n') }) }
});
assert.ok(escapedNewlineCredentials.private_key.includes('\n'));
assert.ok(!escapedNewlineCredentials.private_key.includes('\\n'));

resetGoogleTokenCacheForTests();
const missing = await loadAdminIntegrations('30d', { env: {}, fetchImpl: async () => { throw new Error('Network must not be used without configuration.'); } });
for (const report of Object.values(missing.reports)) {
  assert.equal(report.status, 'configuration_required');
  assert.equal(report.metrics, null);
}

const serviceAccountOnly = { GOOGLE_SERVICE_ACCOUNT_JSON: env.GOOGLE_SERVICE_ACCOUNT_JSON };
const missingGaProperty = await loadAdminIntegrations('30d', { env: { ...serviceAccountOnly, SEARCH_CONSOLE_SITE_URL: env.SEARCH_CONSOLE_SITE_URL }, fetchImpl: async () => { throw new Error('GA4 must not make a request without GA4_PROPERTY_ID.'); } });
assert.equal(missingGaProperty.reports.ga4.status, 'configuration_required');
const missingSearchProperty = await loadAdminIntegrations('30d', { env: { ...serviceAccountOnly, GA4_PROPERTY_ID: env.GA4_PROPERTY_ID }, fetchImpl: async url => {
  if (String(url).includes('oauth2.googleapis.com')) return json({ access_token: 'ga-only-token', expires_in: 3600 });
  if (String(url).includes('analyticsdata.googleapis.com')) return json({});
  throw new Error('Search Console must not make a request without SEARCH_CONSOLE_SITE_URL.');
} });
assert.equal(missingSearchProperty.reports.searchConsole.status, 'configuration_required');

resetGoogleTokenCacheForTests();
const noData = await loadAdminIntegrations('today', {
  env: { ...serviceAccountOnly, GA4_PROPERTY_ID: env.GA4_PROPERTY_ID, SEARCH_CONSOLE_SITE_URL: env.SEARCH_CONSOLE_SITE_URL },
  now: new Date('2026-08-16T12:00:00.000Z'),
  fetchImpl: async url => String(url).includes('oauth2.googleapis.com') ? json({ access_token: 'no-data-token', expires_in: 3600 }) : json({})
});
for (const report of [noData.reports.ga4, noData.reports.searchConsole]) {
  assert.equal(report.status, 'connected');
  assert.equal(report.dataState, 'no_data');
  assert.equal(report.label, 'Connected · No Data');
}
assert.deepEqual(noData.reports.ga4.metrics, { activeUsers: 0, newUsers: 0, sessions: 0, screenPageViews: 0, engagedSessions: 0, engagementRate: 0 });
assert.deepEqual(noData.reports.searchConsole.metrics, { clicks: 0, impressions: 0, ctr: 0, position: 0 });

recordedSystemEvents.length = 0;
resetGoogleTokenCacheForTests();
const permission = await loadAdminIntegrations('30d', { env, fetchImpl: async url => String(url).includes('oauth2.googleapis.com') ? json({ error: 'forbidden' }, 403) : json({}, 500) });
for (const report of Object.values(permission.reports)) assert.equal(report.status, 'permission_required');
assert.deepEqual(recordedSystemEvents.map(item => item.source).sort(), ['adsense_api', 'ga4_api', 'search_console_api']);
assert.ok(recordedSystemEvents.every(item => item.category === 'permission_required' && item.severity === 'error'));

recordedSystemEvents.length = 0;
resetGoogleTokenCacheForTests();
const apiError = await loadAdminIntegrations('30d', {
  env: { ...serviceAccountOnly, GA4_PROPERTY_ID: env.GA4_PROPERTY_ID, SEARCH_CONSOLE_SITE_URL: env.SEARCH_CONSOLE_SITE_URL },
  fetchImpl: async url => String(url).includes('oauth2.googleapis.com') ? json({ access_token: 'api-error-token', expires_in: 3600 }) : json({ error: 'unavailable' }, 503)
});
assert.equal(apiError.reports.ga4.status, 'api_error');
assert.equal(apiError.reports.searchConsole.status, 'api_error');
assert.ok(recordedSystemEvents.every(item => item.category === 'api_error'));

resetGoogleTokenCacheForTests();
const partial = await loadAdminIntegrations('7d', {
  env: { ...serviceAccountOnly, GA4_PROPERTY_ID: env.GA4_PROPERTY_ID, SEARCH_CONSOLE_SITE_URL: env.SEARCH_CONSOLE_SITE_URL },
  fetchImpl: async (url, options = {}) => {
    const href = String(url);
    if (href.includes('oauth2.googleapis.com')) {
      const assertion = options.body.get('assertion');
      const claim = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString('utf8'));
      assert.equal(claim.iss, serviceAccount.client_email);
      return json({ access_token: claim.scope.includes('analytics.readonly') ? 'partial-ga-token' : 'partial-search-token', expires_in: 3600 });
    }
    if (href.includes('analyticsdata.googleapis.com')) return json({ error: 'unavailable' }, 503);
    if (href.includes('/webmasters/v3/sites/')) return json({ rows: [{ clicks: 3, impressions: 30, ctr: 0.1, position: 5 }] });
    throw new Error(`Unexpected partial-result request: ${href}`);
  }
});
assert.equal(partial.reports.ga4.status, 'api_error');
assert.equal(partial.reports.searchConsole.status, 'connected');
assert.equal(partial.reports.searchConsole.metrics.clicks, 3);

const moduleSource = await (await import('node:fs/promises')).readFile(new URL('../netlify/functions/_admin-integrations.mjs', import.meta.url), 'utf8');
const googleAuthSource = await (await import('node:fs/promises')).readFile(new URL('../netlify/functions/_google-auth.mjs', import.meta.url), 'utf8');
assert.match(moduleSource, /analyticsdata\.googleapis\.com\/v1beta\/properties/);
assert.match(moduleSource, /googleapis\.com\/webmasters\/v3\/sites/);
assert.match(moduleSource, /adsense\.googleapis\.com\/v2\/accounts/);
assert.match(moduleSource, /Promise\.allSettled/);
assert.match(moduleSource, /REPORT_CACHE_TTL_MS\s*=\s*120_000/);
assert.match(googleAuthSource, /GOOGLE_SERVICE_ACCOUNT_JSON/);
const legacyOauthPrefix = ['GOOGLE', 'OAUTH'].join('_');
assert.ok(!`${moduleSource}\n${googleAuthSource}`.includes(`${legacyOauthPrefix}_`), 'AdSense reporting must use the configured GOOGLE_ADSENSE_* environment names.');
assert.doesNotMatch(moduleSource, /G-E16HBF4R7W|BEGIN PRIVATE KEY|refresh-token/i, 'Reporting source must not embed measurement credentials or OAuth secrets.');

console.log('Admin integrations contract passed: JSON credentials, date ranges, connected/no-data/permission/API states, GA4, Search Console, and AdSense reporting are deterministic and server-only.');
