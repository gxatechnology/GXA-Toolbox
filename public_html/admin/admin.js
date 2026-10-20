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
    adsterra: 'Adsterra',
    users: 'Users',
    support: 'Support Messages',
    system: 'System'
  });
  const state = { section: 'overview', range: '30d', customStart:'', customEnd:'', data: null, busy: false, requestId:0, filters: { search:'', category:'', activity:'all', sort:'opens', page:1 }, supportStatus:'' };
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
  const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const formatNumber = value => numeric(value) ? Number(value).toLocaleString('en-IN') : 'Not available';
  const formatPercent = value => numeric(value) ? `${(Number(value) * 100).toFixed(1)}%` : 'Not available';
  const formatReportedPercent = value => numeric(value) ? `${(Math.abs(Number(value)) <= 1 ? Number(value) * 100 : Number(value)).toFixed(2)}%` : 'Not available';
  const formatDecimal = value => numeric(value) ? Number(value).toFixed(2) : 'Not available';
  const formatMoney = (value, currency) => !numeric(value) ? 'Not available' : currency ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)) : `${formatDecimal(value)} (currency not reported)`;
  const formatDate = value => { const text=String(value || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'); const date=new Date(text); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN', { dateStyle:'medium', timeStyle:'short' }).format(date) : 'Not available'; };
  const unavailable = label => `<span class="metric-unavailable">${escapeHtml(label || 'Not Connected')}</span>`;
  const reportMetric = (report, key, formatter = formatNumber) => report.dataState === 'no_data' ? unavailable('No data') : numeric(report.metrics?.[key]) ? formatter(report.metrics[key]) : unavailable(report.metrics ? 'Metric not available' : report.label);

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
    state.requestId++;
    state.data = null;
    setBusy(false);
    closeDrawer();
    byId('dashboard-content').replaceChildren();
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
    state.busy = busy;
    byId('refresh-data').textContent = busy ? 'Refreshing…' : 'Refresh data';
    byId('dashboard-content').setAttribute('aria-busy', String(busy));
    byId('refresh-data').disabled = busy;
    byId('date-range').disabled = busy;
    for (const id of ['custom-start','custom-end','apply-custom-range']) byId(id).disabled = busy;
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
    return `<div class="table-wrap" role="region" aria-label="Scrollable data table" tabindex="0"><table><thead><tr>${headers.map(item => `<th scope="col">${escapeHtml(item.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map(item => `<td data-label="${escapeHtml(item.label)}">${item.render ? item.render(row) : escapeHtml(row[item.key] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function integrationCards() {
    return `<div class="integration-grid">${state.data.integrations.map(item => {
      const className = item.status === 'connected' ? 'connected' : ['error', 'api_error', 'api_unavailable', 'connection_error', 'authentication_required', 'permission_required', 'rate_limited'].includes(item.status) ? 'error' : '';
      const detail = item.detail || (item.status === 'configuration_required' ? 'Server-side configuration is required.' : 'Installed code does not confirm reporting access.');
      return `<article class="integration-card"><h4>${escapeHtml(item.name)}</h4><span class="status-chip ${className}">${escapeHtml(item.label)}</span><p>${escapeHtml(detail)}</p></article>`;
    }).join('')}</div>`;
  }

  function overview() {
    const internal = state.data.overview.internal;
    const ga = state.data.reports.ga4;
    const search = state.data.reports.searchConsole;
    const ads = state.data.reports.adsense;
    const adsterra = state.data.reports.adsterra;
    const cards = [
      kpi(state.range === 'today' ? 'Users Today' : 'Active Users', reportMetric(ga, 'activeUsers'), 'GA4', 'Selected date range'),
      kpi('Page Views', reportMetric(ga, 'screenPageViews'), 'GA4', 'No client-side estimate is substituted'),
      kpi('Tool Opens', internal ? formatNumber(internal.tool_opens) : unavailable('Database unavailable'), 'GXA Analytics'),
      kpi('Successful Jobs', internal ? formatNumber(internal.successful_jobs) : unavailable('Database unavailable'), 'GXA Analytics'),
      kpi('Tool Starts', internal ? formatNumber(internal.tool_runs) : unavailable('Database unavailable'), 'GXA Analytics', 'Selected date range'),
      kpi('Downloads', internal ? formatNumber(internal.downloads) : unavailable('Database unavailable'), 'GXA Analytics', 'Recorded result downloads'),
      kpi('Search Clicks', reportMetric(search, 'clicks'), 'Search Console', 'Selected date range'),
      kpi('AdSense Earnings', reportMetric(ads, 'ESTIMATED_EARNINGS', value=>formatMoney(value, ads.currencyCode)), 'Google AdSense', 'Selected date range'),
      kpi('Adsterra Revenue', reportMetric(adsterra, 'revenue', value=>formatMoney(value, adsterra.currencyCode)), 'Adsterra API', 'Publisher-reported revenue'),
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
      { label: 'Date', key: 'DATE' }, { label: 'Earnings', render: row => formatMoney(row.ESTIMATED_EARNINGS, ads.currencyCode) }, { label: 'Views', render: row => formatNumber(row.PAGE_VIEWS) }
    ], ads.trend || []);
    const supportCount=state.data.support?.summary?.filter(row=>row.status!=='resolved').reduce((sum,row)=>sum+row.count,0);
    const alerts=state.data.integrations.filter(item=>['error','api_error','api_unavailable','authentication_required','permission_required','rate_limited','configuration_required'].includes(item.status)).map(item=>({tool_name:item.name, reason:item.label}));
    if (supportCount) alerts.push({tool_name:'Support messages awaiting response',reason:String(supportCount)});
    for (const row of state.data.toolAnalytics.attention || []) alerts.push({tool_name:row.tool_name,reason:'Review completion / failure rates'});
    return `<div class="section-stack"><div class="kpi-grid">${cards}</div>${panel('Needs Attention', 'Configuration notices are separate from operational failures. Tool alerts require at least 20 starts.', table([{label:'Area',key:'tool_name'},{label:'Review',key:'reason'}],alerts))}${panel('Product Snapshot', 'Generated from the current public registry; sitemap URLs are not indexed pages.', `<p>${formatNumber(state.data.internalSeo.registeredTools)} registered tools · ${formatNumber(state.data.internalSeo.sitemapUrls)} sitemap URLs</p>`)}${panel('Integration Status', 'Installed code and authenticated reporting connections are shown separately.', integrationCards())}<div class="panel-grid">${panel('Top Performing Tools', 'Real first-party events for the selected period.', top)}${panel('Recent Signups', 'Normal GXA Toolbox accounts only.', signups)}</div><div class="panel-grid">${panel('Traffic Trend', 'Google Analytics authoritative reporting.', trafficTrend)}${panel('Revenue Trend', 'Google AdSense authoritative reporting.', revenueTrend)}</div></div>`;
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

  const toolColumns = [
    {label:'Tool',key:'tool_name'}, {label:'Category',key:'category'},
    ...[['Opens','opens'],['Starts','starts'],['Successful','successful_jobs'],['Failed','failed_jobs'],['Downloads','downloads']].map(([label,key])=>({label,render:row=>formatNumber(row[key])})),
    ...[['Completion','conversion_rate'],['Failure rate','failure_rate'],['Download rate','download_rate']].map(([label,key])=>({label,render:row=>numeric(row[key]) ? row[key]+'%' : 'Not applicable'})),
    {label:'Last Activity',render:row=>formatDate(row.last_activity)}
  ];
  function toolResults() {
    const f=state.filters;
    const rows=state.data.toolAnalytics.rows.filter(row=>(!f.search || (row.tool_name+' '+row.tool_id).toLowerCase().includes(f.search.toLowerCase())) && (!f.category || row.category===f.category) && (f.activity==='all' || f.activity==='attention' && row.attention || f.activity==='zero' && state.data.toolAnalytics.available && ['opens','starts','successful_jobs','failed_jobs','downloads'].every(key=>row[key]===0)));
    rows.sort((a,b)=>(b[f.sort] || 0)-(a[f.sort] || 0) || a.tool_name.localeCompare(b.tool_name));
    const pages=Math.max(1,Math.ceil(rows.length/25)); f.page=Math.min(f.page,pages);
    return '<p role="status">'+rows.length+' matching / '+state.data.toolAnalytics.rows.length+' current tools</p>'+table(toolColumns,rows.slice((f.page-1)*25,f.page*25))+'<div class="table-pager"><button class="secondary-button" data-page="-1" '+(f.page===1?'disabled':'')+'>Previous</button><span>Page '+f.page+' of '+pages+'</span><button class="secondary-button" data-page="1" '+(f.page===pages?'disabled':'')+'>Next</button></div>';
  }
  function tools() {
    const analytics=state.data.toolAnalytics;
    const summary=analytics.rows.reduce((sum,row)=>{for(const key of ['opens','starts','successful_jobs','failed_jobs','downloads']) sum[key]=(sum[key]||0)+(row[key]||0);return sum;},{});
    const cards=[['Tool Opens','opens'],['Tool Starts','starts'],['Successful Jobs','successful_jobs'],['Failed Jobs','failed_jobs'],['Downloads','downloads']].map(([label,key])=>kpi(label,analytics.available?formatNumber(summary[key]):unavailable('Database unavailable'),'GXA Analytics')).join('');
    const categories=[...new Set(analytics.rows.map(row=>row.category))];
    const f=state.filters;
    const controls='<div class="tool-filters"><label>Search tools<input id="tool-search" type="search" value="'+escapeHtml(f.search)+'" placeholder="Name or tool ID"></label><label>Category<select id="tool-category"><option value="">All categories</option>'+categories.map(c=>'<option '+(f.category===c?'selected':'')+' value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>').join('')+'</select></label><label>Activity<select id="tool-activity">'+[['all','All tools'],['zero','Zero activity'],['attention','Needs attention']].map(([v,l])=>'<option value="'+v+'" '+(f.activity===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><label>Sort by<select id="tool-sort">'+[['opens','Opens'],['starts','Starts'],['successful_jobs','Completions'],['failed_jobs','Failures'],['downloads','Downloads']].map(([v,l])=>'<option value="'+v+'" '+(f.sort===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label></div>';
    return '<div class="section-stack"><div class="kpi-grid">'+cards+'</div><p class="definition"><strong>Completion rate:</strong> '+escapeHtml(analytics.formula)+'. A page view is never a conversion. Failure rate = failures / starts; download rate = downloads / completions. Zero denominators are not applicable. Repeated downloads and cross-range events can produce ratios above 100%.</p>'+panel('Current Tool Activity','Includes tools with no recorded activity. '+analytics.threshold,controls+'<div id="tool-results">'+toolResults()+'</div>')+panel('Category Activity','Current canonical categories; selected period.',table([{label:'Category',key:'category'},...toolColumns.slice(2,7)],analytics.categories||[]))+panel('Tool Activity Trend','Daily recorded events; selected UTC period.',table([{label:'Date',key:'date'},...['starts','completions','downloads','failures'].map(key=>({label:key,render:row=>formatNumber(row[key])}))],state.data.overview.trend))+panel('Recent Activity','Latest 50 privacy-minimized events in the selected period.',table([{label:'Tool',key:'tool_name'},{label:'Event',key:'event_type'},{label:'Category',key:'category'},{label:'Occurred at',render:row=>formatDate(row.occurred_at)}],state.data.recentActivity||[]))+panel('Historical / Unregistered IDs','Not counted as current tools. No events have been deleted.',table([{label:'Historical ID',key:'tool_id'},...toolColumns.slice(2)],analytics.historical||[]))+'</div>';
  }

  function seo() {
    const search = state.data.reports.searchConsole;
    const health = state.data.internalSeo;
    const queries = table([{ label: 'Query', key: 'query' }, { label: 'Clicks', render: row => formatNumber(row.clicks) }, { label: 'Impressions', render: row => formatNumber(row.impressions) }, { label: 'CTR', render: row => formatPercent(row.ctr) }, { label: 'Position', render: row => formatDecimal(row.position) }], search.rows || []);
    const pages = table([{ label: 'Page', key: 'page' }, { label: 'Clicks', render: row => formatNumber(row.clicks) }, { label: 'Impressions', render: row => formatNumber(row.impressions) }, { label: 'Position', render: row => formatDecimal(row.position) }], search.groups?.pages || []);
    const trend = table([{ label: 'Date', key: 'date' }, { label: 'Clicks', render: row => formatNumber(row.clicks) }, { label: 'Impressions', render: row => formatNumber(row.impressions) }, { label: 'CTR', render: row => formatPercent(row.ctr) }, { label: 'Position', render: row => formatDecimal(row.position) }], search.trend || []);
    const status = search.dataState === 'no_data' ? empty('No Finalized Search Data Available', search.note || 'Search Console may not yet have finalized data for this date range.') : '';
    const indexedCount = empty('Indexed Page Count Unavailable', 'Indexed page count is not available through this reporting connection. Sitemap and generated-page totals are technical build counts only.');
    return `<div class="section-stack"><p class="section-intro">Google Search Console performance data and the GXA technical SEO build audit are separate sources.</p>${status}<div class="kpi-grid">${kpi('Google Clicks', reportMetric(search, 'clicks'), 'Search Console')}${kpi('Search Impressions', reportMetric(search, 'impressions'), 'Search Console')}${kpi('Average CTR', reportMetric(search, 'ctr', formatPercent), 'Search Console')}${kpi('Average Position', reportMetric(search, 'position', formatDecimal), 'Search Console')}</div>${panel('Search Performance Trend', 'Google Search Console API; recent data can be delayed.', trend)}<div class="panel-grid">${panel('Top Queries', 'Google Search Console API', queries)}${panel('Top Ranking Tools', 'Google Search Console API', pages)}</div>${panel('Google Indexing Status', 'No sitemap count is presented as an indexed-page count.', indexedCount)}${panel('GXA Technical SEO Audit', 'Contract-tested build facts, not Search Console performance or indexing metrics.', `<div class="kpi-grid">${kpi('Registered Tools', formatNumber(health.registeredTools), 'Build Audit')}${kpi('Indexable Tool Pages', formatNumber(health.indexableToolPages), 'Build Audit')}${kpi('Sitemap URLs', formatNumber(health.sitemapUrls), 'Build Audit')}${kpi('Noindex Pages', formatNumber(health.noindexPages), 'Build Audit')}${kpi('Canonical Issues', formatNumber(health.canonicalIssues), 'Build Audit')}${[['Missing Titles','missingTitles'],['Missing Descriptions','missingDescriptions'],['Missing H1','missingH1'],['Missing / Invalid Structured Data','missingStructuredData']].map(([label,key])=>kpi(label,formatNumber(health[key]),'Build Audit')).join('')}${kpi('Broken Internal Links', formatNumber(health.brokenInternalLinks), 'Build Audit')}</div>`)}</div>`;
  }

  function adsense() {
    const publisherLabel = 'Publisher: __GXA_ADSENSE_PUBLISHER_ID__';
    const ads = state.data.reports.adsense;
    const money = key => reportMetric(ads, key, value=>formatMoney(value,ads.currencyCode));
    const trend = table([{ label: 'Date', key: 'DATE' }, { label: 'Earnings', render: row => formatMoney(row.ESTIMATED_EARNINGS, ads.currencyCode) }, { label: 'Page Views', render: row => formatNumber(row.PAGE_VIEWS) }, { label: 'Clicks', render: row => formatNumber(row.CLICKS) }], ads.trend || []);
    if (ads.status !== 'connected') return `<div class="section-stack">${panel('AdSense Reporting', publisherLabel, empty(ads.label, 'Site code installation, site/account approval, and reporting authorization are independent. Reporting requires server-side OAuth and account permission; no earnings are estimated.'))}${integrationCards()}</div>`;
    const status = ads.status === 'connected' ? `<div class="status-message">Authenticated AdSense reporting is connected.</div>` : empty(ads.label, 'Server-side OAuth configuration and account permission are required. No earnings are estimated locally.');
    return `<div class="section-stack"><p class="section-intro">The existing AdSense site code and publisher identity are preserved. Reporting access is a separate server-side integration.</p><div class="kpi-grid">${kpi('Estimated Earnings', money('ESTIMATED_EARNINGS'), 'AdSense API')}${kpi('Page Views', reportMetric(ads, 'PAGE_VIEWS'), 'AdSense API')}${kpi('Ad Impressions', reportMetric(ads, 'IMPRESSIONS'), 'AdSense API')}${kpi('Clicks', reportMetric(ads, 'CLICKS'), 'AdSense API')}${kpi('Page RPM', money('PAGE_VIEWS_RPM'), 'AdSense API')}${kpi('CPC', money('COST_PER_CLICK'), 'AdSense API')}</div>${panel('AdSense Reporting Status', publisherLabel, status)}${panel('Revenue Trend', 'Selected dashboard date range.', trend)}</div>`;
  }

  function adsterra() {
    const report = state.data.reports.adsterra;
    const money = value => formatMoney(value, report.currencyCode);
    const detail = report.status === 'configuration_required'
      ? 'Configure the server-side Adsterra publisher token in Netlify. The token is never sent to this browser.'
      : report.status === 'authentication_required'
        ? 'The publisher API token was rejected or expired. Generate a publisher token and update the server environment.'
        : report.status === 'permission_required'
          ? 'The configured token does not have publisher statistics permission.'
          : report.status === 'rate_limited'
            ? 'Adsterra temporarily rate-limited reporting. The dashboard cache prevents rapid repeat requests.'
            : report.status === 'api_unavailable'
              ? 'Adsterra reporting is temporarily unavailable; the rest of the dashboard remains operational.'
              : 'No estimates are generated locally.';
    if (report.status !== 'connected') return `<div class="section-stack">${panel('Adsterra Publisher Reporting', 'Website ID 6091425 · server-side read-only API', empty(report.label, detail))}${integrationCards()}</div>`;
    const placements = table([
      { label:'Ad unit', key:'title' }, { label:'Placement ID', key:'placement' },
      { label:'Impressions', render:row=>formatNumber(row.impressions) }, { label:'Clicks', render:row=>formatNumber(row.clicks) },
      { label:'CTR', render:row=>formatReportedPercent(row.ctr) }, { label:'CPM', render:row=>money(row.cpm) },
      { label:'Revenue', render:row=>money(row.revenue) }, { label:'Provider row', render:row=>row.reported?'Reported':'No activity returned' }
    ], report.rows || []);
    const trend = table([
      { label:'Date', key:'date' }, { label:'Impressions', render:row=>formatNumber(row.impressions) },
      { label:'Clicks', render:row=>formatNumber(row.clicks) }, { label:'CTR', render:row=>formatReportedPercent(row.ctr) },
      { label:'CPM', render:row=>money(row.cpm) }, { label:'Revenue', render:row=>money(row.revenue) }
    ], report.trend || []);
    const countries = table([
      { label:'Country', key:'country' }, { label:'Impressions', render:row=>formatNumber(row.impressions) },
      { label:'Clicks', render:row=>formatNumber(row.clicks) }, { label:'Revenue', render:row=>money(row.revenue) }
    ], report.groups?.countries || []);
    const domains = table([
      { label:'Website / domain', render:row=>escapeHtml(row.title || row.domain || 'Not reported') },
      { label:'Impressions', render:row=>formatNumber(row.impressions) }, { label:'Clicks', render:row=>formatNumber(row.clicks) },
      { label:'Revenue', render:row=>money(row.revenue) }
    ], report.groups?.domains || []);
    const status = report.dataState === 'no_data' ? empty('No Adsterra Data Available', report.note || 'The authenticated report returned no activity for this period.') : `<div class="status-message">Connected · Last successful sync ${escapeHtml(formatDate(report.refreshedAt))} · ${escapeHtml(report.dateRange?.start || '')}–${escapeHtml(report.dateRange?.end || '')}</div>`;
    return `<div class="section-stack"><p class="section-intro">Read-only publisher statistics for website 6091425. Impressions and clicks are advertising activity, not visitors. Revenue is never inferred from GA4.</p>${status}<div class="kpi-grid">${kpi('Revenue', reportMetric(report,'revenue',money),'Adsterra API')}${kpi('Impressions',reportMetric(report,'impressions'),'Adsterra API')}${kpi('Clicks',reportMetric(report,'clicks'),'Adsterra API')}${kpi('CTR',reportMetric(report,'ctr',formatReportedPercent),'Adsterra API')}${kpi('CPM',reportMetric(report,'cpm',money),'Adsterra API')}</div>${panel('Daily Performance','Publisher API · selected reporting period.',trend)}${panel('Ad Unit Performance','All nine configured units are listed; zero-activity units are not hidden.',placements)}<div class="panel-grid">${panel('Website Performance','Provider rows grouped by domain.',domains)}${panel('Country Performance','Available only when returned by the provider.',countries)}</div></div>`;
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
    return `<div class="section-stack"><p class="section-intro">Normal GXA Toolbox users only. Administrator credentials are never stored in this account database.</p><div class="kpi-grid">${kpi('Total Accounts', value('total_accounts'), 'GXA Database')}${kpi('Registrations in period', value('signups_period'), 'GXA Database')}${kpi('Accounts signing in', value('active_users'), 'GXA Database', 'Based on recorded last login')}</div>${panel('Accounts', 'Latest 100 accounts registered in the selected period. Total accounts is lifetime; these are not anonymous visitors.', rows)}</div>`;
  }

  function support() {
    const rows = table([
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Message', render: row => `<span class="support-message-preview">${escapeHtml(String(row.message || '').slice(0,160))}</span><details class="support-message-details"><summary>Read full message</summary><p>${escapeHtml(row.message)}</p></details>` },
      { label: 'Submitted', render: row => formatDate(row.created_at) },
      { label: 'Status', render: row => `<span class="status-chip ${row.status === 'resolved' ? 'connected' : ''}">${escapeHtml(String(row.status || 'new').replace(/_/g, ' '))}</span>` }
    ], (state.data.support?.rows || []).filter(row=>!state.supportStatus || row.status===state.supportStatus));
    return `<div class="section-stack"><p class="section-intro">Genuine Contact Support submissions are available only through this authenticated administration service.</p>${panel('Support Messages', 'Latest 100 submissions in the selected period. Status is read-only; unread/read tracking is not implemented.', `<label>Status <select id="support-filter">${[['','All statuses'],['new','New'],['in_progress','In progress'],['resolved','Resolved']].map(([v,l])=>`<option value="${v}" ${state.supportStatus===v?'selected':''}>${l}</option>`).join('')}</select></label>${rows}`)}</div>`;
  }

  function system() {
    const database = state.data.integrations.find(item => item.id === 'gxa-database');
    const databaseConnected = database.status === 'connected';
    const authRows = table([
      { label: 'Event', key: 'event_type' }, { label: 'Category', key: 'category' }, { label: 'Count', render: row => formatNumber(row.count) }
    ], state.data.system.auth_failures);
    const errors = table([
      { label: 'Source', key: 'source' }, { label: 'Category', key: 'category' }, { label: 'Severity', key: 'severity' }, { label:'Occurrences', render:row=>formatNumber(row.count) }, { label: 'Last occurred', render: row => formatDate(row.occurred_at) }
    ], state.data.system.errors);
    return `<div class="section-stack"><div class="kpi-grid">${kpi('Database Status', escapeHtml(database.label), 'GXA Database', database.detail)}${kpi('Function Errors', databaseConnected ? formatNumber(state.data.system.error_count) : unavailable('Database unavailable'), 'Sanitized Events')}${kpi('Auth Failures', databaseConnected ? formatNumber(state.data.system.auth_failures.reduce((sum, row) => sum + row.count, 0)) : unavailable('Database unavailable'), 'GXA Authentication')}${kpi('Tool Processing Errors', state.data.overview.internal ? formatNumber(state.data.overview.internal.errors) : unavailable('Database unavailable'), 'GXA Analytics')}</div><div class="panel-grid">${panel('Authentication Failures', 'Only safe categories and counts are retained.', authRows)}${panel('Function & System Errors', 'No stack traces, credentials, environment values, or private paths are returned.', errors)}</div></div>`;
  }

  function renderSection() {
    const renderers = { overview, analytics, tools, seo, adsense, adsterra, users, support, system };
    byId('section-title').textContent = titles[state.section];
    byId('mobile-section-title').textContent = titles[state.section];
    byId('dashboard-content').innerHTML = renderers[state.section]()+panel('Data Freshness','Refreshed timestamps describe API fetches, not when events occurred. Reports may be cached for two minutes. GA4 does not reconstruct traffic before activation; Search Console has reporting delays.',table([{label:'Source',key:'source'},{label:'Fetched at',render:row=>formatDate(row.refreshedAt)},{label:'State',key:'label'}],[{source:'GXA Analytics',refreshedAt:state.data.generated_at,label:state.data.toolAnalytics.available?'Database query completed':'Database unavailable'},...Object.entries(state.data.reports).map(([source,report])=>({source,...report}))]));
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.section === state.section));
  }

  async function loadData() {
    if (state.busy) return;
    const requestId=++state.requestId;
    setBusy(true);
    try {
      const query = new URLSearchParams({ range: state.range });
      if (state.range === 'custom') { query.set('start', state.customStart); query.set('end', state.customEnd); }
      const data = await api(`${endpoints.data}?${query}`);
      if(requestId!==state.requestId) return;
      state.data=data;
      showApp();
      byId('dashboard-content').hidden = false;
      byId('data-timestamp').textContent = `Data refreshed at ${formatDate(state.data.generated_at)} · Events: ${state.data.dateRange?.start || ''}–${state.data.dateRange?.end || ''} (UTC range)`;
      renderSection();
      setBusy(false);
    } catch (error) {
      if(requestId!==state.requestId) return;
      if (error.status === 401) return showLogin('Your administrator session has expired. Sign in again.');
      showApp();
      byId('dashboard-content').hidden = !state.data;
      if (state.data) { state.range=state.data.range; byId('date-range').value=state.range; }
      setBusy(false, state.data ? 'Refresh failed. Previous data is still displayed with its original range and timestamp.' : error.message);
    }
  }

  function closeDrawer() {
    byId('admin-sidebar').classList.remove('open');
    byId('drawer-backdrop').hidden = true;
    byId('open-drawer').setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    document.querySelector('.app-column').inert = false;
    byId('admin-sidebar').inert = window.innerWidth <= 900;
  }

  function openDrawer() {
    byId('admin-sidebar').inert = false;
    byId('admin-sidebar').classList.add('open');
    document.querySelector('.app-column').inert = true;
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
  byId('dashboard-content').addEventListener('input',event=>{
    const keys={'tool-search':'search','tool-category':'category','tool-activity':'activity','tool-sort':'sort'};
    if (keys[event.target.id]) {state.filters[keys[event.target.id]]=event.target.value;state.filters.page=1;byId('tool-results').innerHTML=toolResults();}
  });
  byId('dashboard-content').addEventListener('change',event=>{if(event.target.id==='support-filter'){state.supportStatus=event.target.value;renderSection();byId('support-filter').focus();}});
  byId('dashboard-content').addEventListener('click',event=>{const b=event.target.closest('[data-page]');if(b){state.filters.page+=Number(b.dataset.page);byId('tool-results').innerHTML=toolResults();byId('tool-results').querySelector('[data-page]:not(:disabled)')?.focus();}});
  byId('date-range').addEventListener('change', event => {
    state.range = event.target.value;
    byId('custom-range').hidden = state.range !== 'custom';
    if (state.range !== 'custom') loadData();
  });
  byId('apply-custom-range').addEventListener('click', () => {
    state.customStart = byId('custom-start').value;
    state.customEnd = byId('custom-end').value;
    if (!state.customStart || !state.customEnd) { setBusy(false, 'Choose both custom range dates.'); return; }
    loadData();
  });
  byId('refresh-data').addEventListener('click', loadData);
  byId('open-drawer').addEventListener('click', openDrawer);
  byId('close-drawer').addEventListener('click', () => { closeDrawer(); byId('open-drawer').focus(); });
  byId('drawer-backdrop').addEventListener('click', () => { closeDrawer(); byId('open-drawer').focus(); });
  document.addEventListener('keydown', event => {
    if (!byId('admin-sidebar').classList.contains('open')) return;
    if (event.key === 'Escape') { closeDrawer(); byId('open-drawer').focus(); }
    if (event.key === 'Tab') {
      const buttons=[...byId('admin-sidebar').querySelectorAll('button:not(:disabled)')].filter(button=>button.getClientRects().length);
      const first=buttons[0], last=buttons.at(-1);
      if (event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus();}
      if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
    }
  });
  window.addEventListener('resize', closeDrawer);
  const today = new Date().toISOString().slice(0,10);
  const start = new Date(`${today}T00:00:00.000Z`); start.setUTCDate(start.getUTCDate()-27);
  state.customStart = start.toISOString().slice(0,10); state.customEnd = today;
  byId('custom-start').value = state.customStart; byId('custom-end').value = state.customEnd;
  byId('custom-start').max = today; byId('custom-end').max = today;
  closeDrawer();
  byId('admin-logout').addEventListener('click', async () => {
    try { await api(endpoints.logout, { method: 'POST' }); } catch { setBusy(false, 'Logout failed. Your session may still be active; retry logout.'); return; }
    state.data = null;
    showLogin();
  });

  api(endpoints.session)
    .then(session => session.authenticated ? loadData() : showLogin())
    .catch(error => showLogin(error.message));
})();
