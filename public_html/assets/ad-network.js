(function () {
  'use strict';
  if (window.GxaAdNetwork || window.GxaAdConfig?.network !== 'adsterra') return;
  const config = window.GxaAdConfig, slots = new Map(), used = new Set();
  let fixedQueue = Promise.resolve();
  let requested = false, requestedPath = null, plannedPath = null, pending = false, resizeTimer = null;
  const visible = element => element.getClientRects().length && !element.closest('[hidden], .hidden');
  function eligible() {
    if (/noindex/i.test(document.querySelector('meta[name="robots"]')?.content || '')) return false;
    const id = location.pathname.replace(/^\/+|\/+$/g, ''), policy = window.GxaToolQuality;
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
    return Boolean(document.body.dataset.gxaLastProcessingError) || [...main.querySelectorAll('[role="alert"], .preview-error-state, .error-message, #tool-processing-mount')].some(element => visible(element) && element.textContent.trim());
  }
  function collapse(state, reason) {
    if (state.terminal) return;
    clearTimeout(state.timer); state.observer?.disconnect(); state.intersection?.disconnect();
    state.sentinel?.remove(); state.node.hidden = true; state.node.dataset.adState = reason;
    state.node.dataset.adCollapseReason = reason;
    state.mount.replaceChildren(); state.terminal = true;
  }
  function watchForFill(state, container) {
    state.container = container;
    state.observer = new MutationObserver(() => ready(state, container));
    state.observer.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
    state.loadedFrames = new WeakSet();
    container.addEventListener('load', event => { if (event.target.tagName === 'IFRAME') state.loadedFrames.add(event.target); ready(state, container); }, true);
    // Give the provider a full initial window and one bounded delayed recheck.
    state.timer = setTimeout(() => {
      ready(state, container);
      if (!state.terminal && state.node.dataset.adState !== 'mounted') {
        state.timer = setTimeout(() => { ready(state, container); if (!state.terminal && state.node.dataset.adState !== 'mounted') collapse(state, 'empty'); }, 5000);
      }
    }, 30000);
  }
  function loadFixed(state) {
    return new Promise(resolve => {
      if (state.terminal || !state.node.isConnected || !eligible() || blocked()) { collapse(state, 'suppressed'); resolve(); return; }
      // Exact official embed pair, directly in the intended slot. Serialize pairs
      // so the provider-global atOptions object cannot race another unit.
      const options = document.createElement('script');
      options.textContent = `atOptions = {'key':${JSON.stringify(state.unit.key)},'format':'iframe','height':${state.unit.height},'width':${state.unit.width},'params':{}};`;
      const script = document.createElement('script');
      script.async = false; script.src = state.unit.src;
      script.onload = () => { ready(state, state.mount); resolve(); };
      script.onerror = () => { collapse(state, 'failed'); resolve(); };
      watchForFill(state, state.mount);
      state.mount.append(options, script);
    });
  }
  function ready(state, container) {
    if (state.terminal) return;
    if (!eligible() || !state.node.isConnected || requestedPath !== location.pathname || blocked()) { collapse(state, 'suppressed'); return; }
    // A host iframe/script loading is NOT a fill signal. Require provider creative DOM.
    const creative = [...container.querySelectorAll('iframe, img, a[href]')].some(element => {
      if (element.tagName === 'IMG') return element.complete && element.naturalWidth > 0;
      if (element.tagName === 'IFRAME') {
        const rect = element.getBoundingClientRect();
        // Official fixed units intentionally create an about:blank iframe and
        // populate it internally. Its contents are not a safe/reliable fill
        // boundary; exact provider dimensions plus rendered geometry are.
        if (state.unit.key) return Number(element.getAttribute('width')) === state.unit.width
          && Number(element.getAttribute('height')) === state.unit.height
          && rect.width >= state.unit.width && rect.height >= state.unit.height;
        return state.loadedFrames?.has(element) && Boolean(element.getAttribute('src') && element.getAttribute('src') !== 'about:blank');
      }
      return Boolean(element.textContent.trim() || element.querySelector('img'));
    });
    if (!creative) return;
    if (document.activeElement?.closest('.tool-workspace, #edit-pdf-mount, #image-converter-mount, .tool-interactive-area')) return;
    clearTimeout(state.timer); state.node.dataset.adState = 'mounted';
    delete state.node.dataset.adCollapseReason;
  }
  function request(state) {
    if (state.started || state.terminal || !state.node.isConnected || !eligible() || blocked()) return;
    const key = state.unit.key || state.unit.containerId;
    if (used.has(key)) return;
    used.add(key); state.started = true; requested = true; requestedPath = location.pathname;
    state.intersection?.disconnect(); state.sentinel.remove();
    state.node.dataset.adState = 'loading'; state.node.hidden = false;
    if (state.unit.key) {
      fixedQueue = fixedQueue.then(() => loadFixed(state));
    } else {
      if (document.getElementById(state.unit.containerId)) { collapse(state, 'duplicate'); return; }
      // Exact official Native order: async provider script, then its fixed ID.
      const script = document.createElement('script'); script.async = true; script.dataset.cfasync = 'false'; script.src = state.unit.src;
      script.onerror = () => collapse(state, 'failed');
      const container = document.createElement('div'); container.id = state.unit.containerId;
      watchForFill(state, container);
      state.mount.append(script, container);
    }
  }
  function makeSlot(zone, unit, anchor, existing = null) {
    if (slots.has(zone)) return;
    const node = existing || document.createElement('aside'); node.hidden = true;
    node.setAttribute('aria-label', 'Advertisement'); node.classList.add('gxa-ad-network');
    node.dataset.adLayoutZone = zone; node.dataset.adPlacement = zone;
    node.dataset.adFormat = unit.key ? `${unit.width}x${unit.height}` : 'native';
    node.dataset.adState = 'waiting'; delete node.dataset.adCollapseReason;
    if (!existing) {
      node.dataset.adZone = zone;
      const label = document.createElement('span'); label.className = 'tool-ad-label'; label.textContent = 'Advertisement';
      const mount = document.createElement('div'); mount.dataset.adUnitMount = ''; node.append(label, mount); anchor.after(node);
    }
    const sentinel = document.createElement('div'); sentinel.className = 'gxa-ad-sentinel'; sentinel.setAttribute('aria-hidden', 'true'); node.before(sentinel);
    const state = { node, unit, sentinel, mount: node.querySelector('[data-ad-unit-mount]'), started: false, terminal: false };
    slots.set(zone, state);
    if (zone === 'right' || zone === 'left') {
      node.classList.add('gxa-ad-rail'); node.style.width = `${unit.width}px`;
      node.style[zone === 'right' ? 'left' : 'right'] = 'calc(100% + 24px)';
      node.style.top = `${anchor.offsetTop + anchor.offsetHeight + 32}px`;
      sentinel.remove(); anchor.after(sentinel);
    }
    if (!window.IntersectionObserver) return;
    state.intersection = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) request(state); }, { rootMargin: '200px 0px' });
    state.intersection.observe(sentinel);
  }
  function editorial(main, id) {
    const existing = main.querySelector('.gxa-tool-ad-placement, [data-ad-zone="ad-slot-content-1"], [data-ad-zone="content-middle"]');
    if (existing) { makeSlot('after-tool', config.native, null, existing); return; }
    const sections = [...main.querySelectorAll(id ? '.content-section' : '.tool-content-guide .tool-info-section')];
    if (sections.length >= 3 && sections.slice(0, -1).map(section => section.textContent).join('').length >= 400) makeSlot('content-middle', config.native, sections[sections.length - 2]);
  }
  function plan() {
    const id = location.pathname.replace(/^\/+|\/+$/g, ''), main = document.querySelector('#main-content, #root');
    const header = main.querySelector('.tool-header'), shell = header?.parentElement;
    // React owns its editor DOM: retain its dedicated outside-editor placement.
    if (!header || !shell || !window.GxaAdLayout) { if (config.native.enabled && (config.zones.afterTool || config.zones.content)) editorial(main, id); return; }
    const rect = shell.getBoundingClientRect(), width = header.getBoundingClientRect().width;
    shell.classList.add('gxa-ad-layout-shell');
    const layout = window.GxaAdLayout.plan(config, { tool: id, viewport: innerWidth, inlineWidth: width, leftSpace: rect.left - 16, rightSpace: innerWidth - rect.right - 16 });
    for (const item of layout) {
      if (item.zone === 'top' || item.zone === 'right' || item.zone === 'left') makeSlot(item.zone, item.unit, header);
      else if (item.zone === 'after-tool') {
        const existing = main.querySelector('[data-ad-zone="ad-slot-after-tool"], [data-ad-zone="ad-slot-content-1"]');
        const guide = main.querySelector('.tool-content-guide');
        // Legacy dedicated tools placed their candidate after the guide. Move
        // only that empty marker, never the workspace/result/reset controls.
        if (existing && guide && existing.parentElement === guide.parentElement && (guide.compareDocumentPosition(existing) & Node.DOCUMENT_POSITION_FOLLOWING)) guide.before(existing);
        if (existing) makeSlot(item.zone, item.unit, null, existing);
      } else {
        const sections = [...main.querySelectorAll('.tool-content-guide .tool-info-section')];
        if (sections.length >= 3 && sections.slice(0, 2).map(section => section.textContent).join('').length >= 400) makeSlot(item.zone, item.unit, sections[1]);
      }
    }
  }
  function sync() {
    if (!eligible() || blocked()) { for (const state of slots.values()) if (state.started) collapse(state, 'suppressed'); return; }
    if (requested && requestedPath !== location.pathname) { for (const state of slots.values()) collapse(state, 'removed'); return; }
    if (plannedPath !== location.pathname) {
      for (const state of slots.values()) collapse(state, 'removed'); slots.clear();
      plannedPath = location.pathname; plan();
    }
    for (const state of slots.values()) {
      if (!state.node.isConnected && !state.terminal) collapse(state, 'removed');
      if (state.started && !state.terminal && state.container) ready(state, state.container);
      if (!state.started && !state.terminal && window.IntersectionObserver && state.sentinel.isConnected) {
        const rect = state.sentinel.getBoundingClientRect();
        if (rect.bottom >= -200 && rect.top <= innerHeight + 200) request(state);
      }
    }
  }
  function resize() {
    // Never refresh units on resize. Collapse sizes that no longer fit.
    for (const [zone, state] of slots) {
      if (!state.unit.key || state.terminal) continue;
      const rect = state.node.parentElement?.getBoundingClientRect();
      const rail = zone === 'left' || zone === 'right';
      const fits = rect && (rail ? innerWidth >= (zone === 'left' ? 1600 : 1280) && (zone === 'left' ? rect.left - 16 : innerWidth - rect.right - 16) >= state.unit.width + 24 : rect.width >= state.unit.width);
      if (!fits) collapse(state, 'resized');
    }
  }
  const schedule = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; sync(); }); };
  window.GxaAdNetwork = Object.freeze({ sync, eligible, hasRequested: () => requested });
  function start() {
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-gxa-last-processing-error'] });
    document.addEventListener('focusout', schedule);
    // Browser capture/orientation can briefly report a 1px viewport. Only retire
    // an impression after dimensions settle; never remount it to recover.
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }); sync();
  }
  window.addEventListener('popstate', () => { if (requested && requestedPath !== location.pathname) location.reload(); else schedule(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
