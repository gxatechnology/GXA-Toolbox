(function () {
  'use strict';
  if (window.GxaAdIntrusive || window.GxaAdConfig?.network !== 'adsterra') return;

  const config = window.GxaAdConfig;
  const records = new Map();
  const routeId = () => location.pathname.replace(/^\/+|\/+$/g, '');
  const routeApproved = unit => unit.approvedRoutes?.includes('*') || unit.approvedRoutes?.includes(routeId());
  const publicRouteEligible = () => window.GxaAdNetwork?.eligible() === true
    && !/noindex/i.test(document.querySelector('meta[name="robots"]')?.content || '');

  function snapshot() {
    return Object.fromEntries([...records].map(([name, record]) => [name, { ...record }]));
  }

  function request(name, unit) {
    if (!unit?.enabled || !routeApproved(unit) || !publicRouteEligible()) return false;
    const id = `gxa-adsterra-${name}`;
    if (records.has(name) || document.getElementById(id)) return false;

    const record = { unitId: unit.unitId, src: unit.src, state: 'requested', route: location.pathname };
    records.set(name, record);
    const script = document.createElement('script');
    script.id = id;
    script.type = 'text/javascript';
    script.async = false;
    script.src = unit.src;
    script.dataset.gxaAdsterraUnit = name;
    script.dataset.gxaAdsterraUnitId = String(unit.unitId);
    script.onload = () => { record.state = 'loaded'; };
    script.onerror = () => { record.state = 'failed'; };
    // Provider bootstraps are appended at the end of body, matching the
    // supplied integration location without intercepting user interaction.
    document.body.append(script);
    return true;
  }

  function initialize() {
    if (!document.body || !publicRouteEligible()) return false;
    request('popunder', config.intrusive.popunder);
    request('social-bar', config.intrusive.socialBar);
    return true;
  }

  window.GxaAdIntrusive = Object.freeze({ initialize, status: snapshot });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
