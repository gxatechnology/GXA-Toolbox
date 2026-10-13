(function () {
  'use strict';
  // Existing validators/processors own file state; this only discloses controls.
  function hide(element, hidden) {
    if (element && element.hidden !== hidden) element.hidden = hidden;
  }
  function visible(element) {
    return Boolean(element && !element.hidden && !element.classList.contains('hidden') && element.getClientRects().length);
  }
  function styleOptionalFileInputs(page) {
    for (const input of page.querySelectorAll('input[type="file"].form-input-text, .gps-studio__logo')) {
      if (input.closest('.tool-file-control')) continue;
      const wrapper = document.createElement('span');
      wrapper.className = 'tool-file-control';
      const caption = document.createElement('span');
      caption.textContent = input.multiple ? 'Select files' : 'Select file';
      caption.setAttribute('aria-hidden', 'true');
      if (!input.hasAttribute('aria-label') && !input.labels?.length) input.setAttribute('aria-label', caption.textContent);
      input.before(wrapper);
      wrapper.append(caption, input);
      input.addEventListener('change', () => { caption.textContent = input.files?.length ? `${input.files.length} file${input.files.length === 1 ? '' : 's'} selected` : input.multiple ? 'Select files' : 'Select file'; });
    }
  }
  // A presentation projection of engine-owned state, never a replacement for it.
  function describeState(page, ready) {
    const busy = page.querySelector('[aria-busy="true"]');
    const processing = visible(page.querySelector('#tool-processing-mount')) || Boolean(busy) || (ready && Boolean(page.querySelector('#crop-apply-button')?.disabled));
    const error = [...page.querySelectorAll('.is-error, #crop-library-error, .tool-workspace-error')].some(el => visible(el) && el.textContent.trim());
    const result = ['#tool-complete-mount', '.image-converter__result', '.gps-studio__result', '[data-result-ready="true"]'].some(selector => visible(page.querySelector(selector)))
      || (page.querySelector('#crop-editor-workspace') && typeof cropEditorState !== 'undefined' && Boolean(cropEditorState.resultBlob));
    const state = processing ? 'processing' : error ? 'error' : result ? 'result' : ready ? 'loaded' : 'empty';
    if (page.dataset.workspaceState !== state) page.dataset.workspaceState = state;
  }
  function sync() {
    const page = document.querySelector('#main-content .tool-container');
    if (!page || page.hasAttribute('data-static-route-shell')) return;
    styleOptionalFileInputs(page);
    const gps = page.querySelector('.gps-studio');
    if (gps) {
      const ready = !gps.querySelector('.gps-studio__photo').hidden;
      const state = ready ? 'ready' : 'upload';
      if (page.dataset.disclosure !== state) page.dataset.disclosure = state;
      describeState(page, ready);
      hide(gps.querySelector('.gps-studio__settings'), !ready);
      // Errors during upload/camera access must remain visible outside settings.
      const status = gps.querySelector('.gps-studio__status');
      if (status && status.parentElement !== gps) gps.appendChild(status);
      const notice = gps.querySelector('.gps-studio__notice');
      if (notice && notice.previousElementSibling === null) gps.appendChild(notice);
      return;
    }
    const pdfEditor = page.querySelector('.pdf-edit');
    if (pdfEditor) {
      // Presentation only: the editor still owns loading, reset and document state.
      const wasReady = page.dataset.disclosure === 'ready';
      const state = pdfEditor.querySelector('.pdf-edit-document')?.hidden ? 'upload' : 'ready';
      if (page.dataset.disclosure !== state) page.dataset.disclosure = state;
      hide(pdfEditor.querySelector('.pdf-edit-upload'), state === 'ready');
      if (wasReady && state === 'upload') pdfEditor.querySelector('#pdf-edit-file')?.focus();
      describeState(page, state === 'ready');
      return;
    }
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
    describeState(page, ready);
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
  function setError(message = '') {
    const page = document.querySelector('#main-content .tool-container');
    if (!page) return;
    let notice = page.querySelector('.tool-workspace-error');
    if (!notice && message) {
      notice = document.createElement('p');
      notice.className = 'tool-workspace-error';
      notice.setAttribute('role', 'alert');
      page.querySelector('.tool-workspace')?.after(notice);
    }
    if (notice) { notice.textContent = message; notice.hidden = !message; }
    if (!message) delete document.body.dataset.gxaLastProcessingError;
    sync();
  }
  window.GxaToolUx = Object.freeze({ sync, setError });
  function start() {
    const main = document.getElementById('main-content');
    if (!main) return;
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; sync(); });
    }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'disabled', 'aria-busy', 'data-result-ready'] });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
