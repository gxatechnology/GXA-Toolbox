import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png' };
const report = (status, label, metrics = null, rows = [], groups = {}, trend = []) => ({ status, label, metrics, rows, groups, trend });
const fixture = {
  success: true, generated_at: new Date().toISOString(), range: '30d',
  integrations: [
    { id: 'gxa-database', name: 'GXA Database', status: 'connected', label: 'Connected', detail: 'Browser QA fixture.' },
    { id: 'ga4', name: 'Google Analytics 4', status: 'connected', label: 'Connected' },
    { id: 'search-console', name: 'Google Search Console', status: 'connected', label: 'Connected' },
    { id: 'adsense-reporting', name: 'Google AdSense Reporting', status: 'connected', label: 'Connected' },
    { id: 'gtm', name: 'Google Tag Manager', status: 'installed_unverified', label: 'Installed · Reporting Unverified' }
  ],
  reports: {
    ga4: report('connected', 'Connected', { activeUsers: 12, newUsers: 5, sessions: 18, screenPageViews: 42, engagedSessions: 14, engagementRate: 0.77 }, [{ pagePath: '/crop-image/', screenPageViews: 20 }], { sources: [{ sessionDefaultChannelGroup: 'Organic Search', sessions: 10 }], countries: [{ country: 'India', activeUsers: 9 }], devices: [{ deviceCategory: 'mobile', activeUsers: 8 }] }, [{ date: '20260816', activeUsers: 12, screenPageViews: 42 }]),
    searchConsole: report('connected', 'Connected', { clicks: 9, impressions: 90, ctr: 0.1, position: 4.2 }, [{ query: 'crop image', clicks: 5, impressions: 40, ctr: 0.125, position: 3.8 }], { pages: [{ page: '/crop-image/', clicks: 5, impressions: 40, ctr: 0.125, position: 3.8 }] }),
    adsense: { ...report('connected', 'Connected', { ESTIMATED_EARNINGS: 1.25, PAGE_VIEWS: 100, IMPRESSIONS: 80, CLICKS: 4, PAGE_VIEWS_RPM: 12.5, COST_PER_CLICK: 0.31 }, [], {}, [{ DATE: '2026-08-16', ESTIMATED_EARNINGS: 1.25, PAGE_VIEWS: 100, CLICKS: 4 }]), currencyCode: 'USD' }
  },
  internalSeo: { registeredTools: 92, indexableToolPages: 91, sitemapUrls: 98, noindexPages: 3, canonicalIssues: 0, brokenInternalLinks: 0 },
  overview: { internal: { tool_runs: 6, downloads: 4, errors: 1, successful_jobs: 5 }, top_tools: [{ tool_name: 'Crop Image', category: 'image', opens: 8, starts: 6, successful_jobs: 5, downloads: 4 }], recent_signups: [{ name: 'QA User', email: 'qa@example.test', created_at: '2026-08-16T00:00:00Z' }], trend: [{ date: '2026-08-16', starts: 6, completions: 5, downloads: 4, failures: 1 }] },
  users: { summary: { total_accounts: 4, signups_today: 1, signups_7d: 2, active_users: 3 }, rows: [{ name: 'QA User', email: 'qa@example.test', provider: 'email', is_premium: false, created_at: '2026-08-16T00:00:00Z', last_login_at: '2026-08-16T01:00:00Z', status: 'active' }] },
  toolAnalytics: { formula: 'Successful Tool Completions / Tool Starts × 100', rows: [{ tool_name: 'Crop Image', category: 'image', opens: 8, starts: 6, successful_jobs: 5, failed_jobs: 1, downloads: 4, conversion_rate: 83.3 }] },
  system: { auth_failures: [], errors: [] }
};

function json(response, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.byteLength, 'Cache-Control': 'no-store' });
  response.end(body);
}

createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
  if (pathname.endsWith('/admin-session')) return json(response, { success: true, authenticated: true });
  if (pathname.endsWith('/admin-data')) return json(response, fixture);
  if (pathname.endsWith('/admin-logout')) return json(response, { success: true });
  const relative = pathname === '/admin/' ? 'admin/index.html' : pathname.replace(/^\//, '');
  const file = join(root, relative);
  try {
    if (!(await stat(file)).isFile()) throw new Error('not found');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': body.byteLength, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(Number(process.env.GXA_ADMIN_QA_PORT || 4174), '127.0.0.1', () => console.log('GXA Admin browser QA fixture running at http://127.0.0.1:4174/admin/'));
