(function () {
  'use strict';
  if (window.GxaAdNetwork || window.GxaAdConfig?.network !== 'adsterra') return;
  let requested = false, slot = null, sentinel = null, intersection = null, contentObserver = null, timeout = null;
  let requestedPath = null;
  const config = window.GxaAdConfig;
  const visible = element => element.getClientRects().length && !element.closest('[hidden], .hidden');
  function eligible() {
    if (/noindex/i.test(document.querySelector('meta[name="robots"]')?.content || '')) return false;
    const id = location.pathname.replace(/^\/+|\/+$/g, '');
    const policy = window.GxaToolQuality;
    if (!policy) return false;
    if (!id) return policy.forPage('home').adsEligible === true;
    if (policy.forTool(id).adsEligible === true) return policy.forTool(id).productionReady === true;
    const article = window.GXA_EDITORIAL_PAGES?.find(page => page.id === id);
    return Boolean(article && ['guide', 'category'].includes(article.kind) && policy.forPage(`content-${id}`).adsEligible === true);
  }
  function blocked() {
    const main = document.querySelector('#main-content, #root');
    if (!main || main.querySelector('[data-static-route-shell]') || !main.querySelector('h1')) return true;
    if ([...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(visible)) return true;
    if (document.body.dataset.gxaLastProcessingError) return true;
    return [...main.querySelectorAll('[role="alert"], .preview-error-state, .error-message, #tool-processing-mount')].some(element => visible(element) && element.textContent.trim());
  }
  function collapse(state = 'failed') {
    clearTimeout(timeout); contentObserver?.disconnect(); intersection?.disconnect();
    sentinel?.remove(); sentinel = null;
    if (slot) {
      if (!slot.hidden) slot.hidden = true;
      slot.dataset.adState = state;
      const mount = slot.querySelector('[data-ad-unit-mount]');
      if (mount?.childNodes.length) mount.replaceChildren();
    }
  }
  function request() {
    if (requested || !slot?.isConnected || !eligible() || blocked() || !config.native.enabled) return;
    if (document.getElementById(config.native.containerId)) return;
    requested = true; requestedPath = location.pathname; intersection?.disconnect();
    const mount = slot.querySelector('[data-ad-unit-mount]');
    const container = document.createElement('div'); container.id = config.native.containerId;
    const script = document.createElement('script');
    script.async = true; script.dataset.cfasync = 'false'; script.src = config.native.src;
    script.onerror = () => collapse('failed');
    slot.dataset.adState = 'loading'; slot.hidden = false;
    const ready = () => {
      if (!eligible() || !slot.isConnected || requestedPath !== location.pathname) { collapse('removed'); return; }
      // A successful script response is not proof of an ad. Wait for creative DOM.
      if (container.querySelector('iframe, img, a[href]')) {
        clearTimeout(timeout); slot.dataset.adState = 'mounted';
      }
    };
    contentObserver = new MutationObserver(ready);
    contentObserver.observe(container, { subtree: true, childList: true });
    timeout = setTimeout(() => collapse('empty'), 20000);
    mount.append(container, script);
  }
  function candidate() {
    const id = location.pathname.replace(/^\/+|\/+$/g, '');
    const main = document.querySelector('#main-content, #root');
    if (!main) return null;
    // These candidates follow the complete guide, hence all processing/results.
    const existing = main.querySelector('[data-ad-zone="ad-slot-content-1"], .gxa-tool-ad-placement');
    if (existing) return existing;
    // Homepage and long editorial pages get at most one unit after substantial copy.
    const sections = id ? main.querySelectorAll('.content-section') : main.querySelectorAll('.tool-content-guide .tool-info-section');
    if (sections.length < 3) return null;
    const anchor = sections[sections.length - 2];
    if ([...sections].slice(0, -1).map(section => section.textContent).join('').length < 400) return null;
    const aside = document.createElement('aside'); aside.hidden = true; aside.setAttribute('aria-label', 'Advertisement');
    aside.dataset.adZone = 'content-middle';
    const label = document.createElement('span'); label.className = 'tool-ad-label'; label.textContent = 'Advertisement';
    const mount = document.createElement('div'); mount.dataset.adUnitMount = '';
    aside.append(label, mount); anchor.after(aside);
    return aside;
  }
  function sync() {
    if (!eligible() || blocked()) { if (slot) collapse('suppressed'); return; }
    if (requested) { if (!slot?.isConnected || requestedPath !== location.pathname) collapse('removed'); return; }
    if (slot?.isConnected && sentinel?.isConnected) return;
    slot = candidate(); if (!slot) return;
    slot.classList.add('gxa-ad-network'); slot.dataset.adState = 'waiting';
    sentinel = document.createElement('div'); sentinel.className = 'gxa-ad-sentinel'; sentinel.setAttribute('aria-hidden', 'true'); slot.before(sentinel);
    if (!window.IntersectionObserver) return; // Do not eagerly request on older browsers.
    intersection?.disconnect();
    intersection = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) request(); }, { rootMargin: '200px 0px' });
    intersection.observe(sentinel);
  }
  window.GxaAdNetwork = Object.freeze({ sync, eligible, hasRequested: () => requested });
  let pending = false;
  const schedule = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; sync(); }); };
  function start() {
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-gxa-last-processing-error'] });
    sync();
  }
  window.addEventListener('popstate', () => { if (requested && requestedPath !== location.pathname) location.reload(); else schedule(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
