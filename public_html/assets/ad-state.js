(function () {
  'use strict';
  // Pause before the official loader executes; never request a manual ad unit.
  const ads = window.adsbygoogle = window.adsbygoogle || [];
  ads.pauseAdRequests = 1;
  let failed = false;
  function check() {
    const main = document.querySelector('#main-content, #root');
    const robots = document.querySelector('meta[name="robots"]')?.content || '';
    const routeId = location.pathname.split('/').filter(Boolean)[0];
    const reviewed = Object.hasOwn(window.GxaToolQuality?.review || {}, routeId || '');
    const visible = element => element.getClientRects().length && !element.closest('[hidden], .hidden');
    const error = main && [...main.querySelectorAll('[role="alert"], .preview-error-state, .error-message')].some(element => visible(element) && element.textContent.trim());
    if (error || document.body?.dataset.gxaLastProcessingError) failed = true;
    const processing = document.getElementById('tool-processing-mount');
    const populated = main && main.textContent.trim().length > 80 && main.querySelector('h1');
    const loading = !main || main.querySelector('.static-route-shell') || (processing && visible(processing));
    ads.pauseAdRequests = (window.GxaAdConfig && window.GxaAdConfig.network !== 'adsense') || failed || reviewed || /noindex/i.test(robots) || !populated || loading ? 1 : 0;
  }
  window.GxaAdState = Object.freeze({ fail() { failed = true; ads.pauseAdRequests = 1; }, check });
  window.addEventListener('error', () => window.GxaAdState.fail());
  window.addEventListener('unhandledrejection', () => window.GxaAdState.fail());
  window.addEventListener('DOMContentLoaded', () => {
    check();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; check(); });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-gxa-last-processing-error'] });
  }, { once: true });
})();
