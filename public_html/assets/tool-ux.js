(function () {
  'use strict';
  // Existing validators/processors own file state; this only discloses controls.
  function hide(element, hidden) {
    if (element && element.hidden !== hidden) element.hidden = hidden;
  }
  function sync() {
    const page = document.querySelector('#main-content .tool-container');
    if (!page || page.hasAttribute('data-static-route-shell')) return;
    const crop = page.querySelector('#crop-editor-workspace');
    const converter = page.querySelector('.image-converter__grid');
    const shared = page.querySelector('.tool-workspace[data-tool-id]');
    // Keep the alternate text input on the hybrid HTML-to-PDF tool accessible.
    const fileWorkspace = shared && page.querySelector('#file-picker') && shared.dataset.toolId !== 'html-to-pdf';
    if (!crop && !converter && !fileWorkspace) return;
    const ready = crop ? !page.querySelector('#crop-width')?.disabled
      : converter ? !page.querySelector('.image-converter__original')?.hidden
      : typeof appState !== 'undefined' && appState.activeFiles.length > 0;
    const state = ready ? 'ready' : 'upload';
    if (page.dataset.disclosure !== state) page.dataset.disclosure = state;
    const selectors = crop
      ? '.crop-editor-toolbar, .crop-options-panel, .crop-shortcuts, .crop-mobile-primary-actions'
      : converter ? '.image-converter__settings'
      : '.tool-sidebar-settings, .premium-session-panel';
    page.querySelectorAll(selectors).forEach(element => hide(element, !ready));
    const toolbar = page.querySelector('#premium-editor-toolbar');
    if (toolbar) hide(toolbar, !ready || !toolbar.childElementCount);
    page.querySelectorAll('.studio-mobile-settings-toggle').forEach(element => hide(element, !ready));
    page.querySelectorAll('.tool-preworkspace-intro').forEach(element => hide(element, true));
    if (converter) {
      const status = page.querySelector('.image-converter__status');
      if (status && status.parentElement !== converter.parentElement) converter.before(status);
      const notice = page.querySelector('.image-converter__notice');
      if (notice && (converter.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_PRECEDING)) converter.after(notice);
    }
    if (fileWorkspace) {
      const settings = page.querySelector('.tool-options-panel');
      const action = page.querySelector('#btn-process-action');
      const queue = page.querySelector('#tool-queue-mount');
      if (settings && action && action.parentElement !== settings) settings.appendChild(action);
      hide(action, !ready || Boolean(queue?.classList.contains('hidden')));
    }
  }
  window.GxaToolUx = Object.freeze({ sync });
  function start() {
    const main = document.getElementById('main-content');
    if (!main) return;
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; sync(); });
    }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'disabled'] });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
