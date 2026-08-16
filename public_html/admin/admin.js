(() => {
  'use strict';

  const endpoints = Object.freeze({
    login: '/.netlify/functions/admin-login',
    session: '/.netlify/functions/admin-session',
    logout: '/.netlify/functions/admin-logout',
    data: '/.netlify/functions/admin-data'
  });
  const titles = Object.freeze({
    overview: 'Overview',
    analytics: 'Analytics',
    tools: 'Tool Analytics',
    seo: 'SEO / Search Console',
    adsense: 'AdSense',
    users: 'Users',
    system: 'System'
  });
  const state = { section: 'overview', range: '30d', data: null };
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
  const formatNumber = value => Number(value).toLocaleString('en-IN');
  const formatPercent = value => `${(Number(value || 0) * 100).toFixed(1)}%`;
  const formatDecimal = value => Number(value || 0).toFixed(2);
  const formatMoney = (value, currency = 'USD') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
  const formatDate = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available';
  const unavailable = label => `<span class="metric-unavailable">${escapeHtml(label || 'Not Connected')}</span>`;
  const reportMetric = (report, key, formatter = formatNumber) => report.metrics ? formatter(report.metrics[key]) : unavailable(report.label);

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options
    });
    let body = {};
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) {
      const error = new Error(body.message || 'The administration service is unavailable.');
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function showLogin(message = '') {
    byId('admin-app').hidden = true;
    byId('admin-login').hidden = false;
    byId('login-loading').hidden = true;
    byId('admin-login-form').hidden = false;
    byId('login-error').hidden = !message;
    byId('login-error').textContent = message;
    byId('admin-password').value = '';
    window.setTimeout(() => byId('admin-email').focus(), 0);
  }

  function showApp() {
    byId('admin-login').hidden = true;
    byId('admin-app').hidden = false;
  }

  function setBusy(busy, message = '') {
    byId('refresh-data').disabled = busy;
    byId('date-range').disabled = busy;
    byId('dashboard-status').hidden = !busy && !message;
    byId('dashboard-status').textContent = message || (busy ? 'Loading protected dashboard data…' : '');
  }

  function kpi(title, value, source, note = '') {
    return `<article class="kpi-card"><div class="kpi-card-header"><h3>${escapeHtml(title)}</h3><span class="source-pill">${escapeHtml(source)}</span></div><p class="kpi-value">${value}</p><p class="kpi-note">${escapeHtml(note)}</p></article>`;
  }

  function panel(title, description, body) {
    return `<section class="panel"><header class="panel-header"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div></header>${body}</section>`;
  }

  function empty(title, detail) {
    return `<div class="empty-state"><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div></div>`;
  }

  function table(headers, rows) {
    if (!rows.length) return empty('No Data Available', 'No verified records exist for this period.');
    return `<div class="table-wrap"><table><thead><tr>${headers.map(item => `<th scope="col">${escapeHtml(item.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map(item => `<td>${item.render ? item.render(row) : escapeHtml(row[item.key] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function integrationCards() {
    return `<div class="integration-grid">${state.data.integrations.map(item => {
      const className = item.status === 'connected' ? 'connected' : ['error', 'api_error', 'connection_error', 'permission_required'].includes(item.status) ? 'error' : '';
      const detail = item.detail || (item.status === 'configuration_required' ? 'Server-side configuration is required.' : 'Installed code does not confirm reporting access.');
      return `<article class="integration-card"><h4>${escapeHtml(item.name)}</h4><span class="status-chip ${className}">${escapeHtml(item.label)}</span><p>${escapeHtml(detail)}</p></article>`;
    }).join('')}</div>`;
  }

  function overview() {
    const internal = state.data.overview.internal;
    const ga = state.data.reports.ga4;
    const search = state.data.reports.searchConsole;
    const ads = state.data.reports.adsense;
    const cards = [
      kpi(state.range === 'today' ? 'Users Today' : 'Active Users', reportMetric(ga, 'activeUsers'), 'GA4', 'Selected date range'),
      kpi('Page Views', reportMetric(ga, 'screenPageViews'), 'GA4', 'No client-side estimate is substituted'),
      kpi('Tool Runs', internal ? formatNumber(internal.tool_runs) : unavailable('Database unavailable'), 'GXA Analytics', 'Selected date range'),
      kpi('Downloads', internal ? formatNumber(internal.downloads) : unavailable('Database unavailable'), 'GXA Analytics', 'Recorded result downloads'),
      kpi('Search Clicks', reportMetric(search, 'clicks'), 'Search Console', 'Selected date range'),
      kpi('AdSense Earnings', ads.metrics ? formatMoney(ads.metrics.ESTIMATED_EARNINGS, ads.currencyCode || 'USD') : unavailable(ads.label), 'Google AdSense', 'Selected date range'),
      kpi('Errors', internal ? formatNumber(internal.errors) : unavailable('Database unavailable'), 'GXA Analytics', 'Sanitized processing failures')
    ].join('');
    const top = table([
      { label: 'Rank', render: row => String(row.rank) },
      { label: 'Tool', key: 'tool_name' }, { label: 'Category', key: 'category' },
      { label: 'Opens', render: row => formatNumber(row.opens) }, { label: 'Runs', render: row => formatNumber(row.starts) },
      { label: 'Successful', render: row => formatNumber(row.successful_jobs) }, { label: 'Downloads', render: row => formatNumber(row.downloads) }
    ], state.data.overview.top_tools.map((row, index) => ({ ...row, rank: index + 1 })));
    const signups = table([
      { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' }, { label: 'Created', render: row => formatDate(row.created_at) }
    ], state.data.overview.recent_signups);
    const trafficTrend = table([
      { label: 'Date', key: 'date' }, { label: 'Active Users', render: row => formatNumber(row.activeUsers) }, { label: 'Views', render: row => formatNumber(row.screenPageViews) }
    ], ga.trend || []);
    const revenueTrend = table([
      { label: 'Date', key: 'DATE' }, { label: 'Earnings', render: row => formatMoney(row.ESTIMATED_EARNINGS, ads.currencyCode || 'USD') }, { label: 'Views', render: row => formatNumber(row.PAGE_VIEWS) }
    ], ads.trend || []);
    return `<div class="section-stack"><div class="kpi-grid">${cards}</div>${panel('Integration Status', 'Installed code and authenticated reporting connections are shown separately.', integrationCards())}<div class="panel-grid">${panel('Top Performing Tools', 'Real first-party events for the selected period.', top)}${panel('Recent Signups', 'Normal GXA Toolbox accounts only.', signups)}</div><div class="panel-grid">${panel('Traffic Trend', 'Google Analytics authoritative reporting.', trafficTrend)}${panel('Revenue Trend', 'Google AdSense authoritative reporting.', revenueTrend)}</div></div>`;
  }

  function analytics() {
    const report = state.data.reports.ga4;
    const metricCards = [
      ['Active Users', 'activeUsers', formatNumber], ['New Users', 'newUsers', formatNumber], ['Sessions', 'sessions', formatNumber],
      ['Views', 'screenPageViews', formatNumber], ['Engaged Sessions', 'engagedSessions', formatNumber], ['Engagement Rate', 'engagementRate', formatPercent]
    ].map(([label, key, formatter]) => kpi(label, reportMetric(report, key, formatter), 'GA4')).join('');
    const sources = table([{ label: 'Channel', key: 'sessionDefaultChannelGroup' }, { label: 'Sessions', render: row => formatNumber(row.sessions) }], report.groups?.sources || []);
    const countries = table([{ label: 'Country', key: 'country' }, { label: 'Active Users', render: row => formatNumber(row.activeUsers) }], report.groups?.countries || []);
    const devices = table([{ label: 'Device', key: 'deviceCategory' }, { label: 'Active Users', render: row => formatNumber(row.activeUsers) }], report.groups?.devices || []);
    const pages = table([{ label: 'Page', key: 'pagePath' }, { label: 'Views', render: row => formatNumber(row.screenPageViews) }], report.rows || []);
    const trend = table([{ label: 'Date', key: 'date' }, { label: 'Active Users', render: row => formatNumber(row.activeUsers) }, { label: 'Views', render: row => formatNumber(row.screenPageViews) }], report.trend || []);
    const status = report.dataState === 'no_data' ? empty('No GA4 Data Available', 'The authenticated request succeeded, but GA4 returned no data for this date range.') : '';
    return `<div class="section-stack"><p class="section-intro">GA4 reports are requested server-side. GTM installation alone is not treated as a reporting connection.</p>${status}<div class="kpi-grid">${metricCards}</div><div class="panel-grid">${panel('Visitors', 'Google Analytics Data API', trend)}${panel('Traffic Sources', 'Google Analytics Data API', sources)}${panel('Countries', 'Google Analytics Data API', countries)}${panel('Devices', 'Google Analytics Data API', devices)}${panel('Top Pages / Tools', 'Google Analytics Data API', pages)}</div></div>`;
  }

  function tools() {
    const rows = state.data.toolAnalytics.rows;
    const databaseConnected = state.data.integrations.some(item => item.id === 'gxa-database' && item.status === 'connected');
    const summary = rows.reduce((out, row) => ({ opens: out.opens + row.opens, starts: out.starts + row.starts, complete: out.complete + row.successful_jobs, fail: out.fail + row.failed_jobs, downloads: out.downloads + row.downloads }), { opens: 0, starts: 0, complete: 0, fail: 0, downloads: 0 });
    const headers = [
      { label: 'Rank', render: row => String(row.rank) }, { label: 'Tool', key: 'tool_name' }, { label: 'Category', key: 'category' },
      { label: 'Opens', render: row => formatNumber(row.opens) }, { label: 'Runs', render: row => formatNumber(row.starts) },
      { label: 'Successful', render: row => formatNumber(row.successful_jobs) }, { label: 'Failed', render: row => formatNumber(row.failed_jobs) },
      { label: 'Downloads', render: row => formatNumber(row.downloads) }, { label: 'Conversion', render: row => row.conversion_rate === null ? 'Not available' : `${row.conversion_rate}%` }
    ];
    const metric = value => databaseConnected ? formatNumber(value) : unavailable('Database unavailable');
    const trend = table([{ label: 'Date', render: row => formatDate(row.date) }, { label: 'Starts', render: row => formatNumber(row.starts) }, { label: 'Successful', render: row => formatNumber(row.completions) }, { label: 'Downloads', render: row => formatNumber(row.downloads) }, { label: 'Failed', render: row => formatNumber(row.failures) }], state.data.overview.trend || []);
    return `<div class="section-stack"><div class="kpi-grid">${kpi('Tool Opens', metric(summary.opens), 'GXA Analytics')}${kpi('Tool Starts', metric(summary.starts), 'GXA Analytics')}${kpi('Successful Jobs', metric(summary.complete), 'GXA Analytics')}${kpi('Failed Jobs', metric(summary.fail), 'GXA Analytics')}${kpi('Downloads', metric(summary.downloads), 'GXA Analytics')}</div><p class="definition"><strong>Conversion rate:</strong> ${escapeHtml(state.data.toolAnalytics.formula)}. A page view is never counted as a conversion.</p>${panel('Tool Activity Trend', 'First-party events grouped by date for the selected range.', trend)}${panel('Most Used Tools', 'Privacy-minimized first-party events. No file names, contents, OCR text, or stack traces are collected.', table(headers, rows.map((row, index) => ({ ...row, rank: index + 1 }))))}</div>`;
  }

  function seo() {
    const search = state.data.reports.searchConsole;
    const health = state.data.internalSeo;
    const queries = table([{ label: 'Query', key: 'query' }, { label: 'Clicks', render: row => formatNumber(row.clicks) }, { label: 'Impressions', render: row => formatNumber(row.impressions) }, { label: 'CTR', render: row => formatPercent(row.ctr) }, { label: 'Position', render: row => formatDecimal(row.position) }], search.rows || []);
    const pages = table([{ label: 'Page', key: 'page' }, { label: 'Clicks', render: row => formatNumber(row.clicks) }, { label: 'Impressions', render: row => formatNumber(row.impressions) }, { label: 'Position', render: row => formatDecimal(row.position) }], search.groups?.pages || []);
    const trend = table([{ label: 'Date', key: 'date' }, { label: 'Clicks', render: row => formatNumber(row.clicks) }, { label: 'Impressions', render: row => formatNumber(row.impressions) }, { label: 'CTR', render: row => formatPercent(row.ctr) }, { label: 'Position', render: row => formatDecimal(row.position) }], search.trend || []);
    const status = search.dataState === 'no_data' ? empty('No Finalized Search Data Available', search.note || 'Search Console may not yet have finalized data for this date range.') : '';
    const indexedCount = empty('Indexed Page Count Unavailable', 'Indexed page count is not available through this reporting connection. Sitemap and generated-page totals are technical build counts only.');
    return `<div class="section-stack"><p class="section-intro">Google Search Console performance data and the GXA technical SEO build audit are separate sources.</p>${status}<div class="kpi-grid">${kpi('Google Clicks', reportMetric(search, 'clicks'), 'Search Console')}${kpi('Search Impressions', reportMetric(search, 'impressions'), 'Search Console')}${kpi('Average CTR', reportMetric(search, 'ctr', formatPercent), 'Search Console')}${kpi('Average Position', reportMetric(search, 'position', formatDecimal), 'Search Console')}</div>${panel('Search Performance Trend', 'Google Search Console API; recent data can be delayed.', trend)}<div class="panel-grid">${panel('Top Queries', 'Google Search Console API', queries)}${panel('Top Ranking Tools', 'Google Search Console API', pages)}</div>${panel('Google Indexing Status', 'No sitemap count is presented as an indexed-page count.', indexedCount)}${panel('GXA Technical SEO Audit', 'Contract-tested build facts, not Search Console performance or indexing metrics.', `<div class="kpi-grid">${kpi('Registered Tools', formatNumber(health.registeredTools), 'Build Audit')}${kpi('Indexable Tool Pages', formatNumber(health.indexableToolPages), 'Build Audit')}${kpi('Sitemap URLs', formatNumber(health.sitemapUrls), 'Build Audit')}${kpi('Noindex Pages', formatNumber(health.noindexPages), 'Build Audit')}${kpi('Canonical Issues', formatNumber(health.canonicalIssues), 'Build Audit')}${kpi('Broken Internal Links', formatNumber(health.brokenInternalLinks), 'Build Audit')}</div>`)}</div>`;
  }

  function adsense() {
    const ads = state.data.reports.adsense;
    const money = key => ads.metrics ? formatMoney(ads.metrics[key], ads.currencyCode || 'USD') : unavailable(ads.label);
    const trend = table([{ label: 'Date', key: 'DATE' }, { label: 'Earnings', render: row => formatMoney(row.ESTIMATED_EARNINGS, ads.currencyCode || 'USD') }, { label: 'Page Views', render: row => formatNumber(row.PAGE_VIEWS) }, { label: 'Clicks', render: row => formatNumber(row.CLICKS) }], ads.trend || []);
    const status = ads.status === 'connected' ? `<div class="status-message">Authenticated AdSense reporting is connected.</div>` : empty(ads.label, 'Server-side OAuth configuration and account permission are required. No earnings are estimated locally.');
    return `<div class="section-stack"><p class="section-intro">The existing AdSense site code and publisher identity are preserved. Reporting access is a separate server-side integration.</p><div class="kpi-grid">${kpi('Estimated Earnings', money('ESTIMATED_EARNINGS'), 'AdSense API')}${kpi('Page Views', reportMetric(ads, 'PAGE_VIEWS'), 'AdSense API')}${kpi('Ad Impressions', reportMetric(ads, 'IMPRESSIONS'), 'AdSense API')}${kpi('Clicks', reportMetric(ads, 'CLICKS'), 'AdSense API')}${kpi('Page RPM', money('PAGE_VIEWS_RPM'), 'AdSense API')}${kpi('CPC', money('COST_PER_CLICK'), 'AdSense API')}</div>${panel('AdSense Reporting Status', 'Publisher: ca-pub-9226826319752464', status)}${panel('Revenue Trend', 'Selected dashboard date range.', trend)}</div>`;
  }

  function users() {
    const summary = state.data.users.summary;
    const value = key => summary ? formatNumber(summary[key]) : unavailable('Database unavailable');
    const rows = table([
      { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' },
      { label: 'Provider', key: 'provider' }, { label: 'Premium', render: row => row.is_premium ? 'Yes' : 'No' },
      { label: 'Account Created', render: row => formatDate(row.created_at) },
      { label: 'Last Login', render: row => formatDate(row.last_login_at) },
      { label: 'Status', render: row => `<span class="status-chip ${row.status === 'active' ? 'connected' : 'error'}">${escapeHtml(row.status || 'Unknown')}</span>` }
    ], state.data.users.rows);
    return `<div class="section-stack"><p class="section-intro">Normal GXA Toolbox users only. Administrator credentials are never stored in this account database.</p><div class="kpi-grid">${kpi('Total Accounts', value('total_accounts'), 'GXA Database')}${kpi('New Signups Today', value('signups_today'), 'GXA Database')}${kpi('New Signups 7 Days', value('signups_7d'), 'GXA Database')}${kpi('Active Users', value('active_users'), 'GXA Database', 'Based on recorded last login')}</div>${panel('Accounts', 'Password hashes, session tokens, and authentication secrets are never returned.', rows)}</div>`;
  }

  function system() {
    const database = state.data.integrations.find(item => item.id === 'gxa-database');
    const databaseConnected = database.status === 'connected';
    const authRows = table([
      { label: 'Event', key: 'event_type' }, { label: 'Category', key: 'category' }, { label: 'Count', render: row => formatNumber(row.count) }
    ], state.data.system.auth_failures);
    const errors = table([
      { label: 'Source', key: 'source' }, { label: 'Category', key: 'category' }, { label: 'Severity', key: 'severity' }, { label: 'Time', render: row => formatDate(row.occurred_at) }
    ], state.data.system.errors);
    return `<div class="section-stack"><div class="kpi-grid">${kpi('Database Status', escapeHtml(database.label), 'GXA Database', database.detail)}${kpi('Function Errors', databaseConnected ? formatNumber(state.data.system.errors.length) : unavailable('Database unavailable'), 'Sanitized Events')}${kpi('Auth Failures', databaseConnected ? formatNumber(state.data.system.auth_failures.reduce((sum, row) => sum + row.count, 0)) : unavailable('Database unavailable'), 'GXA Authentication')}${kpi('Tool Processing Errors', state.data.overview.internal ? formatNumber(state.data.overview.internal.errors) : unavailable('Database unavailable'), 'GXA Analytics')}</div><div class="panel-grid">${panel('Authentication Failures', 'Only safe categories and counts are retained.', authRows)}${panel('Function & System Errors', 'No stack traces, credentials, environment values, or private paths are returned.', errors)}</div></div>`;
  }

  function renderSection() {
    const renderers = { overview, analytics, tools, seo, adsense, users, system };
    byId('section-title').textContent = titles[state.section];
    byId('dashboard-content').innerHTML = renderers[state.section]();
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.section === state.section));
  }

  async function loadData() {
    setBusy(true);
    try {
      state.data = await api(`${endpoints.data}?range=${encodeURIComponent(state.range)}`);
      showApp();
      byId('dashboard-content').hidden = false;
      byId('data-timestamp').textContent = `Updated ${formatDate(state.data.generated_at)}`;
      renderSection();
      setBusy(false);
    } catch (error) {
      if (error.status === 401) return showLogin('Your administrator session has expired. Sign in again.');
      showApp();
      byId('dashboard-content').hidden = true;
      setBusy(false, error.message);
    }
  }

  function closeDrawer() {
    byId('admin-sidebar').classList.remove('open');
    byId('drawer-backdrop').hidden = true;
    byId('open-drawer').setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function openDrawer() {
    byId('admin-sidebar').classList.add('open');
    byId('drawer-backdrop').hidden = false;
    byId('open-drawer').setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    byId('close-drawer').focus();
  }

  byId('admin-login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    byId('login-error').hidden = true;
    try {
      await api(endpoints.login, { method: 'POST', body: JSON.stringify({ email: byId('admin-email').value, password: byId('admin-password').value }) });
      byId('admin-password').value = '';
      await loadData();
    } catch (error) {
      showLogin(error.message);
    } finally {
      button.disabled = false;
    }
  });

  byId('admin-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-section]');
    if (!button || !state.data) return;
    state.section = button.dataset.section;
    renderSection();
    closeDrawer();
    byId('admin-main').focus();
  });
  byId('date-range').addEventListener('change', event => { state.range = event.target.value; loadData(); });
  byId('refresh-data').addEventListener('click', loadData);
  byId('open-drawer').addEventListener('click', openDrawer);
  byId('close-drawer').addEventListener('click', closeDrawer);
  byId('drawer-backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDrawer(); });
  byId('admin-logout').addEventListener('click', async () => {
    try { await api(endpoints.logout, { method: 'POST' }); } catch { /* Cookie is still cleared whenever the endpoint is reachable. */ }
    state.data = null;
    showLogin();
  });

  api(endpoints.session)
    .then(session => session.authenticated ? loadData() : showLogin())
    .catch(error => showLogin(error.message));
})();
