/* In-memory PDF form/overlay editor. Document contents never enter analytics or storage. */
(function () {
  'use strict';
  let active = null;
  const fonts = Object.fromEntries(['Helvetica', 'TimesRoman', 'Courier'].flatMap(family => ['', 'Bold', 'Italic', 'BoldItalic'].map(style => [family + style, family === 'Helvetica' ? 'Arial, sans-serif' : family === 'TimesRoman' ? '"Times New Roman", serif' : '"Courier New", monospace'])));
  const maxPdfBytes = 25 * 1024 * 1024;
  const escape = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cloneState = data => ({ fieldValues: structuredClone(data.fieldValues), overlays: data.overlays.map(item => ({ ...item })), pagePlan: data.pagePlan?.map(item => ({ ...item })) });

  function dispose() {
    active?.destroy();
    active = null;
  }

  function mount(root, callbacks = {}) {
    dispose();
    const core = window.GxaPdfEditCore;
    let alive = true;
    let source = null;
    let sourceName = '';
    let info = null;
    let pdf = null;
    let previewPdf = null;
    let previewUrl = '';
    let data = { fieldValues: {}, overlays: [] };
    let undo = [];
    let redo = [];
    let selectedId = null;
    let pageIndex = 0;
    let scale = 1;
    let zoomMode = 'width';
    let tool = 'select';
    let pendingImage = null;
    let preview = false;
    let busy = false;
    let renderTask = null;
    let revision = 0;
    let layerRevision = 0;
    let loadRevision = 0;
    let drawing = false;
    let signatureHasInk = false;
    let editingInput = null;
    let resizeTimer;
    let thumbnailObserver = null;
    let thumbnailRevision = 0;
    let thumbnailTask = null;
    const abort = new AbortController();
    const on = (el, event, fn) => el.addEventListener(event, fn, { signal: abort.signal });
    root.innerHTML = `
      <div class="pdf-edit" aria-label="PDF form and overlay editor">
        <div class="pdf-edit-upload"><label for="pdf-edit-file">Choose a PDF</label><input id="pdf-edit-file" type="file" accept=".pdf,application/pdf"><p>One PDF, up to 25 MB. Edits stay in memory and are cleared when you leave or reset.</p></div>
        <p class="pdf-edit-status" role="status" aria-live="polite" id="pdf-edit-status">Choose a PDF to begin.</p>
        <div class="pdf-edit-document" hidden>
          <p class="pdf-edit-notice">Existing static PDF text is part of the page content and may not be directly editable. You can fill detected form fields or add text and other elements on top of the original page. Rewriting a PDF invalidates existing digital signatures.</p>
          <div class="pdf-edit-file-info"><strong id="pdf-edit-filename"></strong><span id="pdf-edit-info"></span><button type="button" data-action="reset">Reset document</button></div>
          <div class="pdf-edit-toolbar" role="toolbar" aria-label="PDF editing tools">
            <button type="button" data-tool="select" aria-pressed="true">Select / move</button>
            <button type="button" data-tool="text" aria-pressed="false">Add Text</button>
            <button type="button" data-tool="check" aria-pressed="false">Check</button>
            <button type="button" data-tool="cross" aria-pressed="false">Cross</button>
            <button type="button" data-tool="date" aria-pressed="false">Date</button>
            <button type="button" data-tool="signature" aria-pressed="false">Type signature</button>
            <button type="button" data-tool="rectangle" aria-pressed="false">Rectangle</button>
            <details class="pdf-edit-more"><summary>More drawing tools</summary><div>
              <button type="button" data-tool="ellipse" aria-pressed="false">Ellipse</button>
              <button type="button" data-tool="line" aria-pressed="false">Line</button>
              <button type="button" data-tool="arrow" aria-pressed="false">Arrow</button>
              <button type="button" data-tool="highlight" aria-pressed="false">Highlight area</button>
              <button type="button" data-tool="underline" aria-pressed="false">Underline area</button>
              <button type="button" data-tool="strike" aria-pressed="false">Strike-through area</button>
            </div></details>
            <button type="button" data-action="image">Image / signature image</button>
            <button type="button" data-action="draw-signature">Draw signature</button>
            <button type="button" data-action="undo" disabled>Undo</button>
            <button type="button" data-action="redo" disabled>Redo</button>
          </div>
          <input id="pdf-edit-image" type="file" accept="image/png,image/jpeg" hidden>
          <input id="pdf-edit-replace-image" type="file" accept="image/png,image/jpeg" hidden>
          <div class="pdf-edit-placement" hidden><span>Tap the original page to place the selected element.</span><button type="button" data-action="place-center">Add at page center</button></div>
          <div class="pdf-edit-view-controls preview-control-bar" aria-label="Page and zoom controls">
            <button type="button" data-action="previous" aria-label="Previous PDF page">Previous</button><output id="pdf-edit-page-number"></output><button type="button" data-action="next" aria-label="Next PDF page">Next</button>
            <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button><output id="pdf-edit-zoom"></output><button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
            <button type="button" data-action="fit-width">Fit Width</button><button type="button" data-action="fit-page">Fit Page</button><button type="button" data-action="actual-size">100%</button>
          </div>
          <details class="pdf-edit-page-management"><summary>Manage pages</summary><p>Move pages using the buttons below. Rotate before adding overlays on that page. Pages with form fields or annotations cannot be duplicated or deleted; export a flattened copy first for supported forms. Deleting a page is not secure redaction.</p><div>
            <button type="button" data-action="page-up">Move page earlier</button><button type="button" data-action="page-down">Move page later</button>
            <button type="button" data-action="page-rotate">Rotate page 90°</button><button type="button" data-action="page-duplicate">Duplicate page</button>
            <button type="button" data-action="page-blank">Insert blank after page</button><button type="button" data-action="page-delete">Delete page</button>
          </div></details>
          <div class="pdf-edit-grid">
            <div class="pdf-edit-main"><div class="pdf-edit-viewport"><div class="pdf-edit-page" tabindex="0" aria-label="Original PDF page. Choose a tool, then tap the page; use selected element controls for keyboard positioning."><canvas aria-label="Original PDF page preview"></canvas><div class="pdf-edit-layer"></div></div></div>
              <nav class="pdf-thumbnail-strip pdf-edit-pages" aria-label="PDF pages"></nav>
            </div>
            <aside class="pdf-edit-properties" aria-label="PDF editing properties">
              <section class="pdf-edit-selection"><h2>Selected element</h2><p>Select an added element to change its text, position, size, or appearance.</p></section>
              <section class="pdf-edit-fields"><h2>Form fields on this page</h2><div class="pdf-edit-field-list"></div></section>
              <button type="button" data-action="clear-page">Clear overlays on this page</button>
            </aside>
          </div>
          <div class="pdf-edit-export"><label for="pdf-edit-form-mode">Filled form output</label><select id="pdf-edit-form-mode"><option value="editable">Keep fields editable</option><option value="flatten">Flatten filled form</option></select>
            <p>Form text is fitted to its original field on export; check the actual PDF preview. Signatures added here are visual marks, not certificate-backed digital signatures.</p>
            <div class="pdf-edit-export-actions"><button type="button" data-action="preview" class="btn btn-secondary">Preview Edited PDF</button><button type="button" data-action="back" hidden>Back to editing</button><button type="button" data-action="download" class="btn btn-primary">Download Edited PDF</button></div>
            <progress class="pdf-edit-progress" aria-label="Preparing edited PDF" hidden></progress>
          </div>
        </div>
        <dialog class="pdf-edit-signature-dialog" aria-labelledby="pdf-edit-signature-title"><h2 id="pdf-edit-signature-title">Draw a visual signature</h2><p>Draw with your finger, pen, or mouse. This is a visual mark, not a digital certificate.</p><canvas id="pdf-edit-signature-pad" width="600" height="200" aria-label="Signature drawing area"></canvas><p>For a keyboard alternative, close this dialog and choose Type signature or Image / signature image.</p><div><button type="button" data-action="clear-signature">Clear</button><button type="button" data-action="use-signature">Use signature</button><button type="button" data-action="close-signature">Close</button></div></dialog>
      </div>`;
    const $ = selector => root.querySelector(selector);
    const stage = $('.pdf-edit-page');
    const layer = $('.pdf-edit-layer');
    const canvas = stage.querySelector('canvas');
    const viewport = $('.pdf-edit-viewport');
    const formMode = $('#pdf-edit-form-mode');
    const fileInput = $('#pdf-edit-file');
    const imageInput = $('#pdf-edit-image');
    const replaceImageInput = $('#pdf-edit-replace-image');
    const signatureDialog = $('.pdf-edit-signature-dialog');
    const signatureCanvas = $('#pdf-edit-signature-pad');
    const signatureContext = signatureCanvas.getContext('2d');
    const event = (name, status) => callbacks.onEvent?.(name, status);
    function status(message, error = false) {
      if (!alive) return;
      const el = $('#pdf-edit-status');
      el.textContent = message;
      el.classList.toggle('is-error', error);
      el.setAttribute('role', error ? 'alert' : 'status');
    }
    function setBusy(value, message) {
      busy = value;
      $('.pdf-edit-document').inert = value;
      root.setAttribute('aria-busy', String(value));
      $('.pdf-edit-progress').hidden = !value;
      root.querySelectorAll('[data-action="preview"], [data-action="download"], #pdf-edit-file').forEach(el => { el.disabled = value; });
      if (message) status(message);
    }
    function clearOutput() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      previewPdf?.destroy();
      previewPdf = null;
      preview = false;
      $('[data-action="back"]').hidden = true;
    }
    function remember() {
      undo.push(cloneState(data));
      if (undo.length > 40) undo.shift();
      redo = [];
      clearOutput();
    }
    function historyState() {
      $('[data-action="undo"]').disabled = busy || !undo.length;
      $('[data-action="redo"]').disabled = busy || !redo.length;
    }
    function changed(message = 'Edits updated. Preview the PDF to check the exported result.') {
      historyState();
      renderLayers();
      renderProperties();
      status(message);
    }
    function activateTool(next) {
      tool = next;
      root.querySelectorAll('[data-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tool === next)));
      $('.pdf-edit-placement').hidden = next === 'select';
      stage.classList.toggle('is-placing', next !== 'select');
      if (next !== 'select') status('Tap the page to place the element, or use Add at page center.');
    }
    async function loadFile(file) {
      if (!file || busy) return;
      if (info && !window.confirm('Replace this document and discard its unsaved edits?')) { fileInput.value = ''; return; }
      const token = ++loadRevision;
      setBusy(true, 'Reading PDF and detecting form fields…');
      try {
        if (!/\.pdf$/i.test(file.name)) throw new Error('Choose a file with a .pdf extension.');
        if (!file.size) throw new Error('The selected PDF is empty.');
        if (file.size > maxPdfBytes) throw new Error('Edit PDF supports files up to 25 MB.');
        if (file.type && file.type !== 'application/pdf') throw new Error('The file type does not match a PDF.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const detected = await core.inspect(bytes, window.PDFLib);
        if (detected.pages.length > 500) throw new Error('Edit PDF supports up to 500 pages per document. Split this PDF first.');
        const pdfjs = await window.GxaWorkspace.ensurePdfJs();
        const loaded = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
        if (!alive || token !== loadRevision) { await loaded.destroy(); return; }
        renderTask?.cancel();
        pdf?.destroy();
        clearOutput();
        pdf = loaded; source = bytes; sourceName = file.name; info = detected;
        pendingImage = null; editingInput = null;
        signatureContext.clearRect(0, 0, 600, 200); signatureHasInk = false;
        data = { fieldValues: Object.create(null), overlays: [], pagePlan: detected.pages.map((_, index) => ({ sourceIndex: index, rotation: 0, id: crypto.randomUUID() })) }; undo = []; redo = []; selectedId = null; pageIndex = 0; zoomMode = 'width';
        for (const field of info.fields) {
          if (field.type !== 'unsupported' && !field.readOnly) data.fieldValues[field.name] = structuredClone(field.value);
        }
        $('.pdf-edit-document').hidden = false;
        $('#pdf-edit-filename').textContent = file.name;
        $('#pdf-edit-info').textContent = `${info.pages.length} pages · ${window.GxaWorkspace.formatBytes(file.size)}`;
        formMode.disabled = !info.fields.length || !info.canFlatten;
        formMode.value = 'editable';
        renderPages(); renderProperties(); renderFields(); historyState(); activateTool('select');
        await renderPage();
        const supportedCount = info.fields.filter(field => field.type !== 'unsupported' && !field.readOnly).length;
        status(`${supportedCount ? `Fillable fields detected: ${supportedCount}. Fill them on the page or in the labeled controls.` : 'No supported fillable fields detected. Add text or marks over the original page.'}${info.warnings?.length ? ` ${info.warnings.join(' ')}` : ''}`);
      } catch (error) {
        if (alive && token === loadRevision) status(error?.name === 'PasswordException' ? 'This PDF is password protected. Use Unlock PDF first, then open the unlocked copy here.' : error.message || 'The PDF could not be opened.', true);
      } finally {
        if (alive && token === loadRevision) { setBusy(false); fileInput.value = ''; }
      }
    }
    function renderPages() {
      const nav = $('.pdf-edit-pages');
      thumbnailObserver?.disconnect(); thumbnailTask?.cancel();
      const token = ++thumbnailRevision;
      const queue = []; let running = false;
      async function drain() {
        if (running) return; running = true;
        try {
          while (queue.length && alive && token === thumbnailRevision) {
            const button = queue.shift();
            const page = await pdf.getPage(Number(button.dataset.page) + 1);
            if (!alive || token !== thumbnailRevision || !button.isConnected) break;
            const base = page.getViewport({ scale: 1 });
            const view = page.getViewport({ scale: Math.min(96 / base.width, 124 / base.height) });
            const thumb = button.querySelector('canvas');
            thumb.width = Math.ceil(view.width); thumb.height = Math.ceil(view.height);
            thumbnailTask = page.render({ canvasContext: thumb.getContext('2d'), viewport: view, annotationMode: window.pdfjsLib.AnnotationMode.ENABLE });
            try { await thumbnailTask.promise; } catch (error) { if (error.name !== 'RenderingCancelledException') button.title = 'Thumbnail unavailable; open this page to inspect it.'; }
          }
        } catch { /* Main-page rendering retains its own accessible error state. */ }
        finally { running = false; }
      }
      thumbnailObserver = window.IntersectionObserver ? new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) { thumbnailObserver.unobserve(entry.target); queue.push(entry.target); }
        drain();
      }, { root: nav, rootMargin: '100px' }) : null;
      nav.replaceChildren();
      // Small visible thumbnails only, rendered sequentially; never full-resolution pages.
      for (let index = 0; index < info.pages.length; index++) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = String(index + 1); button.dataset.page = String(index);
        button.setAttribute('aria-label', `Go to PDF page ${index + 1}`);
        button.setAttribute('aria-current', index === pageIndex ? 'page' : 'false');
        const thumb = document.createElement('canvas'); thumb.width = 1; thumb.height = 1; thumb.setAttribute('aria-hidden', 'true');
        button.prepend(thumb); nav.append(button); thumbnailObserver?.observe(button);
      }
    }
    async function rebuildPages(nextData) {
      const token = loadRevision;
      const bytes = await core.exportPdf(source, { pagePlan: nextData.pagePlan }, window.PDFLib);
      const detected = await core.inspect(bytes, window.PDFLib);
      const loaded = await window.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
      if (!alive || token !== loadRevision) { await loaded.destroy(); return false; }
      ++revision; renderTask?.cancel(); thumbnailTask?.cancel(); ++thumbnailRevision; thumbnailObserver?.disconnect();
      pdf?.destroy(); pdf = loaded; info = detected;
      pageIndex = Math.min(pageIndex, info.pages.length - 1);
      $('#pdf-edit-info').textContent = `${info.pages.length} pages · ${window.GxaWorkspace.formatBytes(source.byteLength)} original`;
      return true;
    }
    async function changePage(name) {
      if (!source || preview || busy) return;
      if (name === 'page-rotate' && data.overlays.some(item => item.pageIndex === pageIndex)) { status('Rotate this page before adding overlays, or clear its overlays first. Other page edits remain available.', true); return; }
      if (name === 'page-delete' && !window.confirm('Delete this page and its overlays? This is not secure removal of sensitive data.')) return;
      const next = cloneState(data), oldPlan = data.pagePlan;
      const current = next.pagePlan[pageIndex]; let target = pageIndex;
      if (name === 'page-up' || name === 'page-down') {
        target += name === 'page-up' ? -1 : 1;
        if (target < 0 || target >= next.pagePlan.length) return;
        [next.pagePlan[pageIndex], next.pagePlan[target]] = [next.pagePlan[target], next.pagePlan[pageIndex]];
      }
      if (name === 'page-rotate') current.rotation = (current.rotation + 90) % 360;
      if (name === 'page-duplicate') { next.pagePlan.splice(pageIndex + 1, 0, { ...current, id: crypto.randomUUID() }); target++; }
      if (name === 'page-blank') { const view = info.pages[pageIndex]; next.pagePlan.splice(pageIndex + 1, 0, { id: crypto.randomUUID(), sourceIndex: null, rotation: 0, width: view.visualWidth, height: view.visualHeight }); target++; }
      if (name === 'page-delete') next.pagePlan.splice(pageIndex, 1);
      next.overlays = data.overlays.flatMap(item => {
        const newIndex = next.pagePlan.findIndex(entry => entry.id === oldPlan[item.pageIndex].id);
        if (newIndex < 0) return [];
        const moved = { ...item, pageIndex: newIndex };
        return name === 'page-duplicate' && item.pageIndex === pageIndex ? [moved, { ...item, pageIndex: target, id: `overlay-${crypto.randomUUID()}` }] : [moved];
      });
      if (next.overlays.length > 300) { status('Duplicating this page would exceed the 300-overlay limit.', true); return; }
      setBusy(true, 'Updating document pages…');
      try {
        if (!await rebuildPages(next)) return;
        remember(); data = next; pageIndex = Math.min(target, info.pages.length - 1); selectedId = null;
        renderPages(); changed('Page changes applied. Undo restores the previous page arrangement.'); await renderPage();
      } catch (error) { status(error.message || 'Page changes could not be applied.', true); }
      finally { if (alive) { setBusy(false); historyState(); } }
    }
    async function renderPage() {
      if (!pdf || !alive) return;
      const token = ++revision;
      renderTask?.cancel();
      const page = await (preview && previewPdf ? previewPdf : pdf).getPage(pageIndex + 1);
      if (!alive || token !== revision) return;
      const base = page.getViewport({ scale: 1 });
      const fitWidth = Math.max(0.05, (viewport.clientWidth - 24) / base.width);
      if (zoomMode === 'width') scale = Math.min(1.5, fitWidth);
      if (zoomMode === 'page') scale = Math.min(fitWidth, Math.max(280, Math.min(760, window.innerHeight * .7)) / base.height);
      const view = page.getViewport({ scale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (view.width * view.height)));
      canvas.width = Math.max(1, Math.ceil(view.width * pixelRatio));
      canvas.height = Math.max(1, Math.ceil(view.height * pixelRatio));
      stage.style.width = `${view.width}px`; stage.style.height = `${view.height}px`;
      viewport.classList.toggle('is-zoomed', zoomMode === 'manual');
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: view, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0], annotationMode: preview ? window.pdfjsLib.AnnotationMode.ENABLE : window.pdfjsLib.AnnotationMode.ENABLE_FORMS });
      try { await renderTask.promise; } catch (error) { if (error.name !== 'RenderingCancelledException') status('This page could not be rendered.', true); }
      if (!alive || token !== revision) return;
      $('#pdf-edit-page-number').textContent = `Page ${pageIndex + 1} of ${info.pages.length}`;
      $('#pdf-edit-zoom').textContent = `${Math.round(scale * 100)}%`;
      $('[data-action="previous"]').disabled = pageIndex === 0;
      $('[data-action="next"]').disabled = pageIndex >= info.pages.length - 1;
      root.querySelectorAll('[data-page]').forEach(button => button.setAttribute('aria-current', Number(button.dataset.page) === pageIndex ? 'page' : 'false'));
      layer.hidden = preview;
      $('.pdf-edit-grid').classList.toggle('is-preview', preview);
      $('.pdf-edit-properties').hidden = preview;
      $('.pdf-edit-toolbar').hidden = preview;
      $('.pdf-edit-page-management').hidden = preview;
      if (preview) $('.pdf-edit-placement').hidden = true;
      renderLayers(); renderFields();
    }
    function makeFieldControl(field, widget, onPage = false) {
      const value = data.fieldValues[field.name] ?? field.value;
      let input;
      if (field.type === 'dropdown' || (field.type === 'radio' && !onPage)) {
        input = document.createElement('select');
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose…'; input.append(empty);
        for (const option of field.options || []) { const el = document.createElement('option'); el.value = option; el.textContent = option; input.append(el); }
        input.value = Array.isArray(value) ? value[0] || '' : value || '';
      } else if (field.type === 'text') {
        input = document.createElement(field.multiline ? 'textarea' : 'input');
        if (!field.multiline) input.type = 'text';
        input.value = String(value ?? '');
        if (field.maxLength) input.maxLength = field.maxLength;
      } else {
        input = document.createElement('input');
        input.type = field.type === 'radio' ? 'radio' : 'checkbox';
        input.checked = field.type === 'radio' ? value === widget.option : !!value;
        if (field.type === 'radio') { input.name = `pdf-form-${field.name}`; input.value = widget.option || ''; }
      }
      input.setAttribute('aria-label', `${field.name}${onPage && widget?.option ? `: ${widget.option}` : ''}${onPage ? ' on PDF page' : ''}`);
      input.autocomplete = 'off'; input.spellcheck = false;
      input.dataset.field = field.name;
      input.disabled = field.readOnly;
      return input;
    }
    async function renderLayers() {
      const layerToken = ++layerRevision;
      if (!info || !alive || preview) return;
      const token = revision;
      layer.replaceChildren();
      for (const field of info.fields) {
        if (field.type === 'unsupported') continue;
        for (const widget of field.widgets.filter(item => item.pageIndex === pageIndex && !item.hidden)) {
          const page = info.pages[pageIndex];
          const widgetView = core.widgetViewport(page, widget);
          const {width, height} = widgetView;
          const input = makeFieldControl(field, widget, true);
          input.classList.add('pdf-edit-form-widget');
          // Transform the whole native control, not just its bounding box, on rotated pages.
          Object.assign(input.style, { left: '0', top: '0', width: `${width}px`, height: `${height}px`, fontSize: `${Math.max(6, Math.min(12, height * .65))}px`, transformOrigin: '0 0', transform: `matrix(${widgetView.transform.map(value=>value*scale).join(',')})` });
          layer.append(input);
        }
      }
      for (const overlay of data.overlays.filter(item => item.pageIndex === pageIndex)) {
        if (!alive || token !== revision || layerToken !== layerRevision) return;
        const box = document.createElement('div');
        box.className = `pdf-edit-object${overlay.id === selectedId ? ' is-selected' : ''}`;
        box.dataset.overlay = overlay.id;
        box.tabIndex = 0; box.setAttribute('role', 'button'); box.setAttribute('aria-label', `${overlay.type === 'text' ? 'Text' : overlay.type} overlay; select to edit or use arrow keys to move`);
        Object.assign(box.style, { left: `${overlay.x * scale}px`, top: `${overlay.y * scale}px`, width: `${overlay.width * scale}px`, height: `${overlay.height * scale}px` });
        const art = document.createElement('div'); art.className = 'pdf-edit-object-art';
        Object.assign(art.style, { width: `${overlay.width}px`, height: `${overlay.height}px`, transform: `scale(${scale})`, color: overlay.color, opacity: String(overlay.opacity ?? 1) });
        box.append(art); layer.append(box);
        if (overlay.type === 'text') {
          try {
            const layout = await core.layoutText(overlay.text, overlay, window.PDFLib);
            if (!alive || token !== revision || layerToken !== layerRevision || !box.isConnected) return;
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', String(overlay.width)); svg.setAttribute('height', String(overlay.height));
            for (const line of layout.lines) {
              const text = document.createElementNS('http://www.w3.org/2000/svg', 'text'); text.textContent = line.text;
              text.setAttribute('x', String(line.x)); text.setAttribute('y', String(line.y));
              text.setAttribute('fill', overlay.color); text.setAttribute('font-family', fonts[overlay.font]);
              text.setAttribute('font-size', String(overlay.fontSize));
              if (overlay.font.includes('Italic')) text.setAttribute('font-style', 'italic');
              if (overlay.font.includes('Bold')) text.setAttribute('font-weight', 'bold');
              if (overlay.underline) text.setAttribute('text-decoration', 'underline');
              if (line.width > 0) { text.setAttribute('textLength', String(line.width)); text.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
              svg.append(text);
            }
            art.append(svg);
            box.classList.toggle('has-error', layout.overflow);
          } catch (_) { art.textContent = 'Text needs attention'; box.classList.add('has-error'); }
          if (!overlay.text) { art.textContent = 'Enter text'; art.classList.add('is-placeholder'); }
        } else if (overlay.type === 'image') {
          const image = document.createElement('img'); image.alt = 'Added image'; image.src = overlay.imageUrl; art.append(image);
        } else {
          const w = overlay.width, h = overlay.height, stroke = overlay.strokeWidth ?? 1.5, inset = stroke / 2;
          let shape;
          const sx = value => inset + (w-stroke)*value, sy = value => inset + (h-stroke)*value;
          if (overlay.type === 'check') shape = `<path d="M ${sx(.12)} ${sy(.52)} L ${sx(.39)} ${sy(.82)} L ${sx(.9)} ${sy(.13)}"/>`;
          else if (overlay.type === 'cross') shape = `<path d="M ${sx(.15)} ${sy(.85)} L ${sx(.85)} ${sy(.15)} M ${sx(.15)} ${sy(.15)} L ${sx(.85)} ${sy(.85)}"/>`;
          else if (overlay.type === 'ellipse') shape = `<ellipse cx="${w/2}" cy="${h/2}" rx="${Math.max(.1,(w-stroke)/2)}" ry="${Math.max(.1,(h-stroke)/2)}" fill="${escape(overlay.fill || 'none')}"/>`;
          else if (overlay.type === 'highlight') shape = `<rect width="${w}" height="${h}" fill="currentColor" stroke="none"/>`;
          else if (['line','arrow','underline','strike'].includes(overlay.type)) {
            const y = overlay.type === 'underline' ? h-inset : h/2, head = Math.min(12,(w-stroke)/3,(h-stroke)/2);
            shape = `<path d="M ${inset} ${y} H ${w-inset}${overlay.type === 'arrow' ? ` M ${w-inset-head} ${y-head} L ${w-inset} ${y} L ${w-inset-head} ${y+head}` : ''}"/>`;
          } else shape = `<rect x="${inset}" y="${inset}" width="${Math.max(0,w-stroke)}" height="${Math.max(0,h-stroke)}" fill="${escape(overlay.fill || 'none')}"/>`;
          art.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="${stroke}">${shape}</svg>`;
        }
        const grip = document.createElement('span'); grip.className = 'pdf-edit-resize'; grip.dataset.resize = 'true'; grip.setAttribute('aria-hidden','true'); box.append(grip);
      }
    }
    function renderFields() {
      if (!info) return;
      const list = $('.pdf-edit-field-list'); list.replaceChildren();
      const fields = info.fields.filter(field => field.widgets.some(widget => widget.pageIndex === pageIndex && !widget.hidden));
      if (!fields.length) { list.textContent = 'This page has no fillable fields. Use Add Text or a mark for flat forms.'; return; }
      for (const field of fields) {
        const label = document.createElement('label'); label.className = 'pdf-edit-field';
        const title = document.createElement('span'); title.textContent = `${field.name}${field.readOnly ? ' (read only)' : ''}`; label.append(title);
        if (field.type === 'unsupported') { const note=document.createElement('small'); note.textContent='This field type is preserved but cannot be edited here.'; label.append(note); }
        else label.append(makeFieldControl(field, field.widgets.find(item => item.pageIndex === pageIndex)));
        list.append(label);
      }
    }
    function renderProperties() {
      const panel = $('.pdf-edit-selection');
      const selected = data.overlays.find(item => item.id === selectedId);
      if (!selected) { panel.innerHTML = '<h2>Selected element</h2><p>Select an added element to edit it. Arrow keys move a focused element by one point; Shift moves by ten.</p>'; return; }
      panel.innerHTML = `<h2>Selected ${escape(selected.type)}</h2>
        ${selected.type === 'text' ? `<label>Text<textarea data-property="text" maxlength="5000" rows="3" placeholder="Enter your text">${escape(selected.text)}</textarea></label><label>Font<select data-property="font">${Object.keys(fonts).map(font => `<option value="${font}"${font === selected.font ? ' selected' : ''}>${font.replace('Roman',' ').replace('Italic',' Italic')}</option>`).join('')}</select></label><label>Font size (pt)<input type="number" data-property="fontSize" min="6" max="144" value="${selected.fontSize}"></label><label>Alignment<select data-property="align">${['left','center','right'].map(align => `<option${align === selected.align ? ' selected' : ''}>${align}</option>`).join('')}</select></label>` : ''}
        ${selected.type !== 'image' ? `<label>Color<input type="color" data-property="color" value="${selected.color}"></label>` : ''}
        <details class="pdf-edit-advanced"><summary>Advanced appearance</summary><div>
          <label>Opacity<input type="number" data-property="opacity" min="0" max="1" step="0.05" value="${selected.opacity ?? 1}"></label>
          ${selected.type === 'text' ? `<label>Line spacing<input type="number" data-property="lineSpacing" min="1" max="3" step="0.1" value="${selected.lineSpacing ?? 1.2}"></label><label><input type="checkbox" data-property="underline"${selected.underline ? ' checked' : ''}> Underline text</label>` : selected.type !== 'image' && selected.type !== 'highlight' ? `<label>Stroke width (pt)<input type="number" data-property="strokeWidth" min="0.25" max="20" step="0.25" value="${selected.strokeWidth ?? 1.5}"></label>` : ''}
          ${['rectangle','ellipse'].includes(selected.type) ? `<label><input type="checkbox" data-property="filled"${selected.fill ? ' checked' : ''}> Fill shape</label><label>Fill color<input type="color" data-property="fill" value="${selected.fill || '#ffffff'}"></label><p>Filled shapes cover artwork visually. They do not redact or remove underlying content.</p>` : ''}
          <button type="button" data-action="layer-front">Bring to front</button><button type="button" data-action="layer-back">Send to back</button><button type="button" data-action="duplicate-element">Duplicate element</button>
        </div></details>
        <div class="pdf-edit-dimensions">${[['x','Left'],['y','Top'],['width','Width'],['height','Height']].map(([prop,name]) => `<label>${name} (pt)<input type="number" data-property="${prop}" min="${prop === 'x' || prop === 'y' ? 0 : 8}" step="0.5" value="${Number(selected[prop].toFixed(2))}"></label>`).join('')}</div>
        ${selected.type === 'image' ? `<p>Image aspect ratio is preserved when resizing.</p><details class="pdf-edit-image-settings pdf-edit-advanced"><summary>Crop, rotate or replace image</summary><div>
          <p>Crop percentages refer to the original inserted image, before clockwise rotation. Apply to update the preview and export together. This does not edit images already inside the original PDF.</p>
          ${[['left','Crop left'],['top','Crop top'],['width','Crop width'],['height','Crop height']].map(([key,label]) => `<label>${label} (%)<input type="number" data-image-property="${key}" min="${['width','height'].includes(key) ? 0.01 : 0}" max="100" step="0.01" value="${selected.imageEdits?.[key] ?? (['width','height'].includes(key) ? 100 : 0)}"></label>`).join('')}
          <label>Image rotation<select data-image-property="rotation">${[0,90,180,270].map(angle => `<option value="${angle}"${angle === (selected.imageEdits?.rotation ?? 0) ? ' selected' : ''}>${angle}° clockwise</option>`).join('')}</select></label>
          <button type="button" data-action="apply-image-edit">Apply image changes</button><button type="button" data-action="reset-image-edit">Restore original image</button><button type="button" data-action="replace-image">Replace selected image</button>
        </div></details>` : ''}<button type="button" data-action="delete">Delete selected element</button>`;
    }
    function clampOverlay(overlay) {
      const page = info.pages[overlay.pageIndex];
      if (overlay.type === 'image') {
        const desiredWidth = Math.max(8, overlay.width);
        const ratio = Math.min(1, page.visualWidth / desiredWidth, page.visualHeight / (desiredWidth / overlay.ratio));
        overlay.width = desiredWidth * ratio;
        overlay.height = overlay.width / overlay.ratio;
      } else {
        overlay.width = Math.min(page.visualWidth, Math.max(8, overlay.width));
        overlay.height = Math.min(page.visualHeight, Math.max(8, overlay.height));
      }
      overlay.x = Math.max(0, Math.min(page.visualWidth-overlay.width, overlay.x));
      overlay.y = Math.max(0, Math.min(page.visualHeight-overlay.height, overlay.y));
    }
    function place(x, y) {
      if (!info || busy || preview || tool === 'select') return;
      if (data.overlays.length >= 300) { status('This editor supports up to 300 added elements.', true); return; }
      const page = info.pages[pageIndex];
      const textTool = ['text','date','signature'].includes(tool);
      const width = textTool ? Math.min(180,page.visualWidth*.65) : tool === 'image' ? Math.min(150,page.visualWidth*.5) : ['line','arrow','highlight','underline','strike'].includes(tool) ? Math.min(140,page.visualWidth*.5) : ['rectangle','ellipse'].includes(tool) ? 80 : 24;
      const height = tool === 'image' ? width / pendingImage.ratio : textTool ? 44 : 24;
      const overlay = { id: `overlay-${crypto.randomUUID()}`, pageIndex, type: textTool ? 'text' : tool, x, y, width, height, text: tool === 'date' ? new Date().toLocaleDateString('en-CA') : '', font: tool === 'signature' ? 'TimesRomanItalic' : 'Helvetica', fontSize: tool === 'signature' ? 22 : 14, color: '#172554', align: 'left' };
      if (tool === 'highlight') { overlay.color = '#facc15'; overlay.opacity = .3; }
      if (tool === 'image') Object.assign(overlay,pendingImage);
      clampOverlay(overlay); remember(); data.overlays.push(overlay); selectedId=overlay.id; activateTool('select'); changed('Element added. Use Selected element controls to edit it.');
      if (textTool) $('[data-property="text"]')?.focus({ preventScroll: true });
    }
    function selectedDelete() {
      if (!selectedId || busy || preview) return;
      remember(); data.overlays=data.overlays.filter(item=>item.id!==selectedId); selectedId=null; changed('Element removed.');
    }
    const imageDataUrl = blob => new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Image could not be read.')); reader.readAsDataURL(blob); });
    async function readImage(file, replaceId = null) {
      if (!file || busy || !source) return;
      const token = loadRevision;
      setBusy(true, 'Reading image…');
      try {
        if (file.size > 5 * 1024 * 1024 || file.size === 0) throw new Error('Use a non-empty PNG or JPEG image up to 5 MB.');
        if (!['image/png','image/jpeg'].includes(file.type)) throw new Error('Choose a PNG or JPEG image.');
        const imageBytes=new Uint8Array(await file.arrayBuffer());
        const bitmap = await createImageBitmap(file);
        if (bitmap.width * bitmap.height > 16_000_000) { bitmap.close(); throw new Error('Use an image below 16 megapixels.'); }
        const width=bitmap.width, height=bitmap.height, ratio=width/height; bitmap.close();
        // Data URLs stay in this module's memory, never in storage or event payloads.
        const imageUrl = await imageDataUrl(file);
        if (!alive || token !== loadRevision || !source) return;
        const asset = {imageBytes,imageType:file.type,imageUrl,ratio,imageSource:{bytes:imageBytes,type:file.type,url:imageUrl,width,height},imageEdits:null};
        if (replaceId) {
          const selected = data.overlays.find(item => item.id === replaceId && item.type === 'image');
          if (!selected) return;
          remember(); Object.assign(selected, asset); clampOverlay(selected); selectedId = selected.id;
          changed('Image replaced. Its position, width, opacity and layer order are retained; height follows the new aspect ratio.');
        } else { pendingImage=asset; activateTool('image'); status('Image ready. Tap the page or use Add at page center.'); }
      } catch(error) { if (alive && token === loadRevision) status(error.message || 'The image could not be decoded.',true); }
      finally { if (alive && token === loadRevision) { setBusy(false); historyState(); imageInput.value=''; replaceImageInput.value=''; } }
    }
    async function editImage(reset = false) {
      const selected = data.overlays.find(item => item.id === selectedId && item.type === 'image');
      if (!selected?.imageSource || busy || preview) return;
      const token = loadRevision, original = selected.imageSource;
      let bitmap = null, workCanvas = null;
      try {
        let asset, settings = null;
        if (reset) asset = { imageBytes: original.bytes, imageType: original.type, imageUrl: original.url, ratio: original.width / original.height };
        else {
          settings = Object.fromEntries(Array.from($('.pdf-edit-image-settings').querySelectorAll('[data-image-property]'), input => [input.dataset.imageProperty, input.value === '' ? NaN : Number(input.value)]));
          const shape = core.imageEditGeometry(original.width, original.height, settings);
          setBusy(true, 'Applying image crop and rotation…');
          bitmap = await createImageBitmap(new Blob([original.bytes], { type: original.type }));
          workCanvas = document.createElement('canvas'); workCanvas.width = shape.outputWidth; workCanvas.height = shape.outputHeight;
          const ctx = workCanvas.getContext('2d');
          if (!ctx) throw new Error('This browser could not prepare the image.');
          ctx.translate(shape.outputWidth / 2, shape.outputHeight / 2); ctx.rotate(shape.rotation * Math.PI / 180);
          ctx.drawImage(bitmap, shape.x, shape.y, shape.cropWidth, shape.cropHeight, -shape.cropWidth / 2, -shape.cropHeight / 2, shape.cropWidth, shape.cropHeight);
          const blob = await new Promise(resolve => workCanvas.toBlob(resolve, 'image/png'));
          if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('The edited image exceeds the 5 MB limit. Use a smaller source or crop.');
          asset = { imageBytes: new Uint8Array(await blob.arrayBuffer()), imageType: 'image/png', imageUrl: await imageDataUrl(blob), ratio: shape.outputWidth / shape.outputHeight };
        }
        if (!alive || token !== loadRevision || !data.overlays.includes(selected)) return;
        remember(); Object.assign(selected, asset, { imageEdits: settings }); clampOverlay(selected);
        changed(reset ? 'Original inserted image restored.' : 'Image crop and rotation applied. Preview and export use the same edited pixels.');
      } catch(error) { if (alive && token === loadRevision) status(error.message || 'Image changes could not be applied.', true); }
      finally { bitmap?.close(); if (workCanvas) { workCanvas.width = 1; workCanvas.height = 1; } if (alive && token === loadRevision) { setBusy(false); historyState(); } }
    }
    async function prepareOutput() {
      if (busy || !source) return false;
      if (previewUrl) return true;
      setBusy(true,'Preparing edited PDF…'); event('tool_start','started');
      const token=loadRevision;
      try {
        const output=await core.exportPdf(source,{...data,flatten:formMode.value==='flatten'},window.PDFLib);
        if (!alive || token!==loadRevision) return false;
        const blob=new Blob([output],{type:'application/pdf'});
        previewPdf=await window.pdfjsLib.getDocument({data:output.slice(),isEvalSupported:false}).promise;
        if (!alive || token!==loadRevision) { previewPdf.destroy(); return false; }
        previewUrl=URL.createObjectURL(blob);
        callbacks.onComplete?.(blob.size); event('tool_complete','completed');
        status(`Edited PDF ready · ${info.pages.length} pages · ${window.GxaWorkspace.formatBytes(blob.size)}. Check the preview before sharing.`);
        return true;
      } catch(error) { if(alive && token===loadRevision) {event('tool_fail','processing_error');status(error.message || 'The edited PDF could not be generated.',true);}return false; }
      finally { if(alive) setBusy(false); }
    }
    async function action(name) {
      if (busy && name!=='close-signature') return;
      if (name.startsWith('page-')) { await changePage(name); return; }
      if ((name==='undo' && undo.length) || (name==='redo' && redo.length)) {
        const from = name === 'undo' ? undo : redo, to = name === 'undo' ? redo : undo;
        const next = from.at(-1);
        setBusy(true, 'Restoring edit state…');
        try {
          if (JSON.stringify(next.pagePlan) !== JSON.stringify(data.pagePlan) && !await rebuildPages(next)) return;
          clearOutput(); to.push(cloneState(data)); data = from.pop(); selectedId = null;
          renderPages(); changed(name === 'undo' ? 'Last edit undone.' : 'Edit restored.'); renderFields(); await renderPage();
        } finally { if (alive) { setBusy(false); historyState(); } }
      }
      if (['layer-front','layer-back','duplicate-element'].includes(name) && selectedId && !preview) {
        const index = data.overlays.findIndex(item => item.id === selectedId);
        if (index < 0) return;
        if (name === 'duplicate-element' && data.overlays.length >= 300) { status('This editor supports up to 300 added elements.', true); return; }
        remember();
        const item = data.overlays[index];
        if (name === 'duplicate-element') { const copy = { ...item, id: `overlay-${crypto.randomUUID()}`, x: item.x + 12, y: item.y + 12 }; clampOverlay(copy); data.overlays.push(copy); selectedId = copy.id; }
        else { data.overlays.splice(index, 1); if (name === 'layer-front') data.overlays.push(item); else data.overlays.unshift(item); }
        changed('Overlay order updated. Original page content remains below added overlays.');
      }
      if (name==='delete') selectedDelete();
      if (name==='previous' || name==='next') { pageIndex=Math.max(0,Math.min(info.pages.length-1,pageIndex+(name==='next'?1:-1))); selectedId=null; renderProperties(); await renderPage(); }
      if (['zoom-in','zoom-out','fit-width','fit-page','actual-size'].includes(name)) { zoomMode=name==='fit-width'?'width':name==='fit-page'?'page':'manual'; scale=name==='actual-size'?1:Math.max(.05,Math.min(4,scale*(name==='zoom-in'?1.25:name==='zoom-out'?.8:1))); await renderPage(); }
      if (name==='place-center') { const p=info.pages[pageIndex]; place(p.visualWidth*.3,p.visualHeight*.35); }
      if (name==='image') imageInput.click();
      if (name==='replace-image' && !preview) { replaceImageInput.dataset.overlay = selectedId || ''; replaceImageInput.click(); }
      if (name==='apply-image-edit' || name==='reset-image-edit') await editImage(name==='reset-image-edit');
      if (name==='clear-page' && data.overlays.some(item=>item.pageIndex===pageIndex) && window.confirm('Clear all added overlays on this page? Original artwork and form values will remain.')) { remember(); data.overlays=data.overlays.filter(item=>item.pageIndex!==pageIndex); selectedId=null; changed('Page overlays cleared.'); }
      if (name==='reset' && window.confirm('Discard this document and all unsaved edits?')) { thumbnailObserver?.disconnect(); thumbnailTask?.cancel(); ++thumbnailRevision; ++loadRevision; ++revision; renderTask?.cancel(); pdf?.destroy(); pdf=null; clearOutput(); source=null; info=null; data={fieldValues:{},overlays:[]}; undo=[]; redo=[]; pendingImage=null; editingInput=null; sourceName=''; selectedId=null; signatureContext.clearRect(0,0,600,200);signatureHasInk=false;canvas.width=1;canvas.height=1;layer.replaceChildren();renderProperties();$('.pdf-edit-field-list').replaceChildren();$('.pdf-edit-pages').replaceChildren();$('#pdf-edit-filename').textContent='';$('#pdf-edit-info').textContent='';$('.pdf-edit-document').hidden=true;status('Choose a PDF to begin.');fileInput.focus(); }
      if (name==='preview' && await prepareOutput()) { preview=true; $('[data-action="back"]').hidden=false; await renderPage(); global.GxaWorkspace.scrollToResult(stage); }
      if (name==='back') { preview=false; $('[data-action="back"]').hidden=true; await renderPage(); }
      if (name==='download' && await prepareOutput()) { const link=document.createElement('a');link.href=previewUrl;link.download=`edited_${window.GxaWorkspace.safeFileName(sourceName)}`;document.body.append(link);link.click();link.remove();event('tool_download','downloaded'); }
      if (name==='draw-signature') { signatureContext.clearRect(0,0,600,200);signatureHasInk=false;signatureDialog.showModal(); }
      if (name==='close-signature') signatureDialog.close();
      if (name==='clear-signature') {signatureContext.clearRect(0,0,600,200);signatureHasInk=false;}
      if (name==='use-signature') {
        if (!signatureHasInk) {status('Draw a signature before adding it.',true);return;}
        const blob=await new Promise(resolve=>signatureCanvas.toBlob(resolve,'image/png'));
        if(blob) {await readImage(new File([blob],'signature.png',{type:'image/png'}));signatureDialog.close();}
      }
    }
    on(fileInput,'change',()=>loadFile(fileInput.files[0]));
    on(imageInput,'change',()=>readImage(imageInput.files[0]));
    on(replaceImageInput,'change',()=>readImage(replaceImageInput.files[0], replaceImageInput.dataset.overlay));
    on(root,'focusin',()=>{editingInput=null;});
    function updateField(event) {
      const input=event.target;
      if (!input.dataset.field || busy || preview) return;
      const field=info.fields.find(item=>item.name===input.dataset.field);
      if (!field || field.readOnly || field.type==='unsupported') return;
      const value=field.type==='checkbox'?input.checked:input.value;
      if (data.fieldValues[field.name] === value) return;
      if (editingInput !== input) { remember(); editingInput=input; }
      data.fieldValues[field.name]=value;
      // Keep page and enlarged controls synchronized without replacing the focused input.
      root.querySelectorAll('[data-field]').forEach(control=>{
        if(control===input || control.dataset.field!==field.name)return;
        if(control.type==='checkbox')control.checked=!!value;
        else if(control.type==='radio')control.checked=control.value===value;
        else control.value=value;
      });
      historyState();status('Form value updated.');
    }
    on(root,'input',updateField);
    on(root,'change',updateField);
    on(formMode,'change',()=>{if(busy)return;clearOutput();renderPage();status('Output mode changed. Generate a new preview to check it.');});
    on(root,'click',event=>{
      const button=event.target.closest('button'); if(!button)return;
      if(button.dataset.action) action(button.dataset.action).catch(()=>status('The requested editor action could not finish.',true));
      if(button.dataset.tool && !busy && !preview) activateTool(button.dataset.tool);
      if(button.dataset.page && !busy) {pageIndex=Number(button.dataset.page);selectedId=null;renderProperties();renderPage();}
    });
    function updateProperty(event) {
      const input=event.target; const prop=input.dataset.property; const selected=data.overlays.find(item=>item.id===selectedId);
      if(!selected || !prop || busy || preview)return;
      const value=input.type==='checkbox'?input.checked:['x','y','width','height','fontSize','opacity','lineSpacing','strokeWidth'].includes(prop)?Number(input.value):input.value;
      if(typeof value==='number'&&(!Number.isFinite(value)||input.value===''))return;
      if (typeof value === 'number' && !input.checkValidity()) { status('Choose a value within the displayed limits.', true); return; }
      if(selected[prop]===value)return;
      if(editingInput!==input){remember();editingInput=input;}
      selected[prop]=prop==='fontSize'?Math.max(6,Math.min(144,value)):value;
      if (prop === 'filled') selected.fill = value ? $('[data-property="fill"]').value : null;
      if (prop === 'fill') { selected.filled = true; $('[data-property="filled"]').checked = true; }
      if(selected.type==='image' && prop==='width')selected.height=selected.width/selected.ratio;
      if(selected.type==='image' && prop==='height')selected.width=selected.height*selected.ratio;
      clampOverlay(selected);historyState();renderLayers();status('Edits updated. Preview the PDF to check the exported result.');
      if(event.type==='change' && typeof selected[prop]==='number')input.value=Number(selected[prop].toFixed(2));
      $('.pdf-edit-selection').querySelectorAll('[data-property]').forEach(control=>{
        if(control!==input && typeof selected[control.dataset.property]==='number')control.value=Number(selected[control.dataset.property].toFixed(2));
      });
    }
    on($('.pdf-edit-selection'),'input',updateProperty);
    on($('.pdf-edit-selection'),'change',updateProperty);
    on(layer,'pointerdown',event=>{
      if(busy||preview||event.button!==0)return;
      const element=event.target.closest('[data-overlay]');
      if(!element) {
        if(event.target.closest('input,textarea,select'))return;
        const rect=stage.getBoundingClientRect();place((event.clientX-rect.left)/scale,(event.clientY-rect.top)/scale);return;
      }
      event.preventDefault();selectedId=element.dataset.overlay;
      const selected=data.overlays.find(item=>item.id===selectedId);const start={...selected};const origin={x:event.clientX,y:event.clientY};const resize=!!event.target.dataset.resize;let moved=false;
      renderProperties();layer.querySelectorAll('[data-overlay]').forEach(el=>el.classList.toggle('is-selected',el===element));element.focus({preventScroll:true});element.setPointerCapture(event.pointerId);
      const move=next=>{const dx=(next.clientX-origin.x)/scale,dy=(next.clientY-origin.y)/scale;if(!moved&&Math.abs(dx)+Math.abs(dy)<.5)return;if(!moved){remember();moved=true;}
        if(resize){selected.width=Math.max(8,start.width+dx);selected.height=selected.type==='image'?selected.width/selected.ratio:Math.max(8,start.height+dy);}else{selected.x=start.x+dx;selected.y=start.y+dy;}clampOverlay(selected);
        Object.assign(element.style,{left:`${selected.x*scale}px`,top:`${selected.y*scale}px`,width:`${selected.width*scale}px`,height:`${selected.height*scale}px`});};
      const end=()=>{element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',end);element.removeEventListener('pointercancel',cancel);if(moved)changed('Element position or size updated.');};
      const cancel=()=>{if(moved){data=undo.pop();redo=[];}end();changed('Move cancelled.');};
      element.addEventListener('pointermove',move);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',cancel);
    });
    on(root,'keydown',event=>{
      if(busy||event.target.closest('input,textarea,select'))return;
      if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())) {event.preventDefault();action(event.key.toLowerCase()==='y'||event.shiftKey?'redo':'undo');return;}
      const element=event.target.closest('[data-overlay]');if(!element||preview)return;selectedId=element.dataset.overlay;
      if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();selectedDelete();}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const selected=data.overlays.find(item=>item.id===selectedId);remember();const amount=event.shiftKey?10:1;selected.x+=event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0;selected.y+=event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0;clampOverlay(selected);changed();layer.querySelector(`[data-overlay="${selectedId}"]`)?.focus({preventScroll:true});}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();renderProperties();$('.pdf-edit-selection textarea, .pdf-edit-selection input')?.focus();}
    });
    on(signatureCanvas,'pointerdown',event=>{event.preventDefault();drawing=true;signatureCanvas.setPointerCapture(event.pointerId);const rect=signatureCanvas.getBoundingClientRect();signatureContext.beginPath();signatureContext.moveTo((event.clientX-rect.left)*600/rect.width,(event.clientY-rect.top)*200/rect.height);});
    on(signatureCanvas,'pointermove',event=>{if(!drawing)return;const rect=signatureCanvas.getBoundingClientRect();signatureContext.lineWidth=3;signatureContext.lineCap='round';signatureContext.lineJoin='round';signatureContext.strokeStyle='#172554';signatureContext.lineTo((event.clientX-rect.left)*600/rect.width,(event.clientY-rect.top)*200/rect.height);signatureContext.stroke();signatureHasInk=true;});
    on(signatureCanvas,'pointerup',()=>{drawing=false;});on(signatureCanvas,'pointercancel',()=>{drawing=false;});
    const observer=new ResizeObserver(()=>{window.clearTimeout(resizeTimer);resizeTimer=window.setTimeout(()=>{if(info&&zoomMode!=='manual')renderPage();},100);});observer.observe(viewport);
    active={destroy(){alive=false;++loadRevision;++revision;++thumbnailRevision;thumbnailObserver?.disconnect();thumbnailTask?.cancel();abort.abort();observer.disconnect();window.clearTimeout(resizeTimer);renderTask?.cancel();pdf?.destroy();clearOutput();signatureDialog.close();source=null;data={fieldValues:{},overlays:[]};undo=[];redo=[];pendingImage=null;root.replaceChildren();}};
  }
  window.GxaPdfEditor=Object.freeze({mount,dispose});
})();
