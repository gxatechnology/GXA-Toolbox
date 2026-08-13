(function () {
  'use strict';

  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const activeObjectUrls = new Set();
  const scriptLoads = new Map();
  let pdfJsPromise = null;
  let pasteHandler = null;

  const blockers = Object.freeze({
    'ppt-to-pdf': 'Faithful presentation-to-PDF layout conversion requires a presentation renderer such as LibreOffice, which is not included in this deployment. No file is uploaded or processed.',
  });

  const serverTools = new Set([]);
  const capabilityTools = new Set(['qr-reader', 'barcode-reader']);

  function loadScriptOnce(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (scriptLoads.has(src)) return scriptLoads.get(src);
    const existing = document.querySelector(`script[data-gxa-src="${src}"]`);
    if (existing?.dataset.gxaLoadState === 'failed') existing.remove();
    const script = existing?.isConnected ? existing : document.createElement('script');
    const promise = new Promise((resolve, reject) => {
      const complete = () => {
        script.dataset.gxaLoadState = 'loaded';
        resolve(globalName ? window[globalName] : true);
      };
      const fail = () => {
        script.dataset.gxaLoadState = 'failed';
        script.remove();
        reject(new Error('A required processing library could not be loaded. Check your network connection and retry.'));
      };
      if (script.dataset.gxaLoadState === 'loaded') {
        complete();
        return;
      }
      script.addEventListener('load', complete, { once: true });
      script.addEventListener('error', fail, { once: true });
      if (script.isConnected) return;
      script.src = src;
      script.async = true;
      script.dataset.gxaSrc = src;
      script.dataset.gxaLoadState = 'loading';
      document.head.appendChild(script);
    });
    scriptLoads.set(src, promise);
    promise.catch(() => scriptLoads.delete(src));
    return promise;
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    if (!pdfJsPromise) {
      const src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      pdfJsPromise = loadScriptOnce(src, 'pdfjsLib').then((pdfjsLib) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        return pdfjsLib;
      });
    }
    return pdfJsPromise;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  function safeFileName(name) {
    const cleaned = String(name || 'output')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\.\.+/g, '.')
      .trim();
    return cleaned || 'output';
  }

  function matchesAccept(file, accept) {
    if (!accept || accept === '*' || accept === '*/*') return true;
    return accept.split(',').some((rawRule) => {
      const rule = rawRule.trim().toLowerCase();
      const type = (file.type || '').toLowerCase();
      const name = (file.name || '').toLowerCase();
      if (!rule) return false;
      if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
      if (rule.startsWith('.')) return name.endsWith(rule);
      return type === rule;
    });
  }

  function validateFiles(fileList, options) {
    const files = Array.from(fileList || []);
    const accepted = [];
    const errors = [];
    const seen = new Set();
    const accept = options && options.accept ? options.accept : '*';
    const multiple = !options || options.multiple !== false;
    const maxSize = options && options.maxSize ? options.maxSize : MAX_FILE_SIZE;

    for (const file of files) {
      const identity = `${file.name}:${file.size}:${file.lastModified}`;
      if (seen.has(identity)) {
        errors.push(`${file.name}: duplicate file ignored.`);
        continue;
      }
      seen.add(identity);
      if (file.size === 0) {
        errors.push(`${file.name}: the file is empty.`);
      } else if (file.size > maxSize) {
        errors.push(`${file.name}: exceeds the ${formatBytes(maxSize)} limit.`);
      } else if (!matchesAccept(file, accept)) {
        errors.push(`${file.name}: unsupported file type. Accepted: ${accept}.`);
      } else {
        accepted.push(file);
      }
      if (!multiple && accepted.length === 1) break;
    }
    return { accepted, errors };
  }

  function getBlocker(toolId) {
    return blockers[toolId] || '';
  }

  function getProcessingProfile(toolId) {
    if (blockers[toolId]) return { kind: 'dependency', label: 'Presentation renderer unavailable', detail: blockers[toolId] };
    if (toolId === 'background-remover') return { kind: 'local', label: 'Runs locally in your browser', detail: 'Background removal runs locally in your browser after the segmentation engine loads. Your image is not uploaded for automatic subject removal.' };
    if (serverTools.has(toolId)) return { kind: 'server', label: 'Secure server processing', detail: 'The selected file is uploaded to the GXA Toolbox server for processing.' };
    if (capabilityTools.has(toolId)) {
      const supported = 'BarcodeDetector' in window && 'createImageBitmap' in window;
      return supported
        ? { kind: 'local', label: 'Supported in this browser', detail: 'Barcode detection and image decoding are available and run locally in this browser.' }
        : { kind: 'capability', label: 'Barcode scanning unavailable', detail: 'This browser does not expose the BarcodeDetector and createImageBitmap features required for local scanning.' };
    }
    return { kind: 'local', label: 'Processed in your browser', detail: 'The operation runs locally in this browser unless the tool page states otherwise.' };
  }

  function revokeObjectUrls() {
    activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    activeObjectUrls.clear();
  }

  function dispose() {
    revokeObjectUrls();
    if (pasteHandler) {
      document.removeEventListener('paste', pasteHandler);
      pasteHandler = null;
    }
  }

  function makeObjectUrl(file) {
    const url = URL.createObjectURL(file);
    activeObjectUrls.add(url);
    return url;
  }

  function renderError(mount, message) {
    mount.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'preview-error-state';
    panel.setAttribute('role', 'alert');
    const title = document.createElement('strong');
    title.textContent = 'Preview unavailable';
    const body = document.createElement('p');
    body.textContent = message;
    panel.append(title, body);
    mount.appendChild(panel);
  }

  function createPreviewShell(file, index, total) {
    const shell = document.createElement('section');
    shell.className = 'file-preview-shell';
    shell.setAttribute('aria-label', `Preview of ${file.name}`);
    shell.innerHTML = `
      <div class="preview-toolbar">
        <div>
          <strong class="preview-file-name"></strong>
          <span class="preview-file-meta"></span>
        </div>
        <span class="preview-count">${index + 1} of ${total}</span>
      </div>
      <div class="preview-stage" id="gxa-preview-stage"></div>
      <div class="preview-details" id="gxa-preview-details"></div>
    `;
    shell.querySelector('.preview-file-name').textContent = file.name;
    shell.querySelector('.preview-file-meta').textContent = `${file.type || 'Unknown type'} • ${formatBytes(file.size)}`;
    return shell;
  }

  async function renderImagePreview(file, stage, details) {
    const url = makeObjectUrl(file);
    const image = document.createElement('img');
    image.className = 'uploaded-image-preview';
    image.alt = `Preview of ${file.name}`;
    image.src = url;
    let scale = 1;
    let rotation = 0;
    let offsetX = 0;
    let offsetY = 0;
    let actualSize = false;
    let panOrigin = null;
    const pointers = new Map();
    const viewUndo = [];
    const viewRedo = [];

    const controls = document.createElement('div');
    controls.className = 'preview-control-bar';
    controls.innerHTML = `
      <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
      <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
      <button type="button" data-action="fit">Fit</button>
      <button type="button" data-action="actual">100%</button>
      <button type="button" data-action="rotate" aria-label="Rotate preview clockwise">↻</button>
      <button type="button" data-action="reset">Reset view</button>
    `;
    controls.insertAdjacentHTML('afterbegin', '<button type="button" data-action="undo" aria-label="Undo preview view">&#8630;</button><button type="button" data-action="redo" aria-label="Redo preview view">&#8631;</button>');
    controls.querySelector('[data-action="zoom-out"]').insertAdjacentHTML('afterend', '<output data-role="zoom" class="preview-zoom-output">100%</output>');
    const panSurface = document.createElement('div');
    panSurface.className = 'image-pan-surface';
    panSurface.tabIndex = 0;
    panSurface.setAttribute('aria-label', 'Image preview. Drag to pan; use mouse wheel or plus and minus keys to zoom.');
    panSurface.appendChild(image);
    const snapshot = () => ({ scale, rotation, offsetX, offsetY, actualSize, signature: [scale, rotation, offsetX, offsetY, actualSize].join(':') });
    const remember = () => {
      const next = snapshot();
      if (viewUndo[viewUndo.length - 1]?.signature !== next.signature) viewUndo.push(next);
      if (viewUndo.length > 40) viewUndo.shift();
      viewRedo.length = 0;
    };
    const applyView = () => {
      image.style.maxWidth = actualSize ? 'none' : '100%';
      image.style.maxHeight = actualSize ? 'none' : '440px';
      const studioRotation = Number(image.dataset.studioRotation || 0);
      const studioFlipX = Number(image.dataset.studioFlipX || 1);
      const studioFlipY = Number(image.dataset.studioFlipY || 1);
      image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale}) rotate(${rotation + studioRotation}deg) scale(${studioFlipX}, ${studioFlipY})`;
      const zoomLabel = Math.round(scale * 100) + '%';
      controls.querySelector('[data-role="zoom"]').value = zoomLabel;
      controls.querySelector('[data-role="zoom"]').textContent = zoomLabel;
      controls.querySelector('[data-action="undo"]').disabled = viewUndo.length <= 1;
      controls.querySelector('[data-action="redo"]').disabled = viewRedo.length === 0;
    };
    controls.addEventListener('click', (event) => {
      const action = event.target.closest('button')?.dataset.action;
      if (!action) return;
      if (action === 'undo' && viewUndo.length > 1) {
        viewRedo.push(viewUndo.pop());
        const state = viewUndo[viewUndo.length - 1];
        scale = state.scale; rotation = state.rotation; offsetX = state.offsetX; offsetY = state.offsetY; actualSize = state.actualSize;
        applyView();
        return;
      }
      if (action === 'redo' && viewRedo.length) {
        const state = viewRedo.pop();
        viewUndo.push(state);
        scale = state.scale; rotation = state.rotation; offsetX = state.offsetX; offsetY = state.offsetY; actualSize = state.actualSize;
        applyView();
        return;
      }
      if (action === 'zoom-in') scale = Math.min(3, scale + 0.25);
      if (action === 'zoom-out') scale = Math.max(0.25, scale - 0.25);
      if (action === 'fit') { scale = 1; offsetX = 0; offsetY = 0; actualSize = false; }
      if (action === 'actual') { scale = 1; offsetX = 0; offsetY = 0; actualSize = true; }
      if (action === 'rotate') rotation = (rotation + 90) % 360;
      if (action === 'reset') { scale = 1; rotation = 0; offsetX = 0; offsetY = 0; actualSize = false; }
      remember();
      applyView();
    });
    panSurface.addEventListener('wheel', event => {
      event.preventDefault();
      scale = Math.max(0.25, Math.min(3, scale + (event.deltaY < 0 ? 0.1 : -0.1)));
      remember();
      applyView();
    }, { passive: false });
    panSurface.addEventListener('pointerdown', event => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      panSurface.setPointerCapture(event.pointerId);
      if (pointers.size === 1) {
        panOrigin = { x: event.clientX - offsetX, y: event.clientY - offsetY };
        panSurface.classList.add('is-panning');
      }
    });
    panSurface.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      const previous = pointers.get(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const points = Array.from(pointers.values());
        const other = points.find(point => point !== pointers.get(event.pointerId)) || points[0];
        const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
        const newDistance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (oldDistance > 0) scale = Math.max(0.25, Math.min(3, scale * newDistance / oldDistance));
      } else if (panOrigin) {
        offsetX = event.clientX - panOrigin.x;
        offsetY = event.clientY - panOrigin.y;
      }
      applyView();
    });
    const finishPointer = event => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) {
        panOrigin = null;
        panSurface.classList.remove('is-panning');
        remember();
        applyView();
      }
    };
    panSurface.addEventListener('pointerup', finishPointer);
    panSurface.addEventListener('pointercancel', finishPointer);
    panSurface.addEventListener('keydown', event => {
      const step = event.shiftKey ? 24 : 6;
      if (event.key === 'ArrowLeft') offsetX -= step;
      else if (event.key === 'ArrowRight') offsetX += step;
      else if (event.key === 'ArrowUp') offsetY -= step;
      else if (event.key === 'ArrowDown') offsetY += step;
      else if (event.key === '+' || event.key === '=') scale = Math.min(3, scale + 0.1);
      else if (event.key === '-') scale = Math.max(0.25, scale - 0.1);
      else if (event.key === '0') { scale = 1; offsetX = 0; offsetY = 0; actualSize = false; }
      else return;
      event.preventDefault();
      remember();
      applyView();
    });
    image.addEventListener('gxa:studio-image-view', applyView);
    stage.append(controls, panSurface);
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('The browser could not decode this image. It may be corrupted or unsupported.'));
    });
    remember();
    applyView();
    const ratio = image.naturalWidth && image.naturalHeight ? (image.naturalWidth / image.naturalHeight).toFixed(3) : 'Unknown';
    details.textContent = `${image.naturalWidth} × ${image.naturalHeight} px • Aspect ratio ${ratio}:1`;
  }

  async function renderPdfPreview(file, stage, details) {
    const pdfjsLib = await ensurePdfJs();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const activeStudioPage = document.querySelector('.phase-one-studio-page');
    const toolId = activeStudioPage?.dataset.studioMode || document.querySelector('.premium-editor-workspace')?.dataset.toolId || '';
    const pageInputSelector = ({
      'organize-pdf': '#opt-range',
      'remove-pdf-pages': '#opt-remove-pages',
      'extract-pdf-pages': '#opt-extract-pages'
    })[toolId] || '#studio-pdf-page-selection';
    const pageSelectionInput = document.querySelector(pageInputSelector);
    const selectedPages = new Set();
    let lastSelectedPage = 0;
    let draggedThumbnail = null;
    let pointerDrag = null;
    let suppressThumbnailClick = false;
    let currentPage = 1;
    let zoom = 1;
    let rotation = 0;

    const controls = document.createElement('div');
    controls.className = 'preview-control-bar';
    controls.innerHTML = `
      <button type="button" data-action="prev" aria-label="Previous PDF page">Previous</button>
      <span id="pdf-page-indicator">Page 1 of ${pdf.numPages}</span>
      <button type="button" data-action="next" aria-label="Next PDF page">Next</button>
      <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
      <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
      <button type="button" data-action="rotate" aria-label="Rotate preview clockwise">↻</button>
    `;
    if (toolId === 'crop-pdf') controls.querySelector('[data-action="rotate"]')?.remove();
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'pdf-canvas-wrap';
    canvasWrap.tabIndex = 0;
    canvasWrap.setAttribute('aria-label', 'PDF page preview. Use arrow keys for pages and plus or minus to zoom.');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Selected PDF page preview');
    canvasWrap.appendChild(canvas);
    let cropOverlay = null;
    let currentPdfPageSize = null;
    if (toolId === 'crop-pdf') {
      cropOverlay = document.createElement('div');
      cropOverlay.className = 'pdf-crop-overlay';
      cropOverlay.tabIndex = 0;
      cropOverlay.setAttribute('aria-label', 'PDF crop area. Drag to move or use resize handles.');
      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(handle => {
        const grip = document.createElement('span');
        grip.className = `pdf-crop-handle handle-${handle}`;
        grip.dataset.handle = handle;
        cropOverlay.appendChild(grip);
      });
      canvasWrap.appendChild(cropOverlay);
    }
    const thumbs = document.createElement('div');
    thumbs.className = 'pdf-thumbnail-strip';
    stage.append(controls, canvasWrap, thumbs);
    if (pageSelectionInput) {
      controls.insertAdjacentHTML('beforeend', '<output data-role="pdf-selection" class="preview-selection-output">All pages</output>');
    }

    const cropFields = cropOverlay ? {
      top: document.getElementById('opt-crop-top'), bottom: document.getElementById('opt-crop-bottom'),
      left: document.getElementById('opt-crop-left'), right: document.getElementById('opt-crop-right')
    } : null;

    const updateCropOverlayFromFields = () => {
      if (!cropOverlay || !currentPdfPageSize || !canvas.clientWidth || !canvas.clientHeight) return;
      const values = Object.fromEntries(Object.entries(cropFields).map(([key, input]) => [key, Math.max(0, Number(input?.value || 0))]));
      const left = values.left / currentPdfPageSize.width * canvas.clientWidth;
      const top = values.top / currentPdfPageSize.height * canvas.clientHeight;
      const right = values.right / currentPdfPageSize.width * canvas.clientWidth;
      const bottom = values.bottom / currentPdfPageSize.height * canvas.clientHeight;
      cropOverlay.style.left = `${canvas.offsetLeft + left}px`;
      cropOverlay.style.top = `${canvas.offsetTop + top}px`;
      cropOverlay.style.width = `${Math.max(24, canvas.clientWidth - left - right)}px`;
      cropOverlay.style.height = `${Math.max(24, canvas.clientHeight - top - bottom)}px`;
    };

    const updateCropFieldsFromOverlay = () => {
      if (!cropOverlay || !currentPdfPageSize) return;
      const left = cropOverlay.offsetLeft - canvas.offsetLeft;
      const top = cropOverlay.offsetTop - canvas.offsetTop;
      const right = canvas.clientWidth - left - cropOverlay.offsetWidth;
      const bottom = canvas.clientHeight - top - cropOverlay.offsetHeight;
      const values = {
        left: left / canvas.clientWidth * currentPdfPageSize.width,
        right: right / canvas.clientWidth * currentPdfPageSize.width,
        top: top / canvas.clientHeight * currentPdfPageSize.height,
        bottom: bottom / canvas.clientHeight * currentPdfPageSize.height
      };
      Object.entries(values).forEach(([key, value]) => { if (cropFields[key]) cropFields[key].value = Math.max(0, Math.round(value * 10) / 10); });
    };

    if (cropOverlay) {
      Object.values(cropFields).forEach(input => input?.addEventListener('input', updateCropOverlayFromFields));
      cropOverlay.addEventListener('pointerdown', event => {
        event.preventDefault();
        const handle = event.target.dataset.handle || 'move';
        const start = {
          x: event.clientX, y: event.clientY, left: cropOverlay.offsetLeft, top: cropOverlay.offsetTop,
          width: cropOverlay.offsetWidth, height: cropOverlay.offsetHeight
        };
        cropOverlay.setPointerCapture(event.pointerId);
        const onMove = moveEvent => {
          const dx = moveEvent.clientX - start.x;
          const dy = moveEvent.clientY - start.y;
          const canvasLeft = canvas.offsetLeft;
          const canvasTop = canvas.offsetTop;
          const canvasRight = canvasLeft + canvas.clientWidth;
          const canvasBottom = canvasTop + canvas.clientHeight;
          let left = start.left;
          let top = start.top;
          let width = start.width;
          let height = start.height;
          if (handle === 'move') {
            left = Math.max(canvasLeft, Math.min(canvasRight - width, start.left + dx));
            top = Math.max(canvasTop, Math.min(canvasBottom - height, start.top + dy));
          } else {
            if (handle.includes('e')) width = Math.max(24, Math.min(canvasRight - start.left, start.width + dx));
            if (handle.includes('s')) height = Math.max(24, Math.min(canvasBottom - start.top, start.height + dy));
            if (handle.includes('w')) {
              left = Math.max(canvasLeft, Math.min(start.left + start.width - 24, start.left + dx));
              width = start.width + start.left - left;
            }
            if (handle.includes('n')) {
              top = Math.max(canvasTop, Math.min(start.top + start.height - 24, start.top + dy));
              height = start.height + start.top - top;
            }
          }
          Object.assign(cropOverlay.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
          updateCropFieldsFromOverlay();
        };
        const onEnd = () => {
          cropOverlay.removeEventListener('pointermove', onMove);
          cropOverlay.removeEventListener('pointerup', onEnd);
          cropOverlay.removeEventListener('pointercancel', onEnd);
        };
        cropOverlay.addEventListener('pointermove', onMove);
        cropOverlay.addEventListener('pointerup', onEnd);
        cropOverlay.addEventListener('pointercancel', onEnd);
      });
    }

    const renderPage = async () => {
      const page = await pdf.getPage(currentPage);
      const base = page.getViewport({ scale: 1, rotation });
      const unrotated = page.getViewport({ scale: 1, rotation: 0 });
      currentPdfPageSize = { width: unrotated.width, height: unrotated.height };
      const fitScale = Math.min(1.5, 720 / base.width);
      const viewport = page.getViewport({ scale: fitScale * zoom, rotation });
      const context = canvas.getContext('2d');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      updateCropOverlayFromFields();
      canvasWrap.dataset.currentPdfPage = String(currentPage);
      canvasWrap.dataset.pdfPageCount = String(pdf.numPages);
      window.dispatchEvent(new CustomEvent('gxa:pdf-preview-page', {
        detail: { pageNumber: currentPage, pageCount: pdf.numPages, toolId }
      }));
      controls.querySelector('#pdf-page-indicator').textContent = `Page ${currentPage} of ${pdf.numPages}`;
      const zoomOutput = controls.querySelector('[data-role="pdf-zoom"]');
      if (zoomOutput) {
        zoomOutput.value = Math.round(zoom * 100) + '%';
        zoomOutput.textContent = Math.round(zoom * 100) + '%';
      }
      thumbs.querySelectorAll('button').forEach((button) => button.classList.toggle('active', Number(button.dataset.page) === currentPage));
    };

    const compressPageNumbers = (numbers) => {
      if (!numbers.length) return '';
      const ranges = [];
      let start = numbers[0];
      let previous = numbers[0];
      for (let index = 1; index <= numbers.length; index += 1) {
        const value = numbers[index];
        if (value === previous + 1) {
          previous = value;
          continue;
        }
        ranges.push(start === previous ? String(start) : `${start}-${previous}`);
        start = value;
        previous = value;
      }
      return ranges.join(', ');
    };

    const syncPageSelection = (useVisualOrder = false) => {
      if (!pageSelectionInput) return;
      const values = useVisualOrder || (toolId === 'organize-pdf' && selectedPages.size === 0)
        ? Array.from(thumbs.querySelectorAll('.pdf-thumbnail-button')).map(button => Number(button.dataset.page))
        : Array.from(selectedPages).sort((a, b) => a - b);
      pageSelectionInput.value = useVisualOrder ? values.join(', ') : compressPageNumbers(values);
      pageSelectionInput.dispatchEvent(new Event('change', { bubbles: true }));
      thumbs.querySelectorAll('.pdf-thumbnail-button').forEach(button => {
        const isSelected = selectedPages.has(Number(button.dataset.page));
        button.classList.toggle('selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
      });
      const output = controls.querySelector('[data-role="pdf-selection"]');
      if (output) output.textContent = selectedPages.size ? `${selectedPages.size} selected` : 'All pages';
    };

    controls.querySelector('[data-action="zoom-out"]').insertAdjacentHTML('afterend', '<output data-role="pdf-zoom" class="preview-zoom-output">100%</output>');
    controls.querySelector('[data-action="zoom-in"]').insertAdjacentHTML('afterend', '<button type="button" data-action="fit" aria-label="Fit PDF page">Fit</button>');
    const thumbnailObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(async entry => {
        const thumbCanvas = entry.target;
        thumbnailObserver.unobserve(thumbCanvas);
        const page = await pdf.getPage(Number(thumbCanvas.dataset.page));
        const viewport = page.getViewport({ scale: 0.18 });
        thumbCanvas.width = Math.ceil(viewport.width);
        thumbCanvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: thumbCanvas.getContext('2d'), viewport }).promise;
      });
    }, { root: thumbs, rootMargin: '120px' }) : null;
    const thumbLimit = Math.min(pdf.numPages, 60);
    for (let pageNumber = 1; pageNumber <= thumbLimit; pageNumber += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.page = String(pageNumber);
      button.className = 'pdf-thumbnail-button';
      button.setAttribute('aria-label', `Show PDF page ${pageNumber}`);
      button.setAttribute('aria-pressed', 'false');
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.dataset.page = String(pageNumber);
      thumbCanvas.setAttribute('aria-hidden', 'true');
      const pageLabel = document.createElement('span');
      pageLabel.textContent = `Page ${pageNumber}`;
      button.append(thumbCanvas, pageLabel);
      button.addEventListener('click', async (event) => {
        if (suppressThumbnailClick) {
          suppressThumbnailClick = false;
          return;
        }
        currentPage = pageNumber;
        if (pageSelectionInput) {
          if (event.shiftKey && lastSelectedPage) {
            const start = Math.min(lastSelectedPage, pageNumber);
            const end = Math.max(lastSelectedPage, pageNumber);
            for (let page = start; page <= end; page += 1) selectedPages.add(page);
          } else if (selectedPages.has(pageNumber)) {
            selectedPages.delete(pageNumber);
          } else {
            selectedPages.add(pageNumber);
          }
          lastSelectedPage = pageNumber;
          syncPageSelection();
        }
        await renderPage();
      });
      if (toolId === 'organize-pdf') {
        button.draggable = true;
        button.addEventListener('dragstart', () => {
          draggedThumbnail = button;
          button.classList.add('dragging');
        });
        button.addEventListener('dragover', event => event.preventDefault());
        button.addEventListener('drop', event => {
          event.preventDefault();
          if (!draggedThumbnail || draggedThumbnail === button) return;
          const bounds = button.getBoundingClientRect();
          thumbs.insertBefore(draggedThumbnail, event.clientY > bounds.top + bounds.height / 2 ? button.nextSibling : button);
          syncPageSelection(true);
        });
        button.addEventListener('dragend', () => {
          button.classList.remove('dragging');
          draggedThumbnail = null;
        });
        button.addEventListener('pointerdown', event => {
          if (event.pointerType === 'mouse') return;
          button.setPointerCapture(event.pointerId);
          pointerDrag = { button, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        });
        button.addEventListener('pointermove', event => {
          if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
          if (!pointerDrag.moved && Math.hypot(event.clientX - pointerDrag.x, event.clientY - pointerDrag.y) < 10) return;
          pointerDrag.moved = true;
          button.classList.add('dragging');
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.pdf-thumbnail-button');
          if (!target || target === button || !thumbs.contains(target)) return;
          const bounds = target.getBoundingClientRect();
          const after = event.clientY > bounds.top + bounds.height / 2
            || (event.clientY >= bounds.top && event.clientY <= bounds.bottom && event.clientX > bounds.left + bounds.width / 2);
          thumbs.insertBefore(button, after ? target.nextSibling : target);
        });
        const finishPointerReorder = event => {
          if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
          if (pointerDrag.moved) {
            suppressThumbnailClick = true;
            syncPageSelection(true);
          }
          button.classList.remove('dragging');
          pointerDrag = null;
        };
        button.addEventListener('pointerup', finishPointerReorder);
        button.addEventListener('pointercancel', finishPointerReorder);
      }
      thumbs.appendChild(button);
      if (thumbnailObserver) thumbnailObserver.observe(thumbCanvas);
      else if (pageNumber <= 12) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.18 });
        thumbCanvas.width = Math.ceil(viewport.width);
        thumbCanvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: thumbCanvas.getContext('2d'), viewport }).promise;
      }
    }
    if (pdf.numPages > thumbLimit) {
      const note = document.createElement('span');
      note.textContent = `+${pdf.numPages - thumbLimit} more pages`;
      thumbs.appendChild(note);
    }
    controls.addEventListener('click', async (event) => {
      const action = event.target.closest('button')?.dataset.action;
      if (!action) return;
      if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
      if (action === 'next') currentPage = Math.min(pdf.numPages, currentPage + 1);
      if (action === 'zoom-in') zoom = Math.min(2.5, zoom + 0.2);
      if (action === 'zoom-out') zoom = Math.max(0.4, zoom - 0.2);
      if (action === 'fit') zoom = 1;
      if (action === 'rotate') rotation = (rotation + 90) % 360;
      await renderPage();
    });
    canvasWrap.addEventListener('wheel', async event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoom = Math.max(0.4, Math.min(2.5, zoom + (event.deltaY < 0 ? 0.1 : -0.1)));
      await renderPage();
    }, { passive: false });
    canvasWrap.addEventListener('keydown', async event => {
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') currentPage = Math.max(1, currentPage - 1);
      else if (event.key === 'ArrowRight' || event.key === 'PageDown') currentPage = Math.min(pdf.numPages, currentPage + 1);
      else if (event.key === '+' || event.key === '=') zoom = Math.min(2.5, zoom + 0.2);
      else if (event.key === '-') zoom = Math.max(0.4, zoom - 0.2);
      else if (event.key.toLowerCase() === 'r') rotation = (rotation + 90) % 360;
      else if (event.key === '0') { zoom = 1; rotation = 0; }
      else return;
      event.preventDefault();
      await renderPage();
    });
    await renderPage();
    details.textContent = `${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'} • ${formatBytes(file.size)} • Preview renders pages lazily`;
    if (toolId === 'pdf-metadata') {
      try {
        const metadata = await pdf.getMetadata();
        const info = metadata?.info || {};
        const fields = [
          ['Title', info.Title], ['Author', info.Author], ['Subject', info.Subject],
          ['Keywords', info.Keywords], ['Creator', info.Creator], ['Producer', info.Producer],
          ['Created', info.CreationDate], ['Modified', info.ModDate]
        ].filter(([, value]) => value);
        const summary = document.getElementById('pdf-source-metadata');
        if (summary) summary.textContent = fields.length
          ? fields.map(([label, value]) => `${label}: ${value}`).join(' • ')
          : 'No standard document metadata was found.';
        [
          ['opt-meta-title', info.Title], ['opt-meta-author', info.Author],
          ['opt-meta-subject', info.Subject], ['opt-meta-keywords', info.Keywords]
        ].forEach(([id, value]) => {
          const input = document.getElementById(id);
          if (input && value && !input.value) input.value = String(value);
        });
      } catch (error) {
        const summary = document.getElementById('pdf-source-metadata');
        if (summary) summary.textContent = 'Existing metadata could not be read, but supported fields can still be written.';
      }
    }
  }

  async function renderZipPreview(file, stage, details) {
    if (!window.JSZip) throw new Error('ZIP preview library is unavailable.');
    const archive = await window.JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: true });
    const entries = Object.values(archive.files).slice(0, 100);
    const summary = document.createElement('div');
    summary.className = 'archive-summary';
    summary.innerHTML = `<strong>${safeFileName(file.name)}</strong><span>${formatBytes(file.size)} · ${Object.keys(archive.files).length} entries</span>`;
    const list = document.createElement('ul');
    list.className = 'archive-entry-list';
    entries.forEach((entry) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'archive-entry-name';
      label.textContent = `${entry.dir ? 'Folder' : 'File'} · ${entry.name}`;
      const size = Number(entry._data?.uncompressedSize);
      const meta = document.createElement('span');
      meta.className = 'archive-entry-meta';
      meta.textContent = entry.dir ? 'Directory' : (Number.isFinite(size) ? formatBytes(size) : 'Size available after extraction');
      item.append(label, meta);
      if (!entry.dir) {
        const extractButton = document.createElement('button');
        extractButton.type = 'button';
        extractButton.className = 'archive-extract-button';
        extractButton.textContent = 'Extract';
        extractButton.setAttribute('aria-label', `Extract ${entry.name}`);
        extractButton.addEventListener('click', async () => {
          const originalText = extractButton.textContent;
          extractButton.disabled = true;
          extractButton.textContent = 'Preparing…';
          try {
            const blob = await entry.async('blob');
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = safeFileName(entry.name.split('/').pop() || 'archive-file');
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          } catch {
            extractButton.textContent = 'Failed';
            return;
          } finally {
            extractButton.disabled = false;
            if (extractButton.textContent !== 'Failed') extractButton.textContent = originalText;
          }
        });
        item.appendChild(extractButton);
      }
      list.appendChild(item);
    });
    stage.append(summary, list);
    details.textContent = `${file.name} · ${formatBytes(file.size)} · ${Object.keys(archive.files).length} archive entries${Object.keys(archive.files).length > 100 ? ' · showing first 100' : ''}`;
  }

  async function renderTextPreview(file, stage, details) {
    const text = await file.text();
    const preview = document.createElement('pre');
    preview.className = 'text-file-preview';
    preview.textContent = text.slice(0, 100000);
    stage.appendChild(preview);
    const lineCount = text === '' ? 0 : text.split(/\r?\n/).length;
    details.textContent = `${lineCount} lines • ${text.length} characters${text.length > 100000 ? ' • preview truncated' : ''}`;
  }

  async function renderOfficeSummary(file, stage, details) {
    const summary = document.createElement('div');
    summary.className = 'document-summary-preview';
    summary.innerHTML = '<strong>Structured document summary</strong><p>Full-fidelity office rendering is not available in the browser. The original file remains unchanged.</p>';
    const rows = document.createElement('dl');
    const values = [['Name', file.name], ['Type', file.type || 'Unknown'], ['Size', formatBytes(file.size)], ['Last modified', new Date(file.lastModified).toLocaleString()]];
    values.forEach(([key, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = key;
      description.textContent = value;
      rows.append(term, description);
    });
    summary.appendChild(rows);
    stage.appendChild(summary);
    details.textContent = 'Metadata-only preview; no fake document rendering is shown.';
  }

  async function renderFilePreview(files, selectedIndex) {
    revokeObjectUrls();
    const queue = document.getElementById('file-queue-container');
    if (!queue || !files || files.length === 0) return;
    let mount = document.getElementById('file-preview-workspace');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'file-preview-workspace';
      queue.insertAdjacentElement('afterend', mount);
    }
    const index = Math.max(0, Math.min(Number(selectedIndex) || 0, files.length - 1));
    const file = files[index];
    mount.innerHTML = '';
    const shell = createPreviewShell(file, index, files.length);
    mount.appendChild(shell);
    const stage = shell.querySelector('#gxa-preview-stage');
    const details = shell.querySelector('#gxa-preview-details');
    try {
      const type = (file.type || '').toLowerCase();
      const extension = (file.name.split('.').pop() || '').toLowerCase();
      if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(extension)) {
        await renderImagePreview(file, stage, details);
      } else if (type === 'application/pdf' || extension === 'pdf') {
        await renderPdfPreview(file, stage, details);
      } else if (type.includes('zip') || extension === 'zip') {
        await renderZipPreview(file, stage, details);
      } else if (type.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'csv', 'sql'].includes(extension)) {
        await renderTextPreview(file, stage, details);
      } else {
        await renderOfficeSummary(file, stage, details);
      }
    } catch (error) {
      renderError(stage, error && error.message ? error.message : 'The selected file could not be previewed.');
      details.textContent = `${file.type || 'Unknown type'} • ${formatBytes(file.size)}`;
    }
  }

  function bindPaste(onFiles) {
    if (pasteHandler) document.removeEventListener('paste', pasteHandler);
    pasteHandler = (event) => {
      const target = event.target;
      if (target && (target.matches('input, textarea') || target.isContentEditable)) return;
      const images = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
      if (images.length) {
        event.preventDefault();
        onFiles(images);
      }
    };
    document.addEventListener('paste', pasteHandler);
  }

  async function pdfToImagesZip(file, format) {
    if (!window.JSZip) throw new Error('ZIP output library is unavailable.');
    const pdfjsLib = await ensurePdfJs();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const zip = new window.JSZip();
    const imageFormat = format === 'jpg' ? 'jpeg' : 'png';
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: imageFormat === 'png' });
      if (imageFormat === 'jpeg') {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Page image generation failed.')), `image/${imageFormat}`, 0.92));
      zip.file(`page-${String(pageNumber).padStart(3, '0')}.${format === 'jpg' ? 'jpg' : 'png'}`, blob);
      canvas.width = 0;
      canvas.height = 0;
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  async function extractPdfText(file) {
    const pdfjsLib = await ensurePdfJs();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim());
    }
    return pages;
  }

  async function renderPdfPages(file, options = {}) {
    const pdfjsLib = await ensurePdfJs();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const scale = Math.max(0.75, Math.min(2, Number(options.scale) || 1.35));
    const maximumPages = Math.max(1, Number(options.maximumPages) || 60);
    const maximumTotalPixels = Math.max(1_000_000, Number(options.maximumTotalPixels) || 24_000_000);
    if (pdf.numPages > maximumPages) throw new Error(`This browser workflow supports up to ${maximumPages} PDF pages per run.`);
    const results = [];
    let totalPixels = 0;
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (options.isCancelled?.()) throw new Error(`Processing cancelled after page ${pageNumber - 1}.`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const pixelCount = Math.ceil(viewport.width) * Math.ceil(viewport.height);
        totalPixels += pixelCount;
        if (pixelCount > 12_000_000) throw new Error(`Page ${pageNumber} exceeds the safe 12-megapixel browser processing limit.`);
        if (totalPixels > maximumTotalPixels) throw new Error(`This document exceeds the safe ${Math.round(maximumTotalPixels / 1_000_000)}-megapixel browser processing budget.`);
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        try {
          await page.render({ canvasContext: context, viewport }).promise;
          const renderedPage = { canvas, pageNumber, width: canvas.width, height: canvas.height };
          if (options.onPage) await options.onPage(renderedPage, pdf.numPages);
          else results.push(renderedPage);
          options.onProgress?.(pageNumber, pdf.numPages);
        } finally {
          if (options.onPage) {
            canvas.width = 0;
            canvas.height = 0;
          }
          page.cleanup?.();
        }
      }
      return results;
    } catch (error) {
      results.forEach(result => {
        result.canvas.width = 0;
        result.canvas.height = 0;
      });
      throw error;
    } finally {
      await pdf.destroy?.();
    }
  }

  async function extractPdfTextRows(file) {
    const pdfjsLib = await ensurePdfJs();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    if (pdf.numPages > 100) throw new Error('PDF to Excel supports up to 100 pages per browser run.');
    const pages = [];
    let totalTextItems = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      totalTextItems += content.items.length;
      if (totalTextItems > 200_000) throw new Error('This PDF exceeds the safe 200,000 positioned-text-item spreadsheet limit.');
      const sorted = content.items
        .filter(item => String(item.str || '').trim())
        .map(item => ({ text: String(item.str).trim(), x: item.transform[4], y: item.transform[5] }))
        .sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
      const rows = [];
      sorted.forEach(item => {
        let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 3);
        if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
        row.items.push(item);
      });
      pages.push(rows.map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.text)));
      page.cleanup?.();
    }
    await pdf.destroy?.();
    return pages;
  }

  async function extractEmbeddedPdfImages(file) {
    const pdfjsLib = await ensurePdfJs();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    if (pdf.numPages > 100) throw new Error('Embedded image extraction supports up to 100 PDF pages per browser run.');
    const output = [];
    const seen = new Set();
    let totalPixels = 0;
    const imageOperations = new Set([
      pdfjsLib.OPS.paintImageXObject,
      pdfjsLib.OPS.paintJpegXObject,
      pdfjsLib.OPS.paintImageXObjectRepeat,
      pdfjsLib.OPS.paintInlineImageXObject,
      pdfjsLib.OPS.paintInlineImageXObjectGroup
    ].filter(Number.isFinite));
    const resolveObject = (page, name) => new Promise((resolve, reject) => {
      try {
        const immediate = page.objs.get(name);
        if (immediate) return resolve(immediate);
      } catch (_) {
        // PDF.js throws until asynchronously decoded objects are ready.
      }
      try { page.objs.get(name, resolve); } catch (error) { reject(error); }
    });
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const operators = await page.getOperatorList();
      for (let index = 0; index < operators.fnArray.length; index += 1) {
        if (!imageOperations.has(operators.fnArray[index])) continue;
        const args = operators.argsArray[index] || [];
        const name = typeof args[0] === 'string' ? args[0] : '';
        let image = name ? await resolveObject(page, name) : args.find(value => (value?.data || value?.bitmap) && value?.width && value?.height);
        if (Array.isArray(image)) image = image[0];
        if ((!image?.data && !image?.bitmap) || !image.width || !image.height) continue;
        const pixelCount = image.width * image.height;
        if (pixelCount > 12_000_000) throw new Error(`An embedded image on page ${pageNumber} exceeds the safe 12-megapixel extraction limit.`);
        totalPixels += pixelCount;
        if (totalPixels > 36_000_000) throw new Error('The embedded images exceed the safe 36-megapixel extraction budget.');
        let signature = `${pageNumber}:${name || index}:${image.width}x${image.height}:bitmap`;
        if (image.data) {
          let hash = 2166136261;
          for (let byteIndex = 0; byteIndex < image.data.length; byteIndex += 1) {
            hash ^= image.data[byteIndex];
            hash = Math.imul(hash, 16777619);
          }
          signature = `${image.width}x${image.height}:${image.kind || 0}:${image.data.length}:${hash >>> 0}`;
        }
        if (seen.has(signature)) continue;
        seen.add(signature);
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (image.bitmap) {
          context.drawImage(image.bitmap, 0, 0, image.width, image.height);
        } else {
          const pixels = context.createImageData(image.width, image.height);
          const packedGrayscale = image.kind === pdfjsLib.ImageKind?.GRAYSCALE_1BPP
            || image.data.length === Math.ceil(image.width / 8) * image.height;
          const channels = packedGrayscale ? 0 : image.data.length / pixelCount;
          if (!packedGrayscale && ![1, 3, 4].includes(channels)) {
            canvas.width = 0;
            canvas.height = 0;
            continue;
          }
          for (let pixel = 0; pixel < pixelCount; pixel += 1) {
            const target = pixel * 4;
            if (packedGrayscale) {
              const row = Math.floor(pixel / image.width);
              const column = pixel % image.width;
              const value = image.data[row * Math.ceil(image.width / 8) + (column >> 3)] & (0x80 >> (column & 7)) ? 255 : 0;
              pixels.data.set([value, value, value, 255], target);
            } else {
              const source = pixel * channels;
              if (channels >= 3) pixels.data.set([image.data[source], image.data[source + 1], image.data[source + 2], channels === 4 ? image.data[source + 3] : 255], target);
              else pixels.data.set([image.data[source], image.data[source], image.data[source], 255], target);
            }
          }
          context.putImageData(pixels, 0, 0);
        }
        const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Decoded PDF image export failed.')), 'image/png'));
        output.push({ pageNumber, name: name || `inline-${index}`, width: image.width, height: image.height, blob });
        canvas.width = 0;
        canvas.height = 0;
      }
      page.cleanup?.();
    }
    await pdf.destroy?.();
    return output;
  }

  async function renderCode(data, format, color, container, options = {}) {
    if (!data.trim()) throw new Error('Enter content before generating a code.');
    container.innerHTML = '';
    const size = Math.max(128, Math.min(512, Number(options.size) || 256));
    const margin = Math.max(0, Math.min(32, Number(options.margin) || 0));
    const background = options.background || '#ffffff';
    if (format === 'qr') {
      await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'QRCode');
      container.style.padding = `${margin}px`;
      container.style.background = background;
      new window.QRCode(container, { text: data, width: size, height: size, colorDark: color, colorLight: background, correctLevel: window.QRCode.CorrectLevel.M });
    } else {
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js', 'JsBarcode');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.appendChild(svg);
      container.style.padding = '0';
      container.style.background = 'transparent';
      window.JsBarcode(svg, data, { format: 'CODE128', lineColor: color, background, displayValue: true, margin, height: Math.max(64, Math.round(size * 0.35)), width: size >= 384 ? 3 : 2 });
    }
  }

  async function detectBarcode(file, formats) {
    if (!('BarcodeDetector' in window)) throw new Error('This browser does not support local barcode detection. Try a current Chromium-based browser.');
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const selected = formats.filter((format) => supported.includes(format));
    if (!selected.length) throw new Error('The requested barcode format is not supported by this browser.');
    const detector = new window.BarcodeDetector({ formats: selected });
    const bitmap = await createImageBitmap(file);
    try {
      const results = await detector.detect(bitmap);
      if (!results.length) throw new Error('No readable code was found. Try a sharper, well-lit image with the complete code visible.');
      return results[0];
    } finally {
      bitmap.close();
    }
  }

  async function readExif(file) {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/exifr/dist/full.umd.js', 'exifr');
    const parsed = await window.exifr.parse(file, { gps: true, tiff: true, exif: true, ifd0: true });
    return parsed || {};
  }

  window.GxaWorkspace = Object.freeze({
    MAX_FILE_SIZE,
    validateFiles,
    formatBytes,
    safeFileName,
    getBlocker,
    getProcessingProfile,
    renderFilePreview,
    bindPaste,
    dispose,
    pdfToImagesZip,
    extractPdfText,
    extractPdfTextRows,
    extractEmbeddedPdfImages,
    renderPdfPages,
    loadScriptOnce,
    renderCode,
    detectBarcode,
    readExif
  });
})();
