import assert from 'node:assert/strict';
import { ADSENSE_PUBLISHER_ID } from '../config/adsense-config.mjs';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFile(join(projectRoot, path), 'utf8');

process.env.NODE_ENV = 'test';
process.env.GXA_ADMIN_EMAIL = 'admin.contract@example.test';
process.env.GXA_ADMIN_PASSWORD = 'ContractPassword!2026';
process.env.ADMIN_SESSION_SECRET = 'admin-contract-secret-that-is-longer-than-thirty-two-characters';
for (const name of [
  'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GA4_PROPERTY_ID', 'SEARCH_CONSOLE_SITE_URL', 'ADSENSE_ACCOUNT_ID',
  'GOOGLE_ADSENSE_OAUTH_CLIENT_ID', 'GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET', 'GOOGLE_ADSENSE_REFRESH_TOKEN'
]) delete process.env[name];

const [
  adminAuth,
  { default: loginHandler },
  { default: sessionHandler },
  { default: logoutHandler },
  { default: dataHandler },
  { default: toolEventHandler },
  normalAuth,
  { ADMIN_BUILD_STATE }
] = await Promise.all([
  import('../netlify/functions/_admin-auth.mjs'),
  import('../netlify/functions/admin-login.mjs'),
  import('../netlify/functions/admin-session.mjs'),
  import('../netlify/functions/admin-logout.mjs'),
  import('../netlify/functions/admin-data.mjs'),
  import('../netlify/functions/tool-event.mjs'),
  import('../netlify/functions/_auth.mjs'),
  import('../netlify/functions/_admin-build-state.mjs')
]);

const normalizeStatement = strings => strings.join('$value').replace(/\s+/g, ' ').trim();
const recordedToolEvents = [];
normalAuth.setDatabaseClientForTests({
  sql: async (strings, ...values) => {
    const statement = normalizeStatement(strings);
    if (statement.startsWith('SELECT 1 AS healthy')) return [{ healthy: 1 }];
    if (statement.includes('COUNT(*)::INTEGER AS total_accounts')) {
      return [{ total_accounts: 4, signups_today: 1, signups_7d: 2, active_users: 3 }];
    }
    if (statement.startsWith('SELECT occurred_at::DATE AS date')) {
      return [{ date: '2026-08-14', starts: 6, completions: 5, downloads: 4, failures: 1 }];
    }
    if (statement.includes("COUNT(*) FILTER (WHERE event_type = 'tool_open')") && !statement.includes('GROUP BY tool_id')) {
      return [{ opens: 8, starts: 6, completions: 5, failures: 1, downloads: 4 }];
    }
    if (statement.includes('GROUP BY tool_id')) {
      return [{ tool_id: 'crop-image', tool_name: 'Crop Image', category: 'image', opens: 8, starts: 6, successful_jobs: 5, failed_jobs: 1, downloads: 4 }];
    }
    if (statement.startsWith('SELECT full_name AS name')) {
      return [{ name: 'Normal User', email: 'normal@example.test', created_at: '2026-08-14T00:00:00.000Z' }];
    }
    if (statement.startsWith('SELECT identity_user_id AS id')) {
      return [{ id: 'identity-user-1', name: 'Normal User', email: 'normal@example.test', provider: 'email', is_premium: false, created_at: '2026-08-14T00:00:00.000Z', last_login_at: '2026-08-14T01:00:00.000Z', status: 'active' }];
    }
    if (statement.startsWith('SELECT event_type, category')) return [];
    if (statement.startsWith('SELECT source, category')) return [];
    if (statement.startsWith('SELECT id, full_name AS name')) {
      return [{ id: 9, name: 'Support User', email: 'support@example.test', message: 'A persisted support request.', status: 'new', created_at: '2026-08-14T03:00:00.000Z' }];
    }
    if (statement.startsWith('INSERT INTO public.tool_analytics_events')) {
      recordedToolEvents.push({ event_type: values[0], tool_id: values[1], tool_name: values[2], category: values[3], status: values[4], duration_bucket: values[5] });
      return [];
    }
    throw new Error(`Unexpected admin contract query: ${statement}`);
  }
});

const request = (path, body, cookie = '') => new Request(`https://gxatoolbox.in${path}`, {
  method: 'POST',
  headers: {
    Origin: 'https://gxatoolbox.in',
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {})
  },
  body: JSON.stringify(body)
});

const wrongEmail = await loginHandler(request('/.netlify/functions/admin-login', { email: 'wrong@example.test', password: process.env.GXA_ADMIN_PASSWORD }));
assert.equal(wrongEmail.status, 401);
assert.equal((await wrongEmail.json()).message, 'Invalid email or password.');
const wrongPassword = await loginHandler(request('/.netlify/functions/admin-login', { email: process.env.GXA_ADMIN_EMAIL, password: 'WrongPassword!' }));
assert.equal(wrongPassword.status, 401);
assert.equal((await wrongPassword.json()).message, 'Invalid email or password.');

const login = await loginHandler(request('/.netlify/functions/admin-login', { email: process.env.GXA_ADMIN_EMAIL, password: process.env.GXA_ADMIN_PASSWORD }));
assert.equal(login.status, 200);
const setCookie = login.headers.get('set-cookie');
assert.match(setCookie, /^gxa_admin_session=/);
assert.match(setCookie, /HttpOnly/);
assert.match(setCookie, /Secure/);
assert.match(setCookie, /SameSite=Lax/);
assert.match(setCookie, /Path=\//);
assert.match(setCookie, /Max-Age=64800/);
assert.doesNotMatch(setCookie, new RegExp(process.env.GXA_ADMIN_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
const adminCookie = setCookie.split(';')[0];

const session = await sessionHandler(new Request('https://gxatoolbox.in/.netlify/functions/admin-session', { headers: { Cookie: adminCookie } }));
assert.equal(session.status, 200);
assert.equal((await session.json()).authenticated, true);

const missingSession = await dataHandler(new Request('https://gxatoolbox.in/.netlify/functions/admin-data'));
assert.equal(missingSession.status, 401);
const normalUserRequest = new Request('https://gxatoolbox.in/.netlify/functions/admin-data', { headers: { Cookie: `${normalAuth.SESSION_COOKIE}=identity-session-is-not-an-admin-session` } });
assert.equal((await dataHandler(normalUserRequest)).status, 401, 'A normal user session must never authorize admin data.');

const adminDataResponse = await dataHandler(new Request('https://gxatoolbox.in/.netlify/functions/admin-data?range=7d', { headers: { Cookie: adminCookie } }));
assert.equal(adminDataResponse.status, 200);
const adminData = await adminDataResponse.json();
assert.equal(adminData.success, true);
assert.equal(adminData.overview.internal.tool_runs, 6);
assert.equal(adminData.users.summary.total_accounts, 4);
assert.equal(adminData.reports.ga4.metrics, null);
assert.equal(adminData.reports.searchConsole.metrics, null);
assert.equal(adminData.reports.adsense.metrics, null);
const serializedAdminData = JSON.stringify(adminData);
for (const credentialField of ['private_key', 'client_email', 'access_token', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'ADMIN_SESSION_SECRET', 'GXA_ADMIN_PASSWORD']) {
  assert.ok(!serializedAdminData.includes(credentialField), `Admin reporting response exposes ${credentialField}.`);
}
assert.equal(adminData.integrations.find(item => item.id === 'gtm').containerId, 'GTM-TBQN2SJ4');
assert.equal(adminData.integrations.find(item => item.id === 'gtm').status, 'installed_unverified');
assert.equal(adminData.integrations.find(item => item.id === 'adsense-site-code').publisherId, ADSENSE_PUBLISHER_ID);
assert.equal(adminData.integrations.find(item => item.id === 'netlify-identity').status, 'installed_unverified');
assert.equal(adminData.overview.trend.length, 1);
assert.equal(adminData.support.rows.length, 1);
assert.equal(adminData.support.rows[0].id, 9);

const telemetry = await toolEventHandler(request('/.netlify/functions/tool-event', {
  event_type: 'tool_complete', tool_id: 'crop-image', tool_name: 'Crop Image', tool_category: 'image', status: 'completed', duration_bucket: '1_3s'
}));
assert.equal(telemetry.status, 202);
assert.deepEqual(recordedToolEvents[0], { event_type: 'tool_complete', tool_id: 'crop-image', tool_name: 'Crop Image', category: 'image', status: 'completed', duration_bucket: '1_3s' });
const originlessTelemetry = await toolEventHandler(new Request('https://gxatoolbox.in/.netlify/functions/tool-event', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'tool_open' })
}));
assert.equal(originlessTelemetry.status, 403);

const logout = await logoutHandler(new Request('https://gxatoolbox.in/.netlify/functions/admin-logout', { method: 'POST', headers: { Origin: 'https://gxatoolbox.in', Cookie: adminCookie } }));
assert.equal(logout.status, 200);
assert.match(logout.headers.get('set-cookie'), /^gxa_admin_session=;/);
assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);

const [adminHtml, adminCss, adminJs, migration, analytics, netlify, generator, packageJson, sitemap] = await Promise.all([
  read('public_html/admin/index.html'), read('public_html/admin/admin.css'), read('public_html/admin/admin.js'),
  read('netlify/database/migrations/0003_create_admin_analytics_schema.sql'), read('public_html/assets/gxa-analytics.js'),
  read('netlify.toml'), read('scripts/generate-seo-site.mjs'), read('package.json'), read('dist/sitemap.xml')
]);
assert.match(adminHtml, /GXA Toolbox[\s\S]*Admin Dashboard/);
assert.match(adminHtml, /Secure Administration Portal/);
for (const label of ['Overview', 'Analytics', 'Tool Analytics', 'SEO / Search Console', 'AdSense', 'Users', 'Support Messages', 'System', 'Administrator', 'Logout']) assert.ok(adminHtml.includes(label), `Admin navigation is missing ${label}.`);
assert.match(adminHtml, /<img src="\/gxa-logo\.png"/);
assert.match(adminHtml, /<meta name="robots" content="noindex, nofollow, noarchive">/);
assert.doesNotMatch(adminHtml + adminJs, /googletagmanager\.com|googlesyndication\.com|adsbygoogle|gtag\s*\(/i, 'Private admin assets must not load public advertising or tracking code.');
assert.doesNotMatch(adminHtml, /<input[^>]+(?:name="email"|name="password")[^>]+value=/i, 'Admin credentials must not be prefilled.');
assert.match(adminCss, /@media \(max-width: 900px\)/);
assert.match(adminCss, /min-height: 100dvh/);
assert.match(adminCss, /env\(safe-area-inset-bottom\)/);
assert.match(adminJs, /credentials: 'same-origin'/);
assert.match(adminJs, /reportMetric\(ga, 'activeUsers'\)/);
assert.match(adminJs, /reportMetric\(search, 'clicks'\)/);
assert.match(adminJs, /ESTIMATED_EARNINGS/);
assert.match(adminJs, /Search Performance Trend/);
assert.match(adminJs, /Indexed page count is not available through this reporting connection\./i);
assert.match(adminJs, /state\.range === 'today' \? 'Users Today' : 'Active Users'/);
assert.match(adminJs, /api_error/);
assert.doesNotMatch(adminJs, /localStorage|sessionStorage/);
for (const token of ['tool_analytics_events', 'auth_events', 'system_events', 'last_login_at']) assert.ok(migration.includes(token), `Analytics migration is missing ${token}.`);
assert.doesNotMatch(migration, /DROP\s+(?:TABLE|SCHEMA|DATABASE)/i);
const executableMigration = migration.replace(/^--.*$/gm, '');
assert.doesNotMatch(executableMigration, /file_name|file_content|ocr_text|password|session_token|ip_address|user_agent/i);
for (const eventName of ['tool_open', 'tool_start', 'tool_complete', 'tool_fail', 'tool_download']) assert.ok(analytics.includes(eventName), `Client analytics is missing ${eventName}.`);
const executableAnalytics = analytics.replace(/\/\*[\s\S]*?\*\//g, '');
assert.doesNotMatch(executableAnalytics, /filename|file_name|ocr_text|stack_trace|user_agent|password/i);
assert.match(netlify, /from\s*=\s*"\/admin"[\s\S]*to\s*=\s*"\/admin\/"/);
assert.match(netlify, /for\s*=\s*"\/admin\/\*"[\s\S]*X-Robots-Tag\s*=\s*"noindex, nofollow, noarchive"/);
assert.match(generator, /\['index\.html', 'admin\.css', 'admin\.js'\]/);
assert.doesNotMatch(generator, /cp\([^\n]*public_html[^\n]*admin[^\n]*recursive:\s*true/i, 'The generator must not copy the legacy PHP admin source.');
for (const file of ['index.html', 'admin.css', 'admin.js']) assert.equal((await stat(join(projectRoot, 'dist', 'admin', file))).isFile(), true);
await assert.rejects(stat(join(projectRoot, 'dist', 'admin', 'index.php')));
assert.doesNotMatch(await read('dist/admin/index.html'), /<\?php|GXA_ADMIN_PASSWORD|ADMIN_SESSION_SECRET/);
assert.match(packageJson, /admin-panel-contract\.mjs/);

const tools = await loadToolRegistry();
assert.ok(tools.length >= 90, 'The admin build audit unexpectedly lost registered tools.');
assert.equal(ADMIN_BUILD_STATE.registeredTools, tools.length);
assert.equal(ADMIN_BUILD_STATE.indexableToolPages, tools.length - 1);
assert.equal(ADMIN_BUILD_STATE.sitemapUrls, (sitemap.match(/<url>/g) || []).length);
assert.equal(ADMIN_BUILD_STATE.noindexPages, 3);
assert.equal(ADMIN_BUILD_STATE.canonicalIssues, 0);
assert.equal(ADMIN_BUILD_STATE.brokenInternalLinks, 0);

for (const publicSource of [adminHtml, adminJs, await read('dist/admin/index.html'), await read('dist/admin/admin.js')]) {
  assert.ok(!publicSource.includes(process.env.GXA_ADMIN_EMAIL));
  assert.ok(!publicSource.includes(process.env.GXA_ADMIN_PASSWORD));
  assert.ok(!publicSource.includes(process.env.ADMIN_SESSION_SECRET));
}

console.log('Admin panel contract passed: separate signed access, protected real data, privacy-minimized analytics, responsive static shell, and no public secrets.');
