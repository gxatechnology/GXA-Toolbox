import assert from 'node:assert/strict';
import {
  ADSTERRA_PLACEMENTS,
  ADSTERRA_WEBSITE_ID,
  getAdsterraIntegrationState,
  loadAdsterraReport,
  resetAdsterraReportingCacheForTests
} from '../netlify/functions/_adsterra-reporting.mjs';
import { getAdminDateRange } from '../netlify/functions/_admin-integrations.mjs';

process.env.NODE_ENV = 'test';
resetAdsterraReportingCacheForTests();
const dates = { start: '2026-10-01', end: '2026-10-07' };
const token = 'test-only-adsterra-publisher-token';
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type':'application/json' } });

let calls = [];
const connected = await loadAdsterraReport(dates, {
  cache: false,
  env: { ADSTERRA_API_TOKEN: token },
  fetchImpl: async (url, options) => {
    const requestUrl = new URL(url);
    calls.push({ requestUrl, options });
    assert.equal(requestUrl.origin + requestUrl.pathname, 'https://api3.adsterratools.com/publisher/stats.json');
    assert.equal(requestUrl.searchParams.get('domain'), ADSTERRA_WEBSITE_ID);
    assert.equal(requestUrl.searchParams.get('start_date'), dates.start);
    assert.equal(requestUrl.searchParams.get('finish_date'), dates.end);
    assert.equal(options.method, 'GET');
    assert.equal(options.headers['X-API-Key'], token);
    assert.equal(options.headers.Accept, 'application/json');
    const group = requestUrl.searchParams.get('group_by');
    if (group === 'date') return json([{ date:'2026-10-01', impressions:1000, clicks:25, ctr:0.025, cpm:2.5, revenue:2.5, currency:'USD' }]);
    if (group === 'placement') return json([{ placement:'31513011', impressions:1000, clicks:25, ctr:0.025, cpm:2.5, revenue:2.5, currency:'USD' }]);
    if (group === 'domain') return json([{ domain:'6091425', title:'gxatoolbox.in', impressions:1000, clicks:25, revenue:2.5, currency:'USD' }]);
    if (group === 'country') return json([{ country:'IN', impressions:800, clicks:20, revenue:2, currency:'USD' }]);
    throw new Error(`Unexpected group: ${group}`);
  }
});
assert.equal(calls.length, 4);
assert.equal(connected.status, 'connected');
assert.equal(connected.dataState, 'available');
assert.deepEqual(connected.metrics, { impressions:1000, clicks:25, ctr:0.025, cpm:2.5, revenue:2.5 });
assert.equal(connected.currencyCode, 'USD');
assert.equal(connected.rows.length, ADSTERRA_PLACEMENTS.length);
assert.equal(connected.rows.find(row => row.placement === '31513011').reported, true);
assert.equal(connected.rows.find(row => row.placement === '31513010').reported, false);
assert.equal(connected.rows.find(row => row.placement === '31513010').impressions, 0);
assert.equal(connected.groups.countries[0].country, 'IN');
assert.equal(getAdsterraIntegrationState({ ADSTERRA_API_TOKEN: token }, connected).status, 'connected');

let fetched = false;
const missing = await loadAdsterraReport(dates, { cache:false, env:{}, fetchImpl:async()=>{fetched=true;throw new Error('must not fetch');} });
assert.equal(missing.status, 'configuration_required');
assert.equal(fetched, false);
assert.equal(getAdsterraIntegrationState({}).status, 'configuration_required');

for (const [httpStatus, expected] of [[401,'authentication_required'],[403,'permission_required'],[429,'rate_limited'],[503,'api_unavailable'],[400,'api_error']]) {
  const report = await loadAdsterraReport(dates, { cache:false, env:{ADSTERRA_API_TOKEN:token}, fetchImpl:async()=>json({message:'private provider detail'},httpStatus) });
  assert.equal(report.status, expected);
  assert.doesNotMatch(JSON.stringify(report), /private provider detail|test-only-adsterra-publisher-token/);
}

const empty = await loadAdsterraReport(dates, { cache:false, env:{ADSTERRA_API_TOKEN:token}, fetchImpl:async()=>json([]) });
assert.equal(empty.status, 'connected');
assert.equal(empty.dataState, 'no_data');
assert.equal(empty.rows.length, ADSTERRA_PLACEMENTS.length);
assert.ok(empty.rows.every(row => row.impressions === 0 && row.reported === false));

assert.deepEqual(getAdminDateRange('custom', new Date('2026-10-20T12:00:00Z'), { start:'2026-09-01', end:'2026-10-20' }), { key:'custom', days:50, start:'2026-09-01', end:'2026-10-20' });
for (const custom of [{start:'',end:'2026-10-20'},{start:'2026-02-30',end:'2026-10-20'},{start:'2026-10-21',end:'2026-10-20'},{start:'2025-01-01',end:'2026-10-20'},{start:'2026-10-01',end:'2026-10-21'}]) {
  assert.throws(() => getAdminDateRange('custom', new Date('2026-10-20T12:00:00Z'), custom), error => error.code === 'invalid_date_range' && error.status === 400);
}

const source = JSON.stringify({ connected, missing });
assert.doesNotMatch(source, /X-API-Key|ADSTERRA_API_TOKEN|test-only-adsterra-publisher-token/);
console.log('Adsterra admin integration contract passed: protected token use, four report groups, status diagnostics, zero-activity units, and custom ranges.');
