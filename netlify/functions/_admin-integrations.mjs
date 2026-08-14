function configured(names) {
  return names.every(name => Boolean(String(process.env[name] || '').trim()));
}

function integration(id, name, requiredEnvironment, installed = false) {
  const hasConfiguration = configured(requiredEnvironment);
  return {
    id,
    name,
    installed,
    status: hasConfiguration ? 'awaiting_integration' : 'configuration_required',
    label: hasConfiguration ? 'Awaiting Integration' : 'Configuration Required',
    requiredEnvironment
  };
}

export function getGoogleIntegrationStates() {
  return [
    integration('ga4', 'Google Analytics 4', [
      'GA4_PROPERTY_ID',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    ]),
    integration('search-console', 'Google Search Console', [
      'SEARCH_CONSOLE_SITE_URL',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    ]),
    integration('adsense-reporting', 'Google AdSense Reporting', [
      'ADSENSE_ACCOUNT_ID',
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REFRESH_TOKEN'
    ]),
    {
      id: 'gtm',
      name: 'Google Tag Manager',
      installed: true,
      status: 'installed_unverified',
      label: 'Installed · Reporting Unverified',
      containerId: 'GTM-TBQN2SJ4',
      requiredEnvironment: []
    }
  ];
}

export function unavailableGoogleReports() {
  return {
    ga4: { status: 'not_connected', label: 'Google Analytics not connected.', metrics: null, rows: [] },
    searchConsole: { status: 'not_connected', label: 'Google Search Console not connected.', metrics: null, rows: [] },
    adsense: { status: 'not_connected', label: 'AdSense Reporting Not Connected', metrics: null, rows: [] }
  };
}
