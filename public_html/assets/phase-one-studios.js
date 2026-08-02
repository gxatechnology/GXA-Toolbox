(function () {
  'use strict';

  const IMAGE_MODES = Object.freeze([
    ['compress-image', 'Compress', 'minimize-2'],
    ['resize-image', 'Resize', 'maximize-2'],
    ['crop-image', 'Crop', 'crop'],
    ['background-remover', 'Background', 'scan-line'],
    ['color-extractor', 'Palette', 'palette'],
    ['exif-viewer', 'Metadata', 'tags'],
    ['webp-to-jpg', 'Convert', 'repeat-2'],
    ['svg-to-png', 'SVG export', 'image'],
    ['png-to-svg', 'SVG wrap', 'file-code-2']
  ]);

  const PDF_MODES = Object.freeze([
    ['merge-pdf', 'Merge', 'files'],
    ['organize-pdf', 'Organize', 'layout-grid'],
    ['split-pdf', 'Split', 'scissors'],
    ['remove-pdf-pages', 'Remove', 'trash-2'],
    ['extract-pdf-pages', 'Extract', 'copy'],
    ['rotate-pdf', 'Rotate', 'rotate-cw'],
    ['crop-pdf', 'Crop', 'crop'],
    ['compress-pdf', 'Compress', 'minimize-2'],
    ['watermark-pdf', 'Watermark', 'stamp'],
    ['pagenumber-pdf', 'Numbers', 'list-ordered'],
    ['header-footer-pdf', 'Header/footer', 'panel-top'],
    ['sign-pdf', 'Sign', 'pen-tool'],
    ['pdf-metadata', 'Metadata', 'tags'],
    ['pdf-to-image', 'To image', 'images'],
    ['image-to-pdf', 'From image', 'image-plus'],
    ['pdf-to-text', 'Text', 'text-search'],
    ['pdf-to-word', 'Text/RTF', 'file-type-2'],
    ['extract-images-pdf', 'Extract images', 'image-down'],
    ['ocr-pdf', 'OCR', 'scan-text'],
    ['word-to-pdf', 'Word import', 'file-text'],
    ['excel-to-pdf', 'Excel import', 'file-spreadsheet'],
    ['ppt-to-pdf', 'PPT import', 'presentation'],
    ['pdf-to-excel', 'To Excel', 'sheet'],
    ['pdf-to-ppt', 'To PPT', 'panels-top-left'],
    ['repair-pdf', 'Repair', 'wrench'],
    ['protect-pdf', 'Protect', 'lock'],
    ['unlock-pdf', 'Unlock', 'unlock']
  ]);

  const imageRouteIds = new Set(IMAGE_MODES.map(([id]) => id));
  const PDF_ROUTE_MODE_ALIASES = Object.freeze({
    'pdf-to-jpg': 'pdf-to-image',
    'pdf-to-png': 'pdf-to-image',
    'jpg-to-pdf': 'image-to-pdf',
    'png-to-pdf': 'image-to-pdf'
  });
  const pdfRouteIds = new Set([
    ...PDF_MODES.map(([id]) => id),
    'organize-pdf', 'pdf-to-jpg', 'jpg-to-pdf', 'png-to-pdf', 'pdf-to-png',
    'extract-images-pdf', 'ocr-pdf', 'pdf-to-word', 'word-to-pdf', 'excel-to-pdf',
    'ppt-to-pdf', 'pdf-to-excel', 'pdf-to-ppt'
  ]);

  let cleanupHandlers = [];

  function studioForRoute(toolId) {
    if (imageRouteIds.has(toolId)) return { kind: 'image', title: 'Image Studio', modes: IMAGE_MODES };
    if (pdfRouteIds.has(toolId)) return { kind: 'pdf', title: 'PDF Studio', modes: PDF_MODES };
    return null;
  }

  function dispose() {
    window.GxaImageAnnotations?.dispose();
    cleanupHandlers.forEach((cleanup) => cleanup());
    cleanupHandlers = [];
  }

  function createModeRail(studio, toolId) {
    const rail = document.createElement('nav');
    rail.className = 'phase-one-studio-rail';
    rail.setAttribute('aria-label', `${studio.title} modes`);
    const heading = document.createElement('span');
    heading.className = 'studio-rail-heading';
    heading.textContent = 'Modes';
    rail.appendChild(heading);
    const activeModeId = studio.kind === 'pdf' ? (PDF_ROUTE_MODE_ALIASES[toolId] || toolId) : toolId;
    studio.modes.forEach(([id, label, icon]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `studio-mode-button${id === activeModeId ? ' active' : ''}`;
      button.setAttribute('aria-current', id === activeModeId ? 'page' : 'false');
      button.setAttribute('aria-label', `${label} mode`);
      button.innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`;
      button.addEventListener('click', () => {
        if (id !== toolId && typeof window.navigate === 'function') window.navigate(`tool-${id}`);
      });
      rail.appendChild(button);
    });
    return rail;
  }

  function createStatusBar(studio, profile) {
    const status = document.createElement('footer');
    status.className = 'phase-one-studio-status';
    status.setAttribute('aria-label', `${studio.title} status`);
    status.innerHTML = `
      <span><i data-lucide="shield-check"></i>${profile?.label || 'Processing profile available'}</span>
      <span id="studio-file-status">Waiting for a file</span>
      <span class="studio-shortcuts">Ctrl/Cmd+Enter process &middot; Ctrl/Cmd+Z undo &middot; +/- zoom</span>
    `;
    return status;
  }

  function bindMobileDrawer(container) {
    const sidebar = container.querySelector('.tool-sidebar-settings, .crop-options-panel');
    const workspace = container.querySelector('.tool-workspace, .crop-editor-grid');
    if (!sidebar || !workspace) return;

    sidebar.id = sidebar.id || 'phase-one-studio-settings';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'studio-mobile-settings-toggle';
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<i data-lucide="sliders-horizontal"></i><span>Settings</span>';
    workspace.appendChild(toggle);

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'studio-drawer-backdrop';
    backdrop.setAttribute('aria-label', 'Close settings');
    container.appendChild(backdrop);

    const drawerClose = document.createElement('button');
    drawerClose.type = 'button';
    drawerClose.className = 'studio-drawer-close';
    drawerClose.setAttribute('aria-label', 'Close tool settings');
    drawerClose.innerHTML = '<i data-lucide="x"></i><span>Close</span>';
    sidebar.prepend(drawerClose);

    const close = () => {
      container.classList.remove('studio-settings-open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      container.classList.add('studio-settings-open');
      toggle.setAttribute('aria-expanded', 'true');
      drawerClose.focus({ preventScroll: true });
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape' && container.classList.contains('studio-settings-open')) {
        close();
        toggle.focus();
      }
    };
    toggle.addEventListener('click', () => container.classList.contains('studio-settings-open') ? close() : open());
    backdrop.addEventListener('click', close);
    drawerClose.addEventListener('click', close);
    document.addEventListener('keydown', onKeydown);
    cleanupHandlers.push(() => document.removeEventListener('keydown', onKeydown));
  }

  function bindStudioFileStatus(container) {
    const status = container.querySelector('#studio-file-status');
    if (!status) return;
    const update = () => {
      const cards = container.querySelectorAll('.file-card, .file-queue-card');
      const previewDetails = container.querySelector('.preview-details')?.textContent?.trim();
      const next = previewDetails || (cards.length ? `${cards.length} file${cards.length === 1 ? '' : 's'} ready` : 'Waiting for a file');
      if (status.textContent !== next) status.textContent = next;
    };
    const observer = new MutationObserver(update);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    update();
    cleanupHandlers.push(() => observer.disconnect());
  }

  function bindPdfPageControls(container, toolId) {
    const selectableModes = new Set([
      'organize-pdf', 'remove-pdf-pages', 'extract-pdf-pages', 'rotate-pdf',
      'crop-pdf', 'watermark-pdf', 'pagenumber-pdf', 'header-footer-pdf', 'sign-pdf'
    ]);
    if (!selectableModes.has(toolId)) return;
    const existingInputs = {
      'organize-pdf': '#opt-range',
      'remove-pdf-pages': '#opt-remove-pages',
      'extract-pdf-pages': '#opt-extract-pages'
    };
    let input = container.querySelector(existingInputs[toolId] || '#studio-pdf-page-selection');
    if (!input) {
      const panel = container.querySelector('.tool-options-panel');
      if (!panel) return;
      const group = document.createElement('fieldset');
      group.className = 'studio-page-selection';
      group.innerHTML = `
        <legend>Apply to pages</legend>
        <label for="studio-pdf-page-selection">Page numbers or ranges</label>
        <input id="studio-pdf-page-selection" class="form-input-text" type="text" placeholder="All pages" aria-describedby="studio-page-selection-help">
        <div class="studio-page-selection-presets" role="group" aria-label="Page selection presets">
          <button type="button" data-page-preset="all">All</button>
          <button type="button" data-page-preset="odd">Odd</button>
          <button type="button" data-page-preset="even">Even</button>
        </div>
        <small id="studio-page-selection-help">Click page thumbnails to build a visual selection. Leave empty for every page.</small>
      `;
      panel.querySelector('.options-title')?.insertAdjacentElement('afterend', group);
      input = group.querySelector('input');
      group.addEventListener('click', (event) => {
        const preset = event.target.closest('[data-page-preset]')?.dataset.pagePreset;
        if (!preset) return;
        input.value = preset === 'all' ? '' : preset;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    } else {
      input.dataset.studioPageSelection = 'true';
    }
  }

  function bindImageRenderControls(container, toolId) {
    if (!['compress-image', 'resize-image', 'webp-to-jpg'].includes(toolId)) return;
    const panel = container.querySelector('.tool-options-panel');
    if (!panel || panel.querySelector('#studio-image-adjustments')) return;
    const controls = document.createElement('fieldset');
    controls.id = 'studio-image-adjustments';
    controls.className = 'studio-image-adjustments';
    controls.innerHTML = `
      <legend>Image Studio adjustments</legend>
      <div class="studio-transform-grid">
        <label>Rotate
          <select id="studio-image-rotation" class="form-input-text">
            <option value="0">0°</option><option value="90">90° right</option>
            <option value="180">180°</option><option value="270">90° left</option>
          </select>
        </label>
        <label class="checkbox-label"><input id="studio-image-flip-x" type="checkbox"><span class="custom-checkbox"></span>Flip horizontal</label>
        <label class="checkbox-label"><input id="studio-image-flip-y" type="checkbox"><span class="custom-checkbox"></span>Flip vertical</label>
      </div>
      <label class="studio-adjustment-row"><span>Brightness <output id="studio-brightness-output">100%</output></span><input id="studio-image-brightness" type="range" min="0" max="200" value="100"></label>
      <label class="studio-adjustment-row"><span>Contrast <output id="studio-contrast-output">100%</output></span><input id="studio-image-contrast" type="range" min="0" max="200" value="100"></label>
      <label class="studio-adjustment-row"><span>Saturation <output id="studio-saturation-output">100%</output></span><input id="studio-image-saturation" type="range" min="0" max="200" value="100"></label>
      <label class="studio-adjustment-row"><span>Grayscale <output id="studio-grayscale-output">0%</output></span><input id="studio-image-grayscale" type="range" min="0" max="100" value="0"></label>
      <label class="studio-adjustment-row"><span>Blur <output id="studio-blur-output">0 px</output></span><input id="studio-image-blur" type="range" min="0" max="20" step="0.5" value="0"></label>
      <div class="studio-watermark-controls">
        <label for="studio-image-watermark">Text watermark</label>
        <input id="studio-image-watermark" class="form-input-text" type="text" maxlength="120" placeholder="Optional watermark">
        <label class="studio-adjustment-row"><span>Watermark opacity <output id="studio-watermark-opacity-output">35%</output></span><input id="studio-image-watermark-opacity" type="range" min="5" max="100" value="35"></label>
      </div>
      <button type="button" class="studio-reset-adjustments">Reset adjustments</button>
      <small>Canvas exports are rendered from the original source pixels and omit EXIF metadata.</small>
    `;
    panel.querySelector('.options-title')?.insertAdjacentElement('afterend', controls);

    const ids = ['brightness', 'contrast', 'saturation', 'grayscale', 'blur'];
    const update = () => {
      ids.forEach(id => {
        const input = controls.querySelector(`#studio-image-${id}`);
        const output = controls.querySelector(`#studio-${id}-output`);
        if (output) output.textContent = `${input.value}${id === 'blur' ? ' px' : '%'}`;
      });
      controls.querySelector('#studio-watermark-opacity-output').textContent = `${controls.querySelector('#studio-image-watermark-opacity').value}%`;
      const image = container.querySelector('.uploaded-image-preview');
      if (image) {
        image.style.filter = `brightness(${controls.querySelector('#studio-image-brightness').value}%) contrast(${controls.querySelector('#studio-image-contrast').value}%) saturate(${controls.querySelector('#studio-image-saturation').value}%) grayscale(${controls.querySelector('#studio-image-grayscale').value}%) blur(${controls.querySelector('#studio-image-blur').value}px)`;
        image.dataset.studioRotation = controls.querySelector('#studio-image-rotation').value;
        image.dataset.studioFlipX = controls.querySelector('#studio-image-flip-x').checked ? '-1' : '1';
        image.dataset.studioFlipY = controls.querySelector('#studio-image-flip-y').checked ? '-1' : '1';
        image.dispatchEvent(new CustomEvent('gxa:studio-image-view'));
        const surface = image.closest('.image-pan-surface');
        let watermark = surface?.querySelector('.studio-watermark-preview');
        if (surface && !watermark) {
          watermark = document.createElement('span');
          watermark.className = 'studio-watermark-preview';
          surface.appendChild(watermark);
        }
        if (watermark) {
          watermark.textContent = controls.querySelector('#studio-image-watermark').value;
          watermark.style.opacity = String(Number(controls.querySelector('#studio-image-watermark-opacity').value) / 100);
        }
      }
    };
    const onInput = () => update();
    controls.addEventListener('input', onInput);
    controls.querySelector('.studio-reset-adjustments').addEventListener('click', () => {
      controls.querySelector('#studio-image-rotation').value = '0';
      controls.querySelector('#studio-image-flip-x').checked = false;
      controls.querySelector('#studio-image-flip-y').checked = false;
      ['brightness', 'contrast', 'saturation'].forEach(id => { controls.querySelector(`#studio-image-${id}`).value = '100'; });
      ['grayscale', 'blur'].forEach(id => { controls.querySelector(`#studio-image-${id}`).value = '0'; });
      controls.querySelector('#studio-image-watermark').value = '';
      controls.querySelector('#studio-image-watermark-opacity').value = '35';
      update();
    });
    const observer = new MutationObserver(() => {
      if (container.querySelector('.uploaded-image-preview')) {
        observer.disconnect();
        update();
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    cleanupHandlers.push(() => observer.disconnect());
    update();
  }

  function decorate(toolId, profile) {
    dispose();
    const studio = studioForRoute(toolId);
    if (!studio) return false;
    const container = document.querySelector('.tool-container');
    if (!container) return false;

    container.classList.add('phase-one-studio-page', `${studio.kind}-studio-page`);
    container.dataset.studioMode = toolId;
    const header = container.querySelector('.tool-header');
    const heading = header?.querySelector('.tool-heading-group > div');
    if (heading && !heading.querySelector('.studio-product-label')) {
      const label = document.createElement('span');
      label.className = 'studio-product-label';
      label.textContent = `${studio.title} · ${studio.kind === 'image' ? 'Original-resolution canvas' : 'Document workspace'}`;
      heading.prepend(label);
    }

    const workspace = container.querySelector('.tool-workspace, .crop-editor-grid');
    if (!workspace) return false;
    const frame = document.createElement('div');
    frame.className = 'phase-one-studio-frame';
    workspace.parentNode.insertBefore(frame, workspace);
    frame.append(createModeRail(studio, toolId), workspace);
    workspace.appendChild(createStatusBar(studio, profile));

    const errorRegion = document.createElement('div');
    errorRegion.className = 'studio-announcement sr-only';
    errorRegion.setAttribute('role', 'status');
    errorRegion.setAttribute('aria-live', 'polite');
    workspace.appendChild(errorRegion);

    bindMobileDrawer(container);
    if (studio.kind === 'pdf') bindPdfPageControls(container, toolId);
    if (studio.kind === 'image') {
      bindImageRenderControls(container, toolId);
      if (['compress-image', 'resize-image', 'webp-to-jpg'].includes(toolId)) window.GxaImageAnnotations?.attach(container);
    }
    bindStudioFileStatus(container);
    window.lucide?.createIcons();
    return true;
  }

  window.GxaPhaseOneStudios = Object.freeze({
    decorate,
    dispose,
    studioForRoute,
    imageRoutes: Object.freeze(Array.from(imageRouteIds)),
    pdfRoutes: Object.freeze(Array.from(pdfRouteIds))
  });
})();
