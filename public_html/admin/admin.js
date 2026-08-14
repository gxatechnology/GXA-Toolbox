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
  const formatDate = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available';
  const unavailable = label => `<span class="metric-unavailable">${escapeHtml(label || 'Not Connected')}</span>`;

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
      const className = item.status === 'connected' ? 'connected' : item.status === 'error' ? 'error' : '';
      const detail = item.detail || (item.requiredEnvironment?.length ? 'Server-side configuration is required.' : 'Installed code does not confirm reporting access.');
      return `<article class="integration-card"><h4>${escapeHtml(item.name)}</h4><span class="status-chip ${className}">${escapeHtml(item.label)}</span><p>${escapeHtml(detail)}</p></article>`;
    }).join('')}</div>`;
  }

  function overview() {
    const internal = state.data.overview.internal;
    const ga = state.data.reports.ga4;
    const search = state.data.reports.searchConsole;
    const ads = state.data.reports.adsense;
    const cards = [
      kpi('Users Today', unavailable(ga.label), 'GA4', 'Authoritative GA4 reporting metric'),
      kpi('Page Views', unavailable(ga.label), 'GA4', 'No client-side estimate is substituted'),
      kpi('Tool Runs', internal ? formatNumber(internal.tool_runs) : unavailable('Database unavailable'), 'GXA Analytics', 'Selected date range'),
      kpi('Downloads', internal ? formatNumber(internal.downloads) : unavailable('Database unavailable'), 'GXA Analytics', 'Recorded result downloads'),
      kpi('Search Clicks', unavailable(search.label), 'Search Console', 'Reporting API required'),
      kpi('AdSense Earnings', unavailable(ads.label), 'Google AdSense', 'Reporting API required'),
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
    return `<div class="section-stack"><div class="kpi-grid">${cards}</div>${panel('Integration Status', 'Installed code and authenticated reporting connections are shown separately.', integrationCards())}<div class="panel-grid">${panel('Top Performing Tools', 'Real first-party events for the selected period.', top)}${panel('Recent Signups', 'Normal GXA Toolbox accounts only.', signups)}</div><div class="panel-grid">${panel('Traffic Trend', 'Google Analytics authoritative reporting.', empty('Google Analytics not connected.', 'No graph is rendered without authenticated GA4 data.'))}${panel('Revenue Trend', 'Google AdSense authoritative reporting.', empty('AdSense Reporting Not Connected', 'No earnings or graph points are fabricated.'))}</div></div>`;
  }

  function analytics() {
    const report = state.data.reports.ga4;
    const sections = ['Visitors', 'Traffic Sources', 'Countries', 'Devices', 'Top Pages / Tools'];
    return `<div class="section-stack"><p class="section-intro">GA4 reports will be requested server-side after reporting credentials are configured. GTM installation alone is not treated as a reporting connection.</p><div class="kpi-grid">${['Active Users','New Users','Sessions','Views','Engaged Sessions','Engagement Rate'].map(metric => kpi(metric, unavailable(report.label), 'GA4')).join('')}</div><div class="panel-grid">${sections.map(name => panel(name, 'Google Analytics Data API', empty('Google Analytics not connected.', 'Configuration Required'))).join('')}</div></div>`;
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
    return `<div class="section-stack"><div class="kpi-grid">${kpi('Tool Opens', metric(summary.opens), 'GXA Analytics')}${kpi('Tool Starts', metric(summary.starts), 'GXA Analytics')}${kpi('Successful Jobs', metric(summary.complete), 'GXA Analytics')}${kpi('Failed Jobs', metric(summary.fail), 'GXA Analytics')}${kpi('Downloads', metric(summary.downloads), 'GXA Analytics')}</div><p class="definition"><strong>Conversion rate:</strong> ${escapeHtml(state.data.toolAnalytics.formula)}. A page view is never counted as a conversion.</p>${panel('Most Used Tools', 'Privacy-minimized first-party events. No file names, contents, OCR text, or stack traces are collected.', table(headers, rows.map((row, index) => ({ ...row, rank: index + 1 }))))}</div>`;
  }

  function seo() {
    const search = state.data.reports.searchConsole;
    const health = state.data.internalSeo;
    return `<div class="section-stack"><p class="section-intro">Google Search Console data and the GXA internal SEO build audit are separate sources.</p><div class="kpi-grid">${['Google Clicks','Search Impressions','Average CTR','Average Position'].map(metric => kpi(metric, unavailable(search.label), 'Search Console')).join('')}</div><div class="panel-grid">${panel('Top Queries', 'Google Search Console API', empty('Google Search Console not connected.', 'No query data is available.'))}${panel('Top Ranking Tools', 'Google Search Console API', empty('Google Search Console not connected.', 'No ranking data is available.'))}</div>${panel('GXA Internal SEO Audit', 'Contract-tested build facts, not Search Console metrics.', `<div class="kpi-grid">${kpi('Registered Tools', formatNumber(health.registeredTools), 'Build Audit')}${kpi('Indexable Tool Pages', formatNumber(health.indexableToolPages), 'Build Audit')}${kpi('Sitemap URLs', formatNumber(health.sitemapUrls), 'Build Audit')}${kpi('Noindex Pages', formatNumber(health.noindexPages), 'Build Audit')}${kpi('Canonical Issues', formatNumber(health.canonicalIssues), 'Build Audit')}${kpi('Broken Internal Links', formatNumber(health.brokenInternalLinks), 'Build Audit')}</div>`)}</div>`;
  }

  function adsense() {
    const ads = state.data.reports.adsense;
    return `<div class="section-stack"><p class="section-intro">The existing AdSense site code and publisher identity are preserved. Reporting access is a separate server-side integration.</p><div class="kpi-grid">${['Estimated Earnings','Page Views','Ad Impressions','Clicks','Page RPM','CPC'].map(metric => kpi(metric, unavailable(ads.label), 'AdSense API')).join('')}</div>${panel('AdSense Reporting Status', 'Publisher: ca-pub-9226826319752464', empty('AdSense Reporting Not Connected', 'Server-side OAuth configuration is required. No earnings are estimated locally.'))}${panel('Revenue Trend', 'Today, 7 days, 30 days, this month, or previous month when connected.', empty('No Data Available', 'No revenue graph is drawn without authoritative AdSense data.'))}</div>`;
  }

  function users() {
    const summary = state.data.users.summary;
    const value = key => summary ? formatNumber(summary[key]) : unavailable('Database unavailable');
    const rows = table([
      { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' },
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
