(function (global) {
  'use strict';

  let active = null;

  const html = `
    <section class="image-converter" aria-label="Image conversion workspace">
      <div class="image-converter__notice"><i data-lucide="shield-check" aria-hidden="true"></i><div><strong>Your image is processed in your browser.</strong><span>Image bytes, filenames, metadata, and decoded pixels are not sent to GXA analytics.</span></div></div>
      <div class="image-converter__grid">
        <section class="image-converter__panel" aria-labelledby="image-converter-original-title">
          <div class="image-converter__panel-head"><div><p class="image-converter__eyebrow">Step 1</p><h2 id="image-converter-original-title">Original image</h2></div><button type="button" class="btn btn-ghost image-converter__reset" hidden>Convert another</button></div>
          <div class="image-converter__drop" tabindex="0" role="button" aria-label="Choose an image to convert">
            <i data-lucide="image-up" aria-hidden="true"></i><strong>Choose an image</strong><span>JPG, PNG, WebP, GIF, BMP, TIFF, ICO or SVG · up to 50 MB. Format-specific limits apply.</span><button type="button" class="btn btn-primary image-converter__choose">Select image</button>
            <input class="image-converter__input" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/tiff,image/x-icon,image/svg+xml,.jpg,.jpeg,.jfif,.png,.webp,.avif,.gif,.bmp,.dib,.tif,.tiff,.ico,.cur,.svg,.heic,.heif,.psd,.psb,.hdr,.exr,.jp2,.jxl,.raw,.dng" hidden>
          </div>
          <div class="image-converter__original" hidden>
            <div class="image-converter__preview"><img alt="Original image preview"></div>
            <dl class="image-converter__stats"><div><dt>Detected format</dt><dd data-original="format">—</dd></div><div><dt>Dimensions</dt><dd data-original="dimensions">—</dd></div><div><dt>File size</dt><dd data-original="size">—</dd></div><div><dt>Transparency</dt><dd data-original="alpha">—</dd></div></dl>
            <p class="image-converter__detection" role="status"></p>
          </div>
        </section>
        <section class="image-converter__panel image-converter__settings" aria-labelledby="image-converter-settings-title">
          <div><p class="image-converter__eyebrow">Step 2</p><h2 id="image-converter-settings-title">Conversion settings</h2></div>
          <label class="image-converter__field"><span>Convert to</span><select class="image-converter__format" disabled aria-describedby="image-converter-format-help"><option>Upload an image first</option></select><small id="image-converter-format-help">Only verified encoders available in this browser are listed.</small></label>
          <label class="image-converter__field image-converter__quality" hidden><span>Quality <output>90</output></span><input type="range" min="10" max="100" value="90" step="1"></label>
          <label class="image-converter__field image-converter__icon-size" hidden><span>Icon size</span><select><option>16</option><option>32</option><option selected>48</option><option>64</option><option>128</option><option>256</option></select><small>ICO output is one PNG-compressed square icon at the selected size.</small></label>
          <fieldset class="image-converter__background" hidden><legend>Transparent-area background</legend><div><label><input type="radio" name="image-converter-background" value="#ffffff" checked> White</label><label><input type="radio" name="image-converter-background" value="#000000"> Black</label><label><input type="radio" name="image-converter-background" value="custom"> Custom</label><input type="color" value="#ffffff" aria-label="Custom transparency background"></div><small>This output format has no alpha channel. Transparent pixels will be filled with the selected color.</small></fieldset>
          <label class="image-converter__consent" hidden><input type="checkbox"><span></span></label>
          <div class="image-converter__metadata"><strong>Metadata</strong><p>Pixel conversion re-encodes the image and removes EXIF, ICC profiles, location, comments, and other source metadata. Metadata preservation is not offered because it cannot be guaranteed across these formats.</p></div>
          <button type="button" class="btn btn-primary btn-lg image-converter__convert" disabled><i data-lucide="repeat-2" aria-hidden="true"></i> Convert Image</button>
          <p class="image-converter__status" role="status" aria-live="polite"></p>
        </section>
      </div>
      <section class="image-converter__panel image-converter__result" hidden aria-labelledby="image-converter-result-title">
        <div class="image-converter__panel-head"><div><p class="image-converter__eyebrow">Result</p><h2 id="image-converter-result-title">Converted image</h2></div></div>
        <div class="image-converter__result-grid"><div class="image-converter__preview"><img alt="Converted image preview"></div><dl class="image-converter__stats"><div><dt>Output format</dt><dd data-result="format">—</dd></div><div><dt>Dimensions</dt><dd data-result="dimensions">—</dd></div><div><dt>File size</dt><dd data-result="size">—</dd></div></dl></div>
          ${global.GxaResultFlow?.renderAdPlacement?.() || ''}
          <section class="result-download-section" aria-labelledby="image-converter-download-title"><div class="result-download-copy"><span class="image-converter__eyebrow">Download</span><h3 id="image-converter-download-title">Save your converted image</h3><p>The format, dimensions and file size above describe this output.</p></div><button type="button" class="btn btn-primary btn-lg image-converter__download"><i data-lucide="download" aria-hidden="true"></i> Download</button></section>
          ${global.GxaResultFlow?.renderRating?.('image-converter') || ''}
      </section>
    </section>`;

  function formatBytes(bytes) {
    if (global.GxaWorkspace?.formatBytes) return global.GxaWorkspace.formatBytes(bytes);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function canvasFor(width, height) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
  function imageDataOn(canvas) { return canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height); }
  function canvasBlob(canvas, type, quality) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`This browser could not encode ${type}.`)), type, quality)); }
  function revoke(value) { if (value) URL.revokeObjectURL(value); }
  function status(state, message, error = false) { state.elements.status.textContent = message; state.elements.status.classList.toggle('is-error', error); }

  async function nativeCanvas(blob, width, height) {
    if (!('createImageBitmap' in global)) throw new Error('This browser does not provide the required local image decoder.');
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image', premultiplyAlpha: 'default', colorSpaceConversion: 'default' });
    const targetWidth = width || bitmap.width; const targetHeight = height || bitmap.height; global.GxaImageConverterCore.assertDimensions(targetWidth, targetHeight);
    const canvas = canvasFor(targetWidth, targetHeight); canvas.getContext('2d').drawImage(bitmap, 0, 0, targetWidth, targetHeight); bitmap.close?.(); return canvas;
  }

  async function safeSvgCanvas(text, width, height) {
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    try {
      const image = new Image(); image.decoding = 'async'; image.src = url;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('The sanitized SVG could not be rasterized by this browser.')); });
      const canvas = canvasFor(width, height); canvas.getContext('2d').drawImage(image, 0, 0, width, height); return canvas;
    } finally { URL.revokeObjectURL(url); }
  }

  async function decode(file, detection) {
    const core = global.GxaImageConverterCore; const bytes = new Uint8Array(await file.arrayBuffer()); let canvas; let pages = 1; let animated = false; let note = '';
    if (detection.format === 'bmp') { const decoded = core.decodeBmp(bytes); canvas = canvasFor(decoded.width, decoded.height); canvas.getContext('2d').putImageData(new ImageData(decoded.rgba, decoded.width, decoded.height), 0, 0); }
    else if (detection.format === 'tiff') { const decoded = core.decodeTiff(bytes); pages = decoded.pages; canvas = canvasFor(decoded.width, decoded.height); canvas.getContext('2d').putImageData(new ImageData(decoded.rgba, decoded.width, decoded.height), 0, 0); note = pages > 1 ? `This TIFF has ${pages} pages. Only its first page can be converted.` : ''; }
    else if (detection.format === 'gif') { if (!global.GxaGifDecoder) await global.GxaWorkspace.loadScriptOnce('/assets/gif-decoder.js', 'GxaGifDecoder'); const decoded = global.GxaGifDecoder.decode(bytes, { maximumBytes: core.MAX_BYTES, maximumDimension: 4096, maximumFramePixels: 12_000_000, maximumTotalPixels: 24_000_000, maximumFrames: 120 }); animated = decoded.frames.length > 1; canvas = canvasFor(decoded.width, decoded.height); canvas.getContext('2d').putImageData(new ImageData(decoded.frames[0].rgba, decoded.width, decoded.height), 0, 0); note = animated ? `This GIF has ${decoded.frames.length} frames. This converter can export its first frame only.` : ''; }
    else if (detection.format === 'ico') { const parsed = core.parseIco(bytes); pages = parsed.entries.length; const chosen = parsed.supported[0]; canvas = await nativeCanvas(new Blob([chosen.bytes], { type: 'image/png' })); note = pages > 1 ? `This icon has ${pages} entries. The largest PNG-compressed entry (${chosen.width} × ${chosen.height}) is selected.` : ''; }
    else if (detection.format === 'svg') { const safe = core.sanitizeSvg(await file.text(), DOMParser, XMLSerializer); canvas = await safeSvgCanvas(safe.text, safe.width, safe.height); note = 'The SVG was validated with the restricted, self-contained rasterizer before preview.'; }
    else { canvas = await nativeCanvas(new Blob([bytes], { type: core.MIME[detection.format] || file.type })); if (core.detectAnimation(bytes, detection.format)) { animated = true; note = `This ${detection.label} contains animation. This converter can export its first frame only.`; } }
    const imageData = imageDataOn(canvas); return { canvas, rgba: imageData.data, width: canvas.width, height: canvas.height, alpha: core.hasAlpha(imageData.data), pages, animated, note };
  }

  async function probeWebp() { const canvas = canvasFor(1, 1); const blob = await canvasBlob(canvas, 'image/webp', 0.8).catch(() => null); return Boolean(blob && global.GxaImageConverterCore.verifyOutput(new Uint8Array(await blob.arrayBuffer()), 'webp')); }

  async function setOriginal(state) {
    const { detection, source, file, elements } = state; elements.original.hidden = false; elements.reset.hidden = false; elements.drop.hidden = true;
    elements.originalFields.format.textContent = detection.label; elements.originalFields.dimensions.textContent = `${source.width} × ${source.height}`; elements.originalFields.size.textContent = formatBytes(file.size); elements.originalFields.alpha.textContent = source.alpha ? 'Present' : 'None detected';
    revoke(state.sourceUrl); const previewBlob = await canvasBlob(source.canvas, 'image/png'); state.sourceUrl = URL.createObjectURL(previewBlob); elements.originalImage.src = state.sourceUrl;
    const notes = []; if (detection.mismatch) notes.push(`The file extension does not match its ${detection.label} signature; the detected bytes are used.`); if (detection.mimeMismatch) notes.push('The supplied MIME type does not match the detected bytes.'); if (source.note) notes.push(source.note); elements.detection.textContent = notes.join(' ');
  }

  function updateSettings(state, { resetConsent = false } = {}) {
    const { core, source, elements } = state; const selected = elements.format.value; const spec = core.OUTPUTS[selected]; elements.quality.hidden = !spec?.lossy; elements.iconSize.hidden = !spec?.icon; elements.background.hidden = !source?.alpha || spec?.alpha !== false; elements.consent.hidden = !(source?.animated || source?.pages > 1);
    if (!elements.consent.hidden) { if (resetConsent) elements.consent.querySelector('input').checked = false; elements.consent.querySelector('span').textContent = source.animated ? 'Convert the first animation frame only' : 'Convert the first TIFF page / selected icon entry only'; }
    elements.convert.disabled = !spec || (!elements.consent.hidden && !elements.consent.querySelector('input').checked);
  }

  function backgroundColor(elements) { const choice = elements.background.querySelector('input[type="radio"]:checked')?.value || '#ffffff'; return choice === 'custom' ? elements.background.querySelector('input[type="color"]').value : choice; }
  function flattenedCanvas(source, background) { const canvas = canvasFor(source.width, source.height); const context = canvas.getContext('2d'); context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(source.canvas, 0, 0); return canvas; }

  function workerRequest(worker, data, transfer = []) { return new Promise((resolve, reject) => { const id = `${Date.now()}-${Math.random()}`; const listener = event => { if (event.data?.id !== id) return; worker.removeEventListener('message', listener); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data); }; worker.addEventListener('message', listener); worker.postMessage({ ...data, id }, transfer); }); }
  async function encodeGif(canvas) { const rgba = imageDataOn(canvas).data; const worker = new Worker('/assets/gif-encoder-worker.js', { type: 'module' }); try { await workerRequest(worker, { type: 'initialize', width: canvas.width, height: canvas.height, delay: 100 }); const transferable = rgba.buffer.slice(0); await workerRequest(worker, { type: 'frame', rgba: transferable }, [transferable]); const result = await workerRequest(worker, { type: 'finish' }); return new Blob([result.output], { type: 'image/gif' }); } finally { worker.terminate(); } }

  async function convert(state) {
    const { core, source, elements } = state; const format = elements.format.value; const spec = core.OUTPUTS[format]; if (!source || !spec) return;
    if (!elements.consent.hidden && !elements.consent.querySelector('input').checked) { status(state, 'Confirm the first-frame or first-page conversion before continuing.', true); return; }
    elements.convert.disabled = true; elements.convert.setAttribute('aria-busy', 'true'); status(state, `Converting to ${spec.label}…`); state.options.onEvent?.('tool_start', 'processing');
    try {
      const background = backgroundColor(elements); const working = spec.alpha === false && source.alpha ? flattenedCanvas(source, background) : source.canvas; let blob; let width = working.width; let height = working.height;
      if (format === 'jpeg' || format === 'png' || format === 'webp') blob = await canvasBlob(working, spec.mime, Number(elements.quality.querySelector('input').value) / 100);
      else if (format === 'bmp') blob = new Blob([core.encodeBmp({ width, height, rgba: imageDataOn(working).data, background })], { type: spec.mime });
      else if (format === 'tiff') blob = new Blob([core.encodeTiff({ width, height, rgba: imageDataOn(working).data })], { type: spec.mime });
      else if (format === 'gif') blob = await encodeGif(working);
      else if (format === 'ico') { width = height = Number(elements.iconSize.querySelector('select').value); const iconCanvas = canvasFor(width, height); iconCanvas.getContext('2d').drawImage(source.canvas, 0, 0, width, height); const png = await canvasBlob(iconCanvas, 'image/png'); blob = new Blob([core.encodeIco(new Uint8Array(await png.arrayBuffer()), width)], { type: spec.mime }); }
      else throw new Error('The selected output encoder is not available.');
      const outputBytes = new Uint8Array(await blob.arrayBuffer()); if (!core.verifyOutput(outputBytes, format)) throw new Error(`The browser returned bytes that are not a valid ${spec.label} signature.`);
      revoke(state.resultUrl); state.resultUrl = URL.createObjectURL(blob); state.result = { blob, format, width, height, spec }; elements.result.hidden = false; elements.resultImage.src = state.resultUrl; elements.resultFields.format.textContent = spec.label; elements.resultFields.dimensions.textContent = `${width} × ${height}`; elements.resultFields.size.textContent = formatBytes(blob.size); elements.download.innerHTML = `<i data-lucide="download" aria-hidden="true"></i> Download ${spec.label}`; global.lucide?.createIcons(); global.GxaWorkspace.scrollToResult(elements.result, 'nearest'); status(state, `${spec.label} conversion is ready to download.`); state.options.onEvent?.('tool_complete', 'completed'); state.options.onComplete?.(blob.size);
    } catch (error) { status(state, error instanceof Error ? error.message : 'Image conversion failed.', true); state.options.onEvent?.('tool_fail', 'failed'); }
    finally { elements.convert.removeAttribute('aria-busy'); updateSettings(state); }
  }

  async function selectFile(state, file) {
    reset(state, false); state.file = file; status(state, 'Inspecting image signature and decoding pixels…');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()); state.detection = state.core.detect(bytes, { name: file.name, mime: file.type });
      if (state.detection.support === 'unsupported') throw new Error(state.detection.reason);
      state.source = await decode(file, state.detection); await setOriginal(state);
      const capabilities = { webp: await probeWebp(), gif: typeof Worker === 'function' }; const outputs = state.core.outputOptions(state.detection.format, capabilities); state.elements.format.innerHTML = outputs.map(item => `<option value="${item.format}">${item.label}</option>`).join(''); state.elements.format.disabled = !outputs.length; updateSettings(state, { resetConsent: true }); status(state, outputs.length ? 'Choose an output format and convert.' : 'No compatible output encoder is available in this browser.', !outputs.length);
    } catch (error) { state.detection = null; state.source = null; state.elements.drop.hidden = false; state.elements.original.hidden = true; state.elements.reset.hidden = true; state.elements.format.innerHTML = '<option>Upload an image first</option>'; state.elements.format.disabled = true; state.elements.convert.disabled = true; status(state, error instanceof Error ? error.message : 'The image could not be decoded.', true); state.options.onEvent?.('tool_fail', 'invalid_input'); }
  }

  function reset(state, restorePrompt = true) { revoke(state.sourceUrl); revoke(state.resultUrl); state.sourceUrl = ''; state.resultUrl = ''; state.file = null; state.source = null; state.result = null; state.detection = null; state.elements.input.value = ''; state.elements.original.hidden = true; state.elements.result.hidden = true; state.elements.reset.hidden = true; state.elements.drop.hidden = false; state.elements.format.innerHTML = '<option>Upload an image first</option>'; state.elements.format.disabled = true; state.elements.quality.hidden = true; state.elements.iconSize.hidden = true; state.elements.background.hidden = true; state.elements.consent.hidden = true; state.elements.convert.disabled = true; if (restorePrompt) status(state, ''); }

  function mount(root, options = {}) {
    dispose(); root.innerHTML = html; root.setAttribute('aria-busy', 'false'); const pick = selector => root.querySelector(selector); const fields = prefix => Object.fromEntries(['format', 'dimensions', 'size', 'alpha'].map(key => [key, root.querySelector(`[data-${prefix}="${key}"]`)]));
    const state = { root, core: global.GxaImageConverterCore, options, sourceUrl: '', resultUrl: '', elements: { input: pick('.image-converter__input'), choose: pick('.image-converter__choose'), drop: pick('.image-converter__drop'), original: pick('.image-converter__original'), originalImage: pick('.image-converter__original img'), originalFields: fields('original'), detection: pick('.image-converter__detection'), reset: pick('.image-converter__reset'), format: pick('.image-converter__format'), quality: pick('.image-converter__quality'), iconSize: pick('.image-converter__icon-size'), background: pick('.image-converter__background'), consent: pick('.image-converter__consent'), convert: pick('.image-converter__convert'), status: pick('.image-converter__status'), result: pick('.image-converter__result'), resultImage: pick('.image-converter__result img'), resultFields: fields('result'), download: pick('.image-converter__download') } }; active = state;
    state.elements.choose.addEventListener('click', event => { event.stopPropagation(); state.elements.input.click(); }); state.elements.drop.addEventListener('click', event => { if (!event.target.closest('button')) state.elements.input.click(); }); state.elements.drop.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); state.elements.input.click(); } });
    ['dragenter', 'dragover'].forEach(type => state.elements.drop.addEventListener(type, event => { event.preventDefault(); state.elements.drop.classList.add('is-dragging'); })); ['dragleave', 'drop'].forEach(type => state.elements.drop.addEventListener(type, event => { event.preventDefault(); state.elements.drop.classList.remove('is-dragging'); })); state.elements.drop.addEventListener('drop', event => { const file = event.dataTransfer?.files?.[0]; if (file) selectFile(state, file); }); state.elements.input.addEventListener('change', () => { const file = state.elements.input.files?.[0]; if (file) selectFile(state, file); });
    state.elements.format.addEventListener('change', () => updateSettings(state, { resetConsent: true })); state.elements.quality.querySelector('input').addEventListener('input', event => { state.elements.quality.querySelector('output').value = event.target.value; }); state.elements.consent.querySelector('input').addEventListener('change', () => updateSettings(state)); state.elements.convert.addEventListener('click', () => convert(state)); state.elements.reset.addEventListener('click', () => reset(state)); state.elements.download.addEventListener('click', () => { if (!state.result) return; const base = (state.file?.name || 'converted-image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'converted-image'; const anchor = document.createElement('a'); anchor.href = state.resultUrl; anchor.download = `${base}.${state.result.spec.extension}`; anchor.click(); state.options.onEvent?.('tool_download', 'downloaded'); }); global.lucide?.createIcons();
  }

  function dispose() { if (!active) return; revoke(active.sourceUrl); revoke(active.resultUrl); active.root?.replaceChildren(); active = null; }
  global.GxaImageConverter = Object.freeze({ mount, dispose });
})(window);
