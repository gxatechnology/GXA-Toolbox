(function () {
  'use strict';
  if (window.GxaAdNetwork || window.GxaAdConfig?.network !== 'adsterra') return;
  const config = window.GxaAdConfig, slots = new Map(), used = new Set();
  let fixedQueue = Promise.resolve();
  let requested = false, requestedPath = null, plannedPath = null, pending = false, resizeTimer = null;
  let lastGuide = null, lastGuideSignature = '', lastAfterMarker = null;
  const visible = element => element.getClientRects().length && !element.closest('[hidden], .hidden');
  const resultReady = state => state.node.dataset.adTrigger !== 'result-ready' || Boolean(state.node.closest(
    '[data-result-ready="true"], #tool-complete-mount:not(.hidden), .crop-result-panel:not(.hidden), .image-converter__result:not([hidden]), .gps-studio__result:not([hidden])'
  ));
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
    if (state.node.classList.contains('gxa-ad-rail')) updateRailLayout(state.node.closest('.tool-container') || (state.node.parentElement === document.body ? document.body : null));
  }
  function updateRailLayout(shell) {
    if (!shell) return;
    const active = zone => [...shell.querySelectorAll(`[data-ad-layout-zone="${zone}"]`)].some(node => !node.hidden || node.dataset.adState === 'waiting');
    const left = active('left'), right = active('right');
    shell.classList.toggle('gxa-ad-layout-shell--rail-both', left && right);
    shell.classList.toggle('gxa-ad-layout-shell--rail-right', !left && right);
    shell.classList.toggle('gxa-ad-layout-shell--rail-left', left && !right);
    if (shell === document.body) shell.classList.toggle('gxa-ad-background-rails', left || right);
  }
  function tryFallback(state, reason) {
    const unit = state.fallbackUnit;
    if (!unit || state.unit.key || used.has(unit.key) || !eligible() || blocked() || !state.node.isConnected) return false;
    clearTimeout(state.timer); state.observer?.disconnect();
    state.mount.replaceChildren(); state.unit = unit; state.fallbackUnit = null;
    state.node.dataset.adState = 'loading'; state.node.dataset.adFormat = `${unit.width}x${unit.height}`;
    state.node.dataset.adUnitId = String(unit.unitId || '');
    state.node.dataset.adScriptUrl = unit.src;
    state.node.dataset.adFallbackReason = reason; delete state.node.dataset.adCollapseReason;
    used.add(unit.key); fixedQueue = fixedQueue.then(() => loadFixed(state));
    return true;
  }
  function watchForFill(state, container) {
    state.container = container;
    state.observer = new MutationObserver(() => ready(state, container));
    state.observer.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
    state.loadedFrames = new WeakSet();
    container.addEventListener('load', event => { if (event.target.tagName === 'IFRAME') state.loadedFrames.add(event.target); ready(state, container); }, true);
    // Native gets one bounded decision window so its fixed fallback can appear
    // without a long blank period. Fixed units retain the longer provider window.
    const initialWait = state.unit.key ? 30000 : 10000;
    const finalWait = state.unit.key ? 5000 : 3000;
    state.timer = setTimeout(() => {
      ready(state, container);
      if (!state.terminal && state.node.dataset.adState !== 'mounted') {
        state.timer = setTimeout(() => {
          ready(state, container);
          if (!state.terminal && state.node.dataset.adState !== 'mounted' && !tryFallback(state, 'native-no-fill')) collapse(state, 'empty');
        }, finalWait);
      }
    }, initialWait);
  }
  function loadFixed(state) {
    return new Promise(resolve => {
      if (state.terminal || !state.node.isConnected || !resultReady(state) || !eligible() || blocked()) { collapse(state, 'suppressed'); resolve(); return; }
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
        if (state.unit.key) {
          const sized = Number(element.getAttribute('width')) === state.unit.width
            && Number(element.getAttribute('height')) === state.unit.height
            && rect.width >= state.unit.width && rect.height >= state.unit.height;
          if (!sized) return false;
          // The official loader may build an about:blank iframe and populate it
          // internally. Geometry alone is not a creative: require a
          // visible payload, or a cross-origin frame URL that the browser will
          // not allow this page to inspect.
          try {
            const body = element.contentDocument?.body;
            return Boolean(body && (body.textContent.trim()
              || body.querySelector('a[href], img[src], video, canvas, object, embed, iframe[src]:not([src="about:blank"])')));
          } catch {
            return Boolean(element.getAttribute('src') && element.getAttribute('src') !== 'about:blank');
          }
        }
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
    if (state.started || state.terminal || !state.node.isConnected || !resultReady(state) || !eligible() || blocked()) return;
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
      script.onerror = () => { if (!tryFallback(state, 'native-failed')) collapse(state, 'failed'); };
      const container = document.createElement('div'); container.id = state.unit.containerId;
      watchForFill(state, container);
      state.mount.append(script, container);
    }
  }
  function makeSlot(zone, unit, anchor, existing = null, fallbackUnit = null) {
    if (slots.has(zone)) return;
    const node = existing || document.createElement('aside'); node.hidden = true;
    node.setAttribute('aria-label', 'Advertisement'); node.classList.add('gxa-ad-network');
    node.dataset.adLayoutZone = zone; node.dataset.adPlacement = zone;
    node.dataset.adFormat = unit.key ? `${unit.width}x${unit.height}` : 'native';
    node.dataset.adUnitId = String(unit.unitId || '');
    node.dataset.adScriptUrl = unit.src;
    node.dataset.adState = 'waiting'; delete node.dataset.adCollapseReason;
    if (!existing) {
      node.dataset.adZone = zone;
      const label = document.createElement('span'); label.className = 'tool-ad-label'; label.textContent = 'Advertisement';
      const mount = document.createElement('div'); mount.dataset.adUnitMount = ''; node.append(label, mount);
      if (zone === 'left') anchor.before(node); else anchor.after(node);
    }
    const sentinel = document.createElement('div'); sentinel.className = 'gxa-ad-sentinel'; sentinel.setAttribute('aria-hidden', 'true'); sentinel.dataset.adSentinelZone = zone; node.before(sentinel);
    const state = { node, unit, fallbackUnit, sentinel, mount: node.querySelector('[data-ad-unit-mount]'), started: false, terminal: false };
    slots.set(zone, state);
    if (zone === 'right' || zone === 'left') {
      node.classList.add('gxa-ad-rail'); node.style.width = `${unit.width}px`;
      updateRailLayout(node.closest('.tool-container') || (node.parentElement === document.body ? document.body : null));
    }
    if (!window.IntersectionObserver) return;
    state.intersection = new IntersectionObserver(entries => { if (resultReady(state) && entries.some(entry => entry.isIntersecting)) request(state); }, { rootMargin: '200px 0px' });
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
    if (!id) {
      const search = main.querySelector('.command-search-section');
      const available = search?.querySelector('.container')?.getBoundingClientRect().width || 0;
      const size = innerWidth >= 1280 && available >= 728 ? [728, 90]
        : innerWidth >= 768 && available >= 468 ? [468, 60]
          : available >= 320 ? [320, 50] : null;
      const unit = size && config.banners.find(item => item.enabled && item.width === size[0] && item.height === size[1]);
      if (config.zones.top && search && unit) makeSlot('home-top', unit, search);
      if (config.native.enabled && config.zones.content) editorial(main, id);
      return;
    }
    // The dedicated React editor owns #root. Put rails beside that root only
    // while its upload screen exists; never insert nodes inside React's tree.
    if (id === 'background-remover' && main?.id === 'root') {
      const upload = main.querySelector('.upload-page'), drop = upload?.querySelector('.drop-zone');
      if (!drop || !window.GxaAdLayout) return;
      if (config.native.enabled && config.zones.afterTool) makeSlot('after-tool', config.native, main);
      const usable = Math.max(0, innerWidth - 64 - 760);
      const rightSpace = usable >= 324 ? 324 : 0;
      const layout = window.GxaAdLayout.plan(config, { tool: id, viewport: innerWidth, inlineWidth: 760, leftSpace: Math.max(0, usable - rightSpace - 24), rightSpace, railEligible: true });
      for (const item of layout.filter(item => item.zone === 'left' || item.zone === 'right')) {
        makeSlot(item.zone, item.unit, main);
        const node = slots.get(item.zone)?.node;
        if (node) node.style.marginTop = `${Math.max(0, Math.round(drop.getBoundingClientRect().top - main.getBoundingClientRect().top))}px`;
      }
      return;
    }
    const header = main.querySelector('.tool-header'), shell = header?.parentElement;
    // React owns its editor DOM: retain its dedicated outside-editor placement.
    if (!header || !shell || !window.GxaAdLayout) { if (config.native.enabled && (config.zones.afterTool || config.zones.content)) editorial(main, id); return; }
    shell.classList.add('gxa-ad-layout-shell');
    const workspace = [...shell.children].find(child => child.matches('.tool-workspace, #edit-pdf-mount, #image-converter-mount, #crop-editor-workspace, #gps-map-camera-mount'));
    const canUseRails = Boolean(workspace && shell.dataset.disclosure !== 'ready' && workspace.getBoundingClientRect().width > 0);
    const reservedWorkspace = Math.max(760, Math.min(820, workspace?.getBoundingClientRect().width || 760));
    const usable = Math.max(0, innerWidth - 64 - reservedWorkspace);
    const rightSpace = usable >= 324 ? 324 : 0;
    const leftSpace = Math.max(0, usable - rightSpace - 24);
    const width = header.getBoundingClientRect().width;
    const sections = [...main.querySelectorAll('.tool-content-guide .tool-info-section')];
    const guideSections = sections.map(section => section.textContent.trim().length);
    lastGuide = main.querySelector('.tool-content-guide');
    lastGuideSignature = guideSections.join(',');
    lastAfterMarker = main.querySelector('[data-ad-zone="ad-slot-after-tool"], [data-ad-zone="ad-slot-content-1"]');
    const layout = window.GxaAdLayout.plan(config, { tool: id, viewport: innerWidth, inlineWidth: width, leftSpace: canUseRails ? leftSpace : 0, rightSpace: canUseRails ? rightSpace : 0, railEligible: canUseRails, guideSections });
    for (const item of layout) {
      if (item.zone === 'top') makeSlot(item.zone, item.unit, header, null, item.fallbackUnit);
      else if (item.zone === 'right' || item.zone === 'left') makeSlot(item.zone, item.unit, workspace, null, item.fallbackUnit);
      else if (item.zone === 'after-tool') {
        const existing = main.querySelector('[data-ad-zone="ad-slot-after-tool"], [data-ad-zone="ad-slot-content-1"]');
        const guide = main.querySelector('.tool-content-guide');
        // Legacy dedicated tools placed their candidate after the guide. Move
        // only that empty marker, never the workspace/result/reset controls.
        if (existing && guide && existing.parentElement === guide.parentElement && (guide.compareDocumentPosition(existing) & Node.DOCUMENT_POSITION_FOLLOWING)) guide.before(existing);
        if (existing) makeSlot(item.zone, item.unit, null, existing, item.fallbackUnit);
      } else if (item.zone === 'content-middle') makeSlot(item.zone, item.unit, sections[1]);
      else if (item.zone === 'content-lower') makeSlot(item.zone, item.unit, sections[2]);
    }
  }
  function sync() {
    if (!eligible() || blocked()) { for (const state of slots.values()) if (state.started) collapse(state, 'suppressed'); return; }
    if (requested && requestedPath !== location.pathname) { for (const state of slots.values()) collapse(state, 'removed'); return; }
    if (plannedPath !== location.pathname) {
      for (const state of slots.values()) collapse(state, 'removed'); slots.clear();
      plannedPath = location.pathname; plan();
    }
    const currentShell = document.querySelector('#main-content .tool-container');
    if (currentShell?.dataset.disclosure === 'ready') {
      for (const zone of ['left', 'right']) {
        const state = slots.get(zone);
        if (state && !state.terminal) collapse(state, 'workspace-expanded');
      }
    }
    if (location.pathname === '/background-remover/') {
      if (!document.querySelector('#root .upload-page')) {
        for (const zone of ['left', 'right']) {
          const state = slots.get(zone);
          if (state && !state.terminal) collapse(state, 'workspace-expanded');
        }
      } else if (!slots.has('right') && !slots.has('left')) plan();
    }
    // Static shells hydrate in stages. Recheck only missing zones; makeSlot is
    // idempotent, so existing provider requests are never replayed.
    if (location.pathname === '/' && (!slots.has('home-top') || !slots.has('content-middle'))) plan();
    else if (location.pathname !== '/' && document.querySelector('.tool-header')) {
      const main = document.querySelector('#main-content, #root');
      const guide = main?.querySelector('.tool-content-guide');
      const signature = [...(guide?.querySelectorAll('.tool-info-section') || [])].map(section => section.textContent.trim().length).join(',');
      const marker = main?.querySelector('[data-ad-zone="ad-slot-after-tool"], [data-ad-zone="ad-slot-content-1"]');
      if (guide !== lastGuide || signature !== lastGuideSignature || marker !== lastAfterMarker) plan();
    }
    for (const state of slots.values()) {
      if (!state.node.isConnected && !state.terminal) collapse(state, 'removed');
      if (state.started && !state.terminal && state.container) ready(state, state.container);
      if (!state.started && !state.terminal && resultReady(state) && window.IntersectionObserver && state.sentinel.isConnected) {
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
      const fits = rect && (rail ? innerWidth >= (zone === 'left' ? 1440 : 1280) && state.node.getBoundingClientRect().width >= state.unit.width : rect.width >= state.unit.width);
      if (!fits) collapse(state, 'resized');
    }
  }
  const schedule = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; sync(); }); };
  window.GxaAdNetwork = Object.freeze({ sync, eligible, hasRequested: () => requested });
  function start() {
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-result-ready', 'data-gxa-last-processing-error'] });
    document.addEventListener('focusout', schedule);
    // Browser capture/orientation can briefly report a 1px viewport. Only retire
    // an impression after dimensions settle; never remount it to recover.
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }); sync();
  }
  window.addEventListener('popstate', () => { if (requested && requestedPath !== location.pathname) location.reload(); else schedule(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
