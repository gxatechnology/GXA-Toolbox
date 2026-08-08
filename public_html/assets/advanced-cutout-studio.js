(function () {
  'use strict';

  const DEFAULTS = {
    background: {
      mode: 'transparent',
      color: '#ffffff',
      gradientA: '#2563eb',
      gradientB: '#f59e0b',
      gradientAngle: 135,
      blur: 18,
      darken: 0,
      image: null,
      imageUrl: ''
    },
    subject: {
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      shadow: false,
      shadowX: 18,
      shadowY: 24,
      shadowBlur: 28,
      shadowOpacity: 35,
      shadowColor: '#000000',
      groundShadow: false,
      outline: false,
      outlineWidth: 12,
      outlineColor: '#ffffff',
      outlineOpacity: 100,
      glow: false,
      glowColor: '#2563eb',
      glowBlur: 24,
      glowOpacity: 45
    },
    all: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      temperature: 0,
      tint: 0,
      gamma: 100
    },
    export: {
      format: 'png',
      transparency: true,
      scale: 1,
      quality: 92
    },
    crop: null,
    selectedLayer: 'subject',
    activePanel: 'cutout',
    activeTool: 'move',
    maskView: 'normal',
    zoom: 1
  };

  const SOCIAL_PRESETS = {
    square: [1080, 1080],
    portrait: [1080, 1350],
    story: [1080, 1920],
    landscape: [1200, 630],
    youtube: [1280, 720],
    linkedin: [1584, 396],
    facebook: [1640, 924],
    product: [1600, 1600],
    passport: [413, 531]
  };

  const EFFECTS = {
    original: {},
    bw: { saturation: 0 },
    warm: { saturation: 112, temperature: 18 },
    cool: { saturation: 108, temperature: -18 },
    vivid: { saturation: 135, contrast: 112 },
    sepia: { sepia: 65, saturation: 90 },
    vintage: { sepia: 35, contrast: 92, brightness: 105 },
    matte: { contrast: 88, brightness: 106, saturation: 92 },
    fade: { contrast: 80, brightness: 110, saturation: 82 },
    high: { contrast: 135, saturation: 110 },
    soft: { brightness: 104, contrast: 90, blur: 0.6 },
    cinematic: { contrast: 118, saturation: 88, temperature: -8 },
    duotone: { saturation: 0, tint: 25 },
    grayscale: { saturation: 0 },
    invert: { invert: 100 }
  };

  let studio = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The image could not be decoded.'));
      image.src = src;
    });
  }

  function fileToUrl(file) {
    return URL.createObjectURL(file);
  }

  function canvas(width, height) {
    const next = document.createElement('canvas');
    next.width = Math.max(1, Math.round(width));
    next.height = Math.max(1, Math.round(height));
    return next;
  }

  function drawCheckerboard(ctx, width, height, size) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        ctx.fillStyle = ((x / size + y / size) % 2) ? '#e5e7eb' : '#f8fafc';
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  function filterFrom(values) {
    const brightness = values.brightness ?? 100;
    const contrast = values.contrast ?? 100;
    const saturation = values.saturation ?? 100;
    const blur = values.blur ?? 0;
    const sepia = values.sepia ?? 0;
    const invert = values.invert ?? 0;
    return [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
      `sepia(${sepia}%)`,
      `invert(${invert}%)`,
      `blur(${blur}px)`
    ].join(' ');
  }

  function applyTemperatureTint(ctx, width, height, temperature, tint) {
    if (!temperature && !tint) return;
    ctx.save();
    ctx.globalCompositeOperation = temperature > 0 ? 'soft-light' : 'multiply';
    ctx.globalAlpha = Math.min(0.28, Math.abs(temperature) / 100);
    ctx.fillStyle = temperature > 0 ? '#f59e0b' : '#38bdf8';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.min(0.22, Math.abs(tint) / 100);
    ctx.fillStyle = tint > 0 ? '#ec4899' : '#22c55e';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function alphaMaskFromCutout(image) {
    const out = canvas(image.naturalWidth, image.naturalHeight);
    const ctx = out.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, out.width, out.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const alpha = pixels.data[i + 3];
      pixels.data[i] = alpha;
      pixels.data[i + 1] = alpha;
      pixels.data[i + 2] = alpha;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    return out;
  }

  function cloneCanvas(source) {
    const out = canvas(source.width, source.height);
    out.getContext('2d').drawImage(source, 0, 0);
    return out;
  }

  function makeSubjectCanvas(original, mask, state) {
    const out = canvas(original.naturalWidth || original.width, original.naturalHeight || original.height);
    const ctx = out.getContext('2d');
    ctx.filter = filterFrom(state.subject);
    ctx.globalAlpha = state.subject.opacity;
    ctx.drawImage(original, 0, 0, out.width, out.height);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'source-over';
    return out;
  }

  function renderBackground(ctx, target, state, original) {
    const bg = state.background;
    if (bg.mode === 'transparent' && state.export.transparency) {
      return;
    }
    if (bg.mode === 'blur') {
      ctx.save();
      ctx.filter = `blur(${bg.blur}px) brightness(${100 - bg.darken}%)`;
      const scale = Math.max(target.width / original.naturalWidth, target.height / original.naturalHeight);
      const w = original.naturalWidth * scale;
      const h = original.naturalHeight * scale;
      ctx.drawImage(original, (target.width - w) / 2, (target.height - h) / 2, w, h);
      ctx.restore();
      return;
    }
    if (bg.mode === 'custom' && bg.image) {
      ctx.save();
      ctx.filter = `blur(${bg.blur || 0}px) brightness(${100 - bg.darken}%)`;
      const scale = Math.max(target.width / bg.image.naturalWidth, target.height / bg.image.naturalHeight);
      const w = bg.image.naturalWidth * scale;
      const h = bg.image.naturalHeight * scale;
      ctx.drawImage(bg.image, (target.width - w) / 2, (target.height - h) / 2, w, h);
      ctx.restore();
      return;
    }
    if (bg.mode === 'gradient') {
      const radians = (bg.gradientAngle - 90) * Math.PI / 180;
      const cx = target.width / 2;
      const cy = target.height / 2;
      const len = Math.max(target.width, target.height);
      const grad = ctx.createLinearGradient(cx - Math.cos(radians) * len, cy - Math.sin(radians) * len, cx + Math.cos(radians) * len, cy + Math.sin(radians) * len);
      grad.addColorStop(0, bg.gradientA);
      grad.addColorStop(1, bg.gradientB);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, target.width, target.height);
      return;
    }
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, target.width, target.height);
  }

  function transformDraw(ctx, source, target, subject) {
    const x = target.width / 2 + subject.x;
    const y = target.height / 2 + subject.y;
    const fit = Math.min(target.width / source.width, target.height / source.height);
    const scale = fit * subject.scale;
    ctx.translate(x, y);
    ctx.rotate(subject.rotate * Math.PI / 180);
    ctx.scale(subject.flipX ? -scale : scale, subject.flipY ? -scale : scale);
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
  }

  function drawOutline(ctx, subjectCanvas, target, subject) {
    if (!subject.outline && !subject.glow) return;
    const mask = canvas(subjectCanvas.width, subjectCanvas.height);
    const mctx = mask.getContext('2d');
    mctx.drawImage(subjectCanvas, 0, 0);
    mctx.globalCompositeOperation = 'source-in';
    mctx.fillStyle = subject.outlineColor;
    mctx.globalAlpha = subject.outlineOpacity / 100;
    mctx.fillRect(0, 0, mask.width, mask.height);
    ctx.save();
    if (subject.glow) {
      ctx.shadowColor = subject.glowColor;
      ctx.shadowBlur = subject.glowBlur;
      ctx.globalAlpha = subject.glowOpacity / 100;
      transformDraw(ctx, mask, target, subject);
    }
    if (subject.outline) {
      ctx.globalAlpha = subject.outlineOpacity / 100;
      const offsets = Math.max(1, Math.round(subject.outlineWidth / 4));
      for (let i = -offsets; i <= offsets; i += 1) {
        for (let j = -offsets; j <= offsets; j += 1) {
          if (!i && !j) continue;
          ctx.save();
          const shifted = { ...subject, x: subject.x + i * 4, y: subject.y + j * 4 };
          transformDraw(ctx, mask, target, shifted);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  function drawSubjectEffects(ctx, subjectCanvas, target, subject) {
    if (subject.shadow) {
      ctx.save();
      ctx.shadowColor = hexToRgba(subject.shadowColor, subject.shadowOpacity / 100);
      ctx.shadowBlur = subject.shadowBlur;
      ctx.shadowOffsetX = subject.shadowX;
      ctx.shadowOffsetY = subject.shadowY;
      transformDraw(ctx, subjectCanvas, target, subject);
      ctx.restore();
    }
    if (subject.groundShadow) {
      ctx.save();
      ctx.globalAlpha = subject.shadowOpacity / 100;
      ctx.filter = `blur(${subject.shadowBlur}px)`;
      ctx.fillStyle = subject.shadowColor;
      ctx.translate(target.width / 2 + subject.x, target.height / 2 + subject.y + subjectCanvas.height * 0.28 * subject.scale);
      ctx.rotate(subject.rotate * Math.PI / 180);
      ctx.scale(subject.scale, subject.scale * 0.28);
      ctx.beginPath();
      ctx.ellipse(0, 0, subjectCanvas.width * 0.24, subjectCanvas.height * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#000000').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean.padEnd(6, '0');
    const value = parseInt(full.slice(0, 6), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }

  function composite(state, options = {}) {
    const scale = options.scale || 1;
    const crop = options.crop === false ? null : state.crop;
    const baseW = state.canvasWidth;
    const baseH = state.canvasHeight;
    const target = crop
      ? canvas(crop.w * scale, crop.h * scale)
      : canvas(baseW * scale, baseH * scale);
    const ctx = target.getContext('2d');
    ctx.save();
    ctx.scale(scale, scale);
    if (crop) ctx.translate(-crop.x, -crop.y);
    if (options.checker) drawCheckerboard(ctx, baseW, baseH, 24);
    renderBackground(ctx, { width: baseW, height: baseH }, state, state.originalImage);
    const subjectCanvas = makeSubjectCanvas(state.originalImage, state.maskCanvas, state);
    drawSubjectEffects(ctx, subjectCanvas, { width: baseW, height: baseH }, state.subject);
    drawOutline(ctx, subjectCanvas, { width: baseW, height: baseH }, state.subject);
    ctx.save();
    transformDraw(ctx, subjectCanvas, { width: baseW, height: baseH }, state.subject);
    ctx.restore();
    drawDesignLayers(ctx, state, { width: baseW, height: baseH });
    ctx.restore();
    ctx.filter = filterFrom(state.all);
    if (state.all.brightness !== 100 || state.all.contrast !== 100 || state.all.saturation !== 100) {
      const temp = canvas(target.width, target.height);
      temp.getContext('2d').drawImage(target, 0, 0);
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(temp, 0, 0);
      ctx.filter = 'none';
    }
    applyTemperatureTint(ctx, target.width, target.height, state.all.temperature, state.all.tint);
    return target;
  }

  function drawDesignLayers(ctx, state, target) {
    state.layers.forEach(layer => {
      if (!layer.visible || layer.locked) return;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.translate(layer.x, layer.y);
      ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      if (layer.type === 'text') {
        ctx.font = `${layer.weight || 700} ${layer.size || 64}px ${layer.font || 'Outfit, sans-serif'}`;
        ctx.textAlign = layer.align || 'center';
        ctx.textBaseline = 'middle';
        if (layer.shadow) {
          ctx.shadowColor = hexToRgba(layer.shadowColor || '#000000', 0.45);
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 8;
        }
        if (layer.outline) {
          ctx.lineWidth = layer.outlineWidth || 6;
          ctx.strokeStyle = layer.outlineColor || '#ffffff';
          ctx.strokeText(layer.text, 0, 0);
        }
        ctx.fillStyle = layer.color || '#111827';
        ctx.fillText(layer.text, 0, 0);
      } else if (layer.type === 'shape') {
        ctx.fillStyle = layer.fill || '#2563eb';
        ctx.strokeStyle = layer.stroke || '#0f172a';
        ctx.lineWidth = layer.strokeWidth || 0;
        const w = layer.w || 220;
        const h = layer.h || 120;
        if (layer.shape === 'circle') {
          ctx.beginPath();
          ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          if (ctx.lineWidth) ctx.stroke();
        } else if (layer.shape === 'line' || layer.shape === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(-w / 2, 0);
          ctx.lineTo(w / 2, 0);
          ctx.strokeStyle = layer.fill || '#2563eb';
          ctx.lineWidth = layer.strokeWidth || 8;
          ctx.stroke();
          if (layer.shape === 'arrow') {
            ctx.beginPath();
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w / 2 - 24, -16);
            ctx.lineTo(w / 2 - 24, 16);
            ctx.closePath();
            ctx.fillStyle = layer.fill || '#2563eb';
            ctx.fill();
          }
        } else {
          roundedRect(ctx, -w / 2, -h / 2, w, h, layer.radius || (layer.shape === 'rounded' ? 28 : 0));
          ctx.fill();
          if (ctx.lineWidth) ctx.stroke();
        }
      }
      ctx.restore();
    });
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  async function open(options) {
    close();
    const originalUrl = fileToUrl(options.originalFile);
    const [originalImage, cutoutImage] = await Promise.all([
      loadImage(originalUrl),
      loadImage(options.cutoutUrl)
    ]);
    const state = {
      ...clone(DEFAULTS),
      originalFile: options.originalFile,
      originalUrl,
      cutoutUrl: options.cutoutUrl,
      outputFilename: options.outputFilename || 'cutout.png',
      originalImage,
      cutoutImage,
      canvasWidth: originalImage.naturalWidth,
      canvasHeight: originalImage.naturalHeight,
      originalMaskCanvas: options.initialMaskCanvas ? cloneCanvas(options.initialMaskCanvas) : alphaMaskFromCutout(cutoutImage),
      maskCanvas: options.initialMaskCanvas ? cloneCanvas(options.initialMaskCanvas) : alphaMaskFromCutout(cutoutImage),
      segmentationStats: options.segmentationStats || null,
      segmentationProvider: options.segmentationProvider || 'unknown',
      layers: [],
      history: [],
      future: [],
      recentColors: ['#ffffff', '#000000', '#2563eb'],
      pointer: null,
      onExport: options.onExport
    };
    studio = state;
    options.mount.innerHTML = renderShell(state);
    bind(state, options.mount);
    pushHistory(state, true);
    render(state);
    return state;
  }

  function close() {
    if (!studio) return;
    if (studio.originalUrl) URL.revokeObjectURL(studio.originalUrl);
    if (studio.cutoutUrl?.startsWith('blob:')) URL.revokeObjectURL(studio.cutoutUrl);
    if (studio.background.imageUrl) URL.revokeObjectURL(studio.background.imageUrl);
    studio = null;
  }

  function renderShell(state) {
    return `
      <section class="cutout-studio" aria-label="Advanced Cutout Studio">
        <header class="cutout-topbar">
          <div>
            <span class="cutout-kicker">Advanced Cutout Studio</span>
            <strong>${escapeHtml(state.originalFile.name)}</strong>
          </div>
          <nav class="cutout-toolbar" aria-label="Cutout editor tools">
            ${['cutout', 'background', 'effects', 'adjust', 'design', 'crop', 'layers', 'compare'].map(panel => `<button type="button" class="cutout-tab ${panel === 'cutout' ? 'active' : ''}" data-panel="${panel}">${panel.replace('compare', 'before/after').toUpperCase()}</button>`).join('')}
            <button type="button" class="cutout-tab" data-action="undo">UNDO</button>
            <button type="button" class="cutout-tab" data-action="redo">REDO</button>
            <button type="button" class="cutout-tab" data-action="reset">RESET</button>
            <button type="button" class="cutout-download" data-action="download">DOWNLOAD</button>
          </nav>
        </header>
        <div class="cutout-body">
          <main class="cutout-canvas-pane">
            <div class="cutout-canvas-head">
              <div class="cutout-quick-actions">
                ${['Transparent PNG', 'White Background', 'Product White', 'Blur Background', 'Profile Photo', 'Sticker', 'YouTube Thumbnail', 'Social Post'].map(label => `<button type="button" data-quick="${label}">${label}</button>`).join('')}
              </div>
              <div class="cutout-zoom">
                <button type="button" data-zoom="out">-</button>
                <button type="button" data-zoom="fit">Fit</button>
                <button type="button" data-zoom="100">100%</button>
                <button type="button" data-zoom="in">+</button>
              </div>
            </div>
            <div class="cutout-stage-wrap">
              <canvas id="cutout-stage" aria-label="Editable cutout canvas"></canvas>
              <div id="cutout-crop-box" class="cutout-crop-box hidden" data-crop-handle="move">
                ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => `<span data-crop-handle="${handle}"></span>`).join('')}
              </div>
              <button type="button" id="cutout-hold-original">Hold original</button>
            </div>
            <div class="cutout-image-tray">
              <button type="button" data-action="add-image">Add image</button>
              <button type="button" data-action="duplicate-image">Duplicate image</button>
              <button type="button" data-action="delete-image">Delete image</button>
              <span>Single-image editor active. Batch processing is intentionally deferred.</span>
            </div>
          </main>
          <aside class="cutout-panel" id="cutout-panel"></aside>
        </div>
      </section>
    `;
  }

  function bind(state, root) {
    state.root = root;
    state.canvas = root.querySelector('#cutout-stage');
    state.ctx = state.canvas.getContext('2d');
    state.panel = root.querySelector('#cutout-panel');
    state.cropBox = root.querySelector('#cutout-crop-box');

    root.addEventListener('click', event => {
      const panel = event.target.closest('[data-panel]')?.dataset.panel;
      if (panel) {
        state.activePanel = panel;
        root.querySelectorAll('[data-panel]').forEach(btn => btn.classList.toggle('active', btn.dataset.panel === panel));
        renderPanel(state);
        render(state);
        return;
      }
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action) {
        handleAction(state, action).catch(error => {
          console.error('Advanced Cutout Studio action failed', error);
          window.showToast?.(error.message || 'Cutout action failed.', 'error');
        });
        return;
      }
      const zoom = event.target.closest('[data-zoom]')?.dataset.zoom;
      if (zoom) setZoom(state, zoom);
      const quick = event.target.closest('[data-quick]')?.dataset.quick;
      if (quick) applyQuickAction(state, quick);
      if (event.target.closest('[data-tool],[data-bg-mode],[data-bg-color],[data-effect],[data-add-shape],[data-add-text],[data-crop-ratio],[data-canvas-preset],[data-compare],[data-select-layer],[data-layer-action],[data-mask-op]')) {
        handleInput(state, event);
      }
    });

    root.addEventListener('input', event => handleInput(state, event));
    root.addEventListener('change', event => handleInput(state, event, true));
    state.canvas.addEventListener('pointerdown', event => canvasPointerDown(state, event));
    state.canvas.addEventListener('pointermove', event => canvasPointerMove(state, event));
    state.canvas.addEventListener('pointerup', () => canvasPointerUp(state));
    state.canvas.addEventListener('pointercancel', () => canvasPointerUp(state));
    state.cropBox.addEventListener('pointerdown', event => cropBoxPointerDown(state, event));
    state.cropBox.addEventListener('pointermove', event => cropBoxPointerMove(state, event));
    state.cropBox.addEventListener('pointerup', () => canvasPointerUp(state));
    state.cropBox.addEventListener('pointercancel', () => canvasPointerUp(state));
    state.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      state.zoom = Math.max(0.15, Math.min(4, state.zoom + (event.deltaY < 0 ? 0.1 : -0.1)));
      render(state);
    }, { passive: false });
    root.querySelector('#cutout-hold-original').addEventListener('pointerdown', () => {
      state.compareMode = 'original';
      render(state);
    });
    root.querySelector('#cutout-hold-original').addEventListener('pointerup', () => {
      state.compareMode = '';
      render(state);
    });
    document.addEventListener('keydown', state.keyHandler = event => handleShortcut(state, event));
    renderPanel(state);
  }

  function handleShortcut(state, event) {
    if (!studio || event.target.matches('input, textarea, select')) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      event.shiftKey ? redo(state) : undo(state);
    } else if (key === 'e') state.activeTool = 'erase';
    else if (key === 'r') state.activeTool = 'restore';
    else if (key === 'v') state.activeTool = 'move';
    else if (key === 'c') { state.activePanel = 'crop'; state.activeTool = 'crop'; renderPanel(state); }
    else if (key === 't') { state.activePanel = 'design'; addText(state); renderPanel(state); }
    else if (event.key === '[') adjustBrush(state, -4);
    else if (event.key === ']') adjustBrush(state, 4);
    else if (event.key === 'Delete') deleteSelectedLayer(state);
    else if (event.key === '+' || event.key === '=') setZoom(state, 'in');
    else if (event.key === '-') setZoom(state, 'out');
    render(state);
  }

  function renderPanel(state) {
    const map = {
      cutout: panelCutout,
      background: panelBackground,
      effects: panelEffects,
      adjust: panelAdjust,
      design: panelDesign,
      crop: panelCrop,
      layers: panelLayers,
      compare: panelCompare
    };
    state.panel.innerHTML = (map[state.activePanel] || panelCutout)(state);
  }

  function panelCutout(state) {
    return `
      <h3>Cutout</h3>
      <div class="cutout-grid two">
        <button type="button" data-action="rerun-auto">${state.autoBusy ? 'Running auto…' : 'Re-run Auto'}</button>
        <button type="button" data-action="reset-auto-mask">Reset Auto Mask</button>
        <button type="button" data-action="invert-mask">Invert Mask</button>
        <button type="button" data-action="keep-foreground">Keep Foreground</button>
        <button type="button" data-action="remove-background">Remove Background</button>
      </div>
      <div class="cutout-grid two">
        ${toolButton('move', 'Move', state)}
        ${toolButton('erase', 'Erase', state)}
        ${toolButton('restore', 'Restore', state)}
        ${toolButton('smart-erase', 'Smart erase', state)}
        ${toolButton('smart-restore', 'Smart restore', state)}
        ${toolButton('object-remove', 'Object remove', state)}
      </div>
      ${range('brushSize', 'Brush size', state.brushSize || 42, 2, 260, 1)}
      ${range('brushHardness', 'Hardness', state.brushHardness ?? 75, 0, 100, 1)}
      ${range('brushFeather', 'Feather', state.brushFeather ?? 18, 0, 100, 1)}
      ${range('brushOpacity', 'Opacity', state.brushOpacity ?? 100, 1, 100, 1)}
      <label>Mask view<select data-state="maskView">${['normal', 'red overlay', 'black/white mask', 'transparency', 'original'].map(value => `<option value="${value}" ${state.maskView === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <div class="cutout-grid two">
        <button type="button" data-mask-op="smooth">Smooth</button>
        <button type="button" data-mask-op="expand">Expand</button>
        <button type="button" data-mask-op="contract">Contract</button>
        <button type="button" data-mask-op="defringe">Defringe</button>
      </div>
      <p class="cutout-note">Smart tools use connected brush regions from the editable mask. Instance detection is not claimed in this build.</p>
    `;
  }

  function panelBackground(state) {
    return `
      <h3>Background</h3>
      <div class="cutout-grid tabs">
        ${['transparent', 'color', 'gradient', 'blur', 'custom'].map(value => `<button type="button" class="${state.background.mode === value ? 'active' : ''}" data-bg-mode="${value}">${value}</button>`).join('')}
      </div>
      <div class="color-row">
        ${['#ffffff', '#000000', '#6b7280', '#ef4444', '#2563eb', '#22c55e', '#eab308', '#7c3aed', '#f97316'].map(color => `<button type="button" data-bg-color="${color}" style="background:${color}"></button>`).join('')}
      </div>
      <label>Custom color<input type="color" data-path="background.color" value="${state.background.color}"></label>
      <label>Gradient A<input type="color" data-path="background.gradientA" value="${state.background.gradientA}"></label>
      <label>Gradient B<input type="color" data-path="background.gradientB" value="${state.background.gradientB}"></label>
      ${rangePath('background.gradientAngle', 'Gradient angle', state.background.gradientAngle, 0, 360, 1)}
      ${rangePath('background.blur', 'Background blur', state.background.blur, 0, 60, 1)}
      ${rangePath('background.darken', 'Background darkness', state.background.darken, 0, 80, 1)}
      <label>Upload background<input type="file" data-bg-upload accept="image/jpeg,image/png,image/webp"></label>
    `;
  }

  function panelEffects(state) {
    return `
      <h3>Effects</h3>
      <div class="effect-grid">
        ${Object.keys(EFFECTS).map(name => `<button type="button" data-effect="${name}" class="${state.effect === name ? 'active' : ''}"><canvas width="72" height="48"></canvas><span>${name}</span></button>`).join('')}
      </div>
      <p class="cutout-note">Thumbnails are generated from the current image, not static samples.</p>
    `;
  }

  function panelAdjust(state) {
    return `
      <h3>Adjust</h3>
      <label>Target<select data-state="adjustTarget"><option value="subject">Subject</option><option value="all" ${state.adjustTarget === 'all' ? 'selected' : ''}>All</option></select></label>
      ${rangePath(`${state.adjustTarget === 'all' ? 'all' : 'subject'}.brightness`, 'Brightness', (state.adjustTarget === 'all' ? state.all : state.subject).brightness, 0, 200, 1)}
      ${rangePath(`${state.adjustTarget === 'all' ? 'all' : 'subject'}.contrast`, 'Contrast', (state.adjustTarget === 'all' ? state.all : state.subject).contrast, 0, 200, 1)}
      ${rangePath(`${state.adjustTarget === 'all' ? 'all' : 'subject'}.saturation`, 'Saturation', (state.adjustTarget === 'all' ? state.all : state.subject).saturation, 0, 200, 1)}
      ${rangePath('all.temperature', 'Temperature', state.all.temperature, -100, 100, 1)}
      ${rangePath('all.tint', 'Tint', state.all.tint, -100, 100, 1)}
      ${rangePath('subject.blur', 'Subject blur', state.subject.blur, 0, 24, 0.5)}
      <button type="button" data-action="reset-adjust">Reset current</button>
    `;
  }

  function panelDesign(state) {
    return `
      <h3>Design</h3>
      <div class="cutout-grid two">
        <button type="button" data-add-text>Add text</button>
        <button type="button" data-add-shape="rectangle">Rectangle</button>
        <button type="button" data-add-shape="rounded">Rounded</button>
        <button type="button" data-add-shape="circle">Circle</button>
        <button type="button" data-add-shape="line">Line</button>
        <button type="button" data-add-shape="arrow">Arrow</button>
      </div>
      <h4>Subject</h4>
      ${rangePath('subject.scale', 'Scale', state.subject.scale, 0.05, 3, 0.01)}
      ${rangePath('subject.x', 'Position X', state.subject.x, -state.canvasWidth, state.canvasWidth, 1)}
      ${rangePath('subject.y', 'Position Y', state.subject.y, -state.canvasHeight, state.canvasHeight, 1)}
      ${rangePath('subject.rotate', 'Rotate', state.subject.rotate, -180, 180, 1)}
      <div class="cutout-grid two"><button type="button" data-action="flip-x">Flip H</button><button type="button" data-action="flip-y">Flip V</button><button type="button" data-action="center-subject">Center</button><button type="button" data-action="fit-subject">Fit</button></div>
      <h4>Shadow / outline / glow</h4>
      ${checkboxPath('subject.shadow', 'Drop shadow', state.subject.shadow)}
      ${rangePath('subject.shadowOpacity', 'Shadow opacity', state.subject.shadowOpacity, 0, 100, 1)}
      ${rangePath('subject.shadowBlur', 'Shadow blur', state.subject.shadowBlur, 0, 80, 1)}
      ${checkboxPath('subject.groundShadow', 'Ground shadow', state.subject.groundShadow)}
      ${checkboxPath('subject.outline', 'Outline / sticker', state.subject.outline)}
      ${rangePath('subject.outlineWidth', 'Outline width', state.subject.outlineWidth, 0, 60, 1)}
      <label>Outline color<input type="color" data-path="subject.outlineColor" value="${state.subject.outlineColor}"></label>
      ${checkboxPath('subject.glow', 'Outer glow', state.subject.glow)}
      <label>Glow color<input type="color" data-path="subject.glowColor" value="${state.subject.glowColor}"></label>
    `;
  }

  function panelCrop(state) {
    return `
      <h3>Crop and canvas</h3>
      <div class="cutout-grid two">
        ${['free', 'original', '1:1', '4:5', '3:4', '16:9', '9:16', '3:2', '2:3'].map(ratio => `<button type="button" data-crop-ratio="${ratio}">${ratio}</button>`).join('')}
      </div>
      <div class="cutout-grid two">
        ${Object.keys(SOCIAL_PRESETS).map(name => `<button type="button" data-canvas-preset="${name}">${name}</button>`).join('')}
      </div>
      ${rangePath('canvasWidth', 'Canvas width', state.canvasWidth, 64, 6000, 1)}
      ${rangePath('canvasHeight', 'Canvas height', state.canvasHeight, 64, 6000, 1)}
      <button type="button" data-action="apply-crop">Apply crop</button>
      <button type="button" data-action="reset-crop">Reset crop</button>
    `;
  }

  function panelLayers(state) {
    const rows = [
      { id: 'background', name: 'Background', visible: true, locked: false },
      { id: 'subject', name: 'Subject mask', visible: true, locked: false },
      ...state.layers.map((layer, index) => ({ ...layer, index }))
    ];
    return `
      <h3>Layers</h3>
      <div class="layer-list">
        ${rows.map(layer => `<button type="button" class="${state.selectedLayer === layer.id ? 'active' : ''}" data-select-layer="${layer.id}">
          <span>${escapeHtml(layer.name || layer.id)}</span>
          <small>${layer.visible === false ? 'hidden' : 'visible'}${layer.locked ? ' / locked' : ''}</small>
        </button>`).join('')}
      </div>
      <div class="cutout-grid two"><button type="button" data-layer-action="duplicate">Duplicate</button><button type="button" data-layer-action="delete">Delete</button><button type="button" data-layer-action="up">Move up</button><button type="button" data-layer-action="down">Move down</button><button type="button" data-layer-action="toggle-visible">Visibility</button><button type="button" data-layer-action="toggle-lock">Lock</button></div>
      <h4>Export</h4>
      <label>Format<select data-state="export.format"><option value="png">PNG</option><option value="jpg" ${state.export.format === 'jpg' ? 'selected' : ''}>JPG</option><option value="webp" ${state.export.format === 'webp' ? 'selected' : ''}>WEBP</option></select></label>
      ${checkboxPath('export.transparency', 'Keep transparency', state.export.transparency)}
      ${rangePath('export.scale', 'Output scale', state.export.scale, 0.25, 1, 0.25)}
      ${rangePath('export.quality', 'Quality', state.export.quality, 10, 100, 1)}
    `;
  }

  function panelCompare() {
    return `
      <h3>Before / after</h3>
      <div class="cutout-grid two">
        <button type="button" data-compare="original">Original</button>
        <button type="button" data-compare="cutout">Cutout</button>
        <button type="button" data-compare="final">Final</button>
        <button type="button" data-compare="mask">Mask</button>
        <button type="button" data-compare="side">Side by side</button>
        <button type="button" data-compare="slider">Slider</button>
      </div>
      <p class="cutout-note">Hold the button on the canvas to temporarily show the original.</p>
    `;
  }

  function toolButton(tool, label, state) {
    return `<button type="button" data-tool="${tool}" class="${state.activeTool === tool ? 'active' : ''}">${label}</button>`;
  }

  function range(key, label, value, min, max, step) {
    return `<label>${label}<input type="range" data-state="${key}" value="${value}" min="${min}" max="${max}" step="${step}"><output>${value}</output></label>`;
  }

  function rangePath(path, label, value, min, max, step) {
    return `<label>${label}<input type="range" data-path="${path}" value="${value}" min="${min}" max="${max}" step="${step}"><output>${value}</output></label>`;
  }

  function checkboxPath(path, label, checked) {
    return `<label class="cutout-check"><input type="checkbox" data-path="${path}" ${checked ? 'checked' : ''}>${label}</label>`;
  }

  function handleInput(state, event) {
    const tool = event.target.closest('[data-tool]')?.dataset.tool;
    if (tool) state.activeTool = tool;
    const stateKey = event.target.dataset.state;
    if (stateKey) setStateValue(state, stateKey, event.target.type === 'checkbox' ? event.target.checked : event.target.value);
    const path = event.target.dataset.path;
    if (path) setPath(state, path, event.target.type === 'checkbox' ? event.target.checked : numberOrString(event.target.value));
    const bgMode = event.target.closest('[data-bg-mode]')?.dataset.bgMode;
    if (bgMode) state.background.mode = bgMode;
    const bgColor = event.target.closest('[data-bg-color]')?.dataset.bgColor;
    if (bgColor) {
      state.background.mode = 'color';
      state.background.color = bgColor;
      state.recentColors = [bgColor, ...state.recentColors.filter(color => color !== bgColor)].slice(0, 8);
    }
    const effect = event.target.closest('[data-effect]')?.dataset.effect;
    if (effect) applyEffect(state, effect);
    const addShape = event.target.closest('[data-add-shape]')?.dataset.addShape;
    if (addShape) addShapeLayer(state, addShape);
    if (event.target.closest('[data-add-text]')) addText(state);
    const ratio = event.target.closest('[data-crop-ratio]')?.dataset.cropRatio;
    if (ratio) setCropRatio(state, ratio);
    const preset = event.target.closest('[data-canvas-preset]')?.dataset.canvasPreset;
    if (preset) setCanvasPreset(state, preset);
    const compare = event.target.closest('[data-compare]')?.dataset.compare;
    if (compare) state.compareMode = compare;
    const layer = event.target.closest('[data-select-layer]')?.dataset.selectLayer;
    if (layer) state.selectedLayer = layer;
    const layerAction = event.target.closest('[data-layer-action]')?.dataset.layerAction;
    if (layerAction) handleLayerAction(state, layerAction);
    const maskOp = event.target.closest('[data-mask-op]')?.dataset.maskOp;
    if (maskOp) applyMaskOp(state, maskOp);
    if (event.target.matches('[data-bg-upload]') && event.target.files?.[0]) loadBackgroundImage(state, event.target.files[0]);
    pushHistory(state);
    renderPanel(state);
    render(state);
  }

  function setStateValue(state, key, value) {
    if (key.includes('.')) setPath(state, key, numberOrString(value));
    else state[key] = numberOrString(value);
  }

  function setPath(state, path, value) {
    const parts = path.split('.');
    let target = state;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = value;
  }

  function numberOrString(value) {
    return value === '' || Number.isNaN(Number(value)) ? value : Number(value);
  }

  async function handleAction(state, action) {
    if (action === 'undo') undo(state);
    else if (action === 'redo') redo(state);
    else if (action === 'reset') reset(state);
    else if (action === 'download') download(state);
    else if (action === 'rerun-auto') await rerunAutoMask(state);
    else if (action === 'reset-auto-mask') resetAutoMask(state);
    else if (action === 'invert-mask') invertMask(state);
    else if (action === 'keep-foreground') state.activeTool = 'restore';
    else if (action === 'remove-background') state.activeTool = 'erase';
    else if (action === 'reset-adjust') {
      Object.assign(state.subject, clone(DEFAULTS.subject));
      Object.assign(state.all, clone(DEFAULTS.all));
    } else if (action === 'flip-x') state.subject.flipX = !state.subject.flipX;
    else if (action === 'flip-y') state.subject.flipY = !state.subject.flipY;
    else if (action === 'center-subject') { state.subject.x = 0; state.subject.y = 0; }
    else if (action === 'fit-subject') state.subject.scale = 1;
    else if (action === 'reset-crop') state.crop = null;
    else if (action === 'apply-crop' && state.crop) {
      state.canvasWidth = state.crop.w;
      state.canvasHeight = state.crop.h;
      state.subject.x -= state.crop.x;
      state.subject.y -= state.crop.y;
      state.crop = null;
    }
    pushHistory(state);
    renderPanel(state);
    render(state);
  }

  function resetAutoMask(state) {
    state.maskCanvas = cloneCanvas(state.originalMaskCanvas);
    state.activeTool = 'move';
  }

  function invertMask(state) {
    const ctx = state.maskCanvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, state.maskCanvas.width, state.maskCanvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const alpha = 255 - image.data[i];
      image.data[i] = alpha;
      image.data[i + 1] = alpha;
      image.data[i + 2] = alpha;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  async function rerunAutoMask(state) {
    if (!window.GxaBackgroundSegmentation?.segment) {
      throw new Error('The local auto segmentation engine is unavailable.');
    }
    if (state.autoBusy) return;
    state.autoBusy = true;
    renderPanel(state);
    try {
      const segmentation = await window.GxaBackgroundSegmentation.segment(state.originalFile, { forceProvider: '' });
      state.originalMaskCanvas = cloneCanvas(segmentation.maskCanvas);
      state.maskCanvas = cloneCanvas(segmentation.maskCanvas);
      state.segmentationStats = segmentation.stats;
      state.segmentationProvider = segmentation.provider;
      if (segmentation.cutoutUrl) {
        if (state.cutoutUrl?.startsWith('blob:')) URL.revokeObjectURL(state.cutoutUrl);
        state.cutoutUrl = segmentation.cutoutUrl;
        state.cutoutImage = await loadImage(segmentation.cutoutUrl);
      }
    } finally {
      state.autoBusy = false;
    }
  }

  function applyQuickAction(state, label) {
    if (label.includes('Transparent')) {
      state.background.mode = 'transparent';
      state.export.format = 'png';
      state.export.transparency = true;
    } else if (label.includes('White') || label.includes('Product')) {
      state.background.mode = 'color';
      state.background.color = '#ffffff';
      state.export.transparency = false;
    } else if (label.includes('Blur')) {
      state.background.mode = 'blur';
      state.export.transparency = false;
    } else if (label.includes('Sticker')) {
      state.background.mode = 'transparent';
      state.subject.outline = true;
      state.subject.outlineColor = '#ffffff';
      state.subject.outlineWidth = 18;
    } else if (label.includes('YouTube')) {
      setCanvasPreset(state, 'youtube');
      state.background.mode = 'gradient';
      state.subject.shadow = true;
    } else if (label.includes('Social')) {
      setCanvasPreset(state, 'portrait');
      state.background.mode = 'gradient';
    } else if (label.includes('Profile')) {
      setCanvasPreset(state, 'square');
      state.background.mode = 'blur';
      state.crop = null;
    }
    pushHistory(state);
    renderPanel(state);
    render(state);
  }

  function setZoom(state, value) {
    if (value === 'in') state.zoom = Math.min(4, state.zoom + 0.15);
    else if (value === 'out') state.zoom = Math.max(0.15, state.zoom - 0.15);
    else if (value === 'fit') state.zoom = 1;
    else state.zoom = Number(value) / 100;
    render(state);
  }

  function adjustBrush(state, delta) {
    state.brushSize = Math.max(2, Math.min(260, (state.brushSize || 42) + delta));
    renderPanel(state);
  }

  function setCanvasPreset(state, preset) {
    const dims = SOCIAL_PRESETS[preset];
    if (!dims) return;
    state.canvasWidth = dims[0];
    state.canvasHeight = dims[1];
  }

  function setCropRatio(state, ratio) {
    let w = state.canvasWidth * 0.78;
    let h = state.canvasHeight * 0.78;
    if (ratio === 'original') {
      w = state.canvasWidth;
      h = state.canvasHeight;
    } else if (ratio !== 'free' && ratio.includes(':')) {
      const [rw, rh] = ratio.split(':').map(Number);
      if (rw && rh) {
        h = Math.min(h, w * rh / rw);
        w = h * rw / rh;
      }
    }
    state.crop = { x: (state.canvasWidth - w) / 2, y: (state.canvasHeight - h) / 2, w, h };
    state.activeTool = 'crop';
  }

  function applyEffect(state, name) {
    state.effect = name;
    Object.assign(state.subject, { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, invert: 0 }, EFFECTS[name]);
    if (EFFECTS[name].temperature != null) state.all.temperature = EFFECTS[name].temperature;
    if (EFFECTS[name].tint != null) state.all.tint = EFFECTS[name].tint;
  }

  async function loadBackgroundImage(state, file) {
    if (state.background.imageUrl) URL.revokeObjectURL(state.background.imageUrl);
    state.background.imageUrl = fileToUrl(file);
    state.background.image = await loadImage(state.background.imageUrl);
    state.background.mode = 'custom';
    pushHistory(state);
    renderPanel(state);
    render(state);
  }

  function addText(state) {
    const id = `text-${Date.now()}`;
    state.layers.push({ id, type: 'text', name: 'Text', text: 'GXA Toolbox', x: state.canvasWidth / 2, y: state.canvasHeight / 2, size: Math.max(42, state.canvasWidth * 0.06), color: '#111827', weight: 800, visible: true, locked: false, opacity: 1 });
    state.selectedLayer = id;
  }

  function addShapeLayer(state, shape) {
    const id = `shape-${Date.now()}`;
    state.layers.push({ id, type: 'shape', shape, name: shape, x: state.canvasWidth / 2, y: state.canvasHeight / 2, w: 260, h: 140, fill: '#2563eb', strokeWidth: 0, visible: true, locked: false, opacity: 0.9 });
    state.selectedLayer = id;
  }

  function selectedEditableLayer(state) {
    return state.layers.find(layer => layer.id === state.selectedLayer);
  }

  function handleLayerAction(state, action) {
    const layer = selectedEditableLayer(state);
    if (!layer) return;
    const index = state.layers.indexOf(layer);
    if (action === 'delete') state.layers.splice(index, 1);
    if (action === 'duplicate') {
      const duplicate = clone(layer);
      duplicate.id = `${layer.id}-copy-${Date.now()}`;
      duplicate.name = `${layer.name} copy`;
      duplicate.x += 24;
      duplicate.y += 24;
      state.layers.splice(index + 1, 0, duplicate);
      state.selectedLayer = duplicate.id;
    }
    if (action === 'up' && index < state.layers.length - 1) {
      [state.layers[index], state.layers[index + 1]] = [state.layers[index + 1], state.layers[index]];
    }
    if (action === 'down' && index > 0) {
      [state.layers[index], state.layers[index - 1]] = [state.layers[index - 1], state.layers[index]];
    }
    if (action === 'toggle-visible') layer.visible = !layer.visible;
    if (action === 'toggle-lock') layer.locked = !layer.locked;
  }

  function deleteSelectedLayer(state) {
    const layer = selectedEditableLayer(state);
    if (!layer) return;
    state.layers = state.layers.filter(item => item !== layer);
    state.selectedLayer = 'subject';
    pushHistory(state);
    renderPanel(state);
    render(state);
  }

  function canvasPoint(state, event) {
    const rect = state.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * state.canvas.width / rect.width / state.zoom,
      y: (event.clientY - rect.top) * state.canvas.height / rect.height / state.zoom
    };
  }

  function canvasPointerDown(state, event) {
    state.canvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(state, event);
    state.pointer = { start: point, last: point, kind: state.activeTool };
    if (['erase', 'restore', 'smart-erase', 'smart-restore', 'object-remove'].includes(state.activeTool)) {
      paintMask(state, point, state.activeTool.includes('restore') ? 255 : 0);
    }
  }

  function canvasPointerMove(state, event) {
    if (!state.pointer) return;
    const point = canvasPoint(state, event);
    const dx = point.x - state.pointer.last.x;
    const dy = point.y - state.pointer.last.y;
    if (['erase', 'restore', 'smart-erase', 'smart-restore', 'object-remove'].includes(state.pointer.kind)) {
      paintMask(state, point, state.pointer.kind.includes('restore') ? 255 : 0);
    } else if (state.pointer.kind === 'crop') {
      const start = state.pointer.start;
      state.crop = { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), w: Math.abs(point.x - start.x), h: Math.abs(point.y - start.y) };
    } else {
      const layer = selectedEditableLayer(state);
      if (layer && !layer.locked) {
        layer.x += dx;
        layer.y += dy;
      } else {
        state.subject.x += dx;
        state.subject.y += dy;
      }
    }
    state.pointer.last = point;
    render(state);
  }

  function cropBoxPointerDown(state, event) {
    if (!state.crop) return;
    event.preventDefault();
    event.stopPropagation();
    state.cropBox.setPointerCapture(event.pointerId);
    const point = canvasPoint(state, event);
    state.pointer = {
      start: point,
      last: point,
      kind: 'crop-box',
      handle: event.target.closest('[data-crop-handle]')?.dataset.cropHandle || 'move',
      cropStart: clone(state.crop)
    };
  }

  function cropBoxPointerMove(state, event) {
    if (!state.pointer || state.pointer.kind !== 'crop-box') return;
    event.preventDefault();
    event.stopPropagation();
    const point = canvasPoint(state, event);
    const start = state.pointer.start;
    const base = state.pointer.cropStart;
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    const minSize = Math.max(16, Math.min(state.canvasWidth, state.canvasHeight) * 0.02);
    let { x, y, w, h } = base;
    const handle = state.pointer.handle;

    if (handle === 'move') {
      x = base.x + dx;
      y = base.y + dy;
    } else {
      if (handle.includes('w')) {
        x = base.x + dx;
        w = base.w - dx;
      }
      if (handle.includes('e')) w = base.w + dx;
      if (handle.includes('n')) {
        y = base.y + dy;
        h = base.h - dy;
      }
      if (handle.includes('s')) h = base.h + dy;
    }

    if (w < minSize) {
      if (handle.includes('w')) x -= minSize - w;
      w = minSize;
    }
    if (h < minSize) {
      if (handle.includes('n')) y -= minSize - h;
      h = minSize;
    }

    if (handle === 'move') {
      x = Math.max(0, Math.min(state.canvasWidth - w, x));
      y = Math.max(0, Math.min(state.canvasHeight - h, y));
    } else {
      x = Math.max(0, Math.min(state.canvasWidth - minSize, x));
      y = Math.max(0, Math.min(state.canvasHeight - minSize, y));
      w = Math.max(minSize, Math.min(state.canvasWidth - x, w));
      h = Math.max(minSize, Math.min(state.canvasHeight - y, h));
    }

    state.crop = { x, y, w, h };
    render(state);
  }

  function canvasPointerUp(state) {
    if (!state.pointer) return;
    state.pointer = null;
    pushHistory(state);
    renderPanel(state);
    render(state);
  }

  function paintMask(state, point, alpha) {
    const ctx = state.maskCanvas.getContext('2d');
    const scaleX = state.maskCanvas.width / state.canvasWidth;
    const scaleY = state.maskCanvas.height / state.canvasHeight;
    const size = (state.brushSize || 42) * Math.max(scaleX, scaleY);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const grad = ctx.createRadialGradient(point.x * scaleX, point.y * scaleY, Math.max(1, size * (state.brushHardness || 75) / 220), point.x * scaleX, point.y * scaleY, size / 2);
    grad.addColorStop(0, `rgba(${alpha},${alpha},${alpha},${(state.brushOpacity || 100) / 100})`);
    grad.addColorStop(1, `rgba(${alpha},${alpha},${alpha},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(point.x * scaleX, point.y * scaleY, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function applyMaskOp(state, op) {
    const src = state.maskCanvas;
    const next = canvas(src.width, src.height);
    const nctx = next.getContext('2d');
    if (op === 'smooth' || op === 'defringe') {
      nctx.filter = op === 'smooth' ? 'blur(1.2px)' : 'blur(0.7px) contrast(125%)';
      nctx.drawImage(src, 0, 0);
    } else {
      const radius = op === 'expand' ? 2 : -2;
      nctx.drawImage(src, 0, 0);
      const pixels = nctx.getImageData(0, 0, src.width, src.height);
      const copy = new Uint8ClampedArray(pixels.data);
      for (let y = 1; y < src.height - 1; y += 1) {
        for (let x = 1; x < src.width - 1; x += 1) {
          const i = (y * src.width + x) * 4;
          let value = copy[i];
          for (let yy = -1; yy <= 1; yy += 1) {
            for (let xx = -1; xx <= 1; xx += 1) {
              const ni = ((y + yy) * src.width + x + xx) * 4;
              value = radius > 0 ? Math.max(value, copy[ni]) : Math.min(value, copy[ni]);
            }
          }
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
        }
      }
      nctx.putImageData(pixels, 0, 0);
    }
    state.maskCanvas = next;
  }

  function render(state) {
    const preview = composite(state, { checker: state.background.mode === 'transparent' || state.maskView === 'transparency', crop: false });
    const displayW = Math.min(1100, state.canvasWidth);
    const displayH = displayW * state.canvasHeight / state.canvasWidth;
    state.canvas.width = Math.round(displayW * state.zoom);
    state.canvas.height = Math.round(displayH * state.zoom);
    state.canvas.style.aspectRatio = `${state.canvas.width} / ${state.canvas.height}`;
    const ctx = state.ctx;
    ctx.save();
    ctx.scale(state.zoom, state.zoom);
    if (state.compareMode === 'original' || state.maskView === 'original') {
      ctx.drawImage(state.originalImage, 0, 0, displayW, displayH);
    } else if (state.compareMode === 'mask' || state.maskView === 'black/white mask') {
      ctx.drawImage(state.maskCanvas, 0, 0, displayW, displayH);
    } else if (state.maskView === 'red overlay') {
      ctx.drawImage(state.originalImage, 0, 0, displayW, displayH);
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = '#ef4444';
      ctx.drawImage(state.maskCanvas, 0, 0, displayW, displayH);
    } else if (state.compareMode === 'side') {
      ctx.drawImage(state.originalImage, 0, 0, displayW / 2, displayH);
      ctx.drawImage(preview, displayW / 2, 0, displayW / 2, displayH);
    } else {
      ctx.drawImage(preview, 0, 0, displayW, displayH);
    }
    ctx.restore();
    updateCropBox(state, displayW, displayH);
    renderEffectThumbs(state);
    renderInfo(state);
  }

  function updateCropBox(state, displayW, displayH) {
    if (!state.crop) {
      state.cropBox.classList.add('hidden');
      return;
    }
    const sx = displayW / state.canvasWidth * state.zoom;
    const sy = displayH / state.canvasHeight * state.zoom;
    Object.assign(state.cropBox.style, {
      left: `${state.crop.x * sx}px`,
      top: `${state.crop.y * sy}px`,
      width: `${Math.max(20, state.crop.w * sx)}px`,
      height: `${Math.max(20, state.crop.h * sy)}px`
    });
    state.cropBox.classList.remove('hidden');
  }

  function renderInfo(state) {
    let info = state.root.querySelector('.cutout-info');
    if (!info) {
      info = document.createElement('div');
      info.className = 'cutout-info';
      state.root.querySelector('.cutout-canvas-pane').appendChild(info);
    }
    const alpha = alphaCoverage(state.maskCanvas);
    const est = Math.round(state.canvasWidth * state.canvasHeight * 0.000012);
    info.innerHTML = `
      <span>Original ${state.originalImage.naturalWidth} x ${state.originalImage.naturalHeight}</span>
      <span>Canvas ${Math.round(state.canvasWidth)} x ${Math.round(state.canvasHeight)}</span>
      <span>${escapeHtml(state.originalFile.type || 'image')}</span>
      <span>Alpha ${alpha}%</span>
      <span>Estimated ${est} MB</span>
      <span>Background ${state.background.mode}</span>
    `;
  }

  function alphaCoverage(mask) {
    const ctx = mask.getContext('2d');
    const data = ctx.getImageData(0, 0, mask.width, mask.height).data;
    let kept = 0;
    for (let i = 0; i < data.length; i += 16) if (data[i] > 8) kept += 1;
    return Math.round(kept / (data.length / 16) * 100);
  }

  function renderEffectThumbs(state) {
    if (state.activePanel !== 'effects') return;
    state.panel.querySelectorAll('[data-effect] canvas').forEach(thumb => {
      const name = thumb.parentElement.dataset.effect;
      const ctx = thumb.getContext('2d');
      ctx.clearRect(0, 0, thumb.width, thumb.height);
      ctx.filter = filterFrom({ ...state.subject, ...EFFECTS[name] });
      ctx.drawImage(state.originalImage, 0, 0, thumb.width, thumb.height);
      ctx.filter = 'none';
    });
  }

  function snapshot(state) {
    return {
      background: clone(state.background),
      subject: clone(state.subject),
      all: clone(state.all),
      crop: clone(state.crop),
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      layers: clone(state.layers),
      selectedLayer: state.selectedLayer,
      mask: state.maskCanvas.toDataURL()
    };
  }

  function restoreSnapshot(state, shot) {
    Object.assign(state.background, shot.background);
    Object.assign(state.subject, shot.subject);
    Object.assign(state.all, shot.all);
    state.crop = shot.crop;
    state.canvasWidth = shot.canvasWidth;
    state.canvasHeight = shot.canvasHeight;
    state.layers = shot.layers;
    state.selectedLayer = shot.selectedLayer;
    loadImage(shot.mask).then(image => {
      state.maskCanvas = canvas(image.naturalWidth, image.naturalHeight);
      state.maskCanvas.getContext('2d').drawImage(image, 0, 0);
      renderPanel(state);
      render(state);
    });
  }

  function pushHistory(state, force) {
    const shot = snapshot(state);
    if (!force && state.history.length && state.history[state.history.length - 1].mask === shot.mask && JSON.stringify(state.history[state.history.length - 1]) === JSON.stringify(shot)) return;
    state.history.push(shot);
    if (state.history.length > 45) state.history.shift();
    state.future.length = 0;
  }

  function undo(state) {
    if (state.history.length <= 1) return;
    state.future.push(state.history.pop());
    restoreSnapshot(state, state.history[state.history.length - 1]);
  }

  function redo(state) {
    const shot = state.future.pop();
    if (!shot) return;
    state.history.push(shot);
    restoreSnapshot(state, shot);
  }

  function reset(state) {
    Object.assign(state.background, clone(DEFAULTS.background));
    Object.assign(state.subject, clone(DEFAULTS.subject));
    Object.assign(state.all, clone(DEFAULTS.all));
    state.layers = [];
    state.crop = null;
    state.maskCanvas = alphaMaskFromCutout(state.cutoutImage);
    pushHistory(state, true);
    renderPanel(state);
    render(state);
  }

  async function download(state) {
    const out = composite(state, { scale: Number(state.export.scale) || 1 });
    const format = state.export.format;
    const type = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    const blob = await new Promise((resolve, reject) => out.toBlob(value => value ? resolve(value) : reject(new Error('Export failed.')), type, (state.export.quality || 92) / 100));
    if ('createImageBitmap' in window) {
      const bitmap = await createImageBitmap(blob);
      bitmap.close();
    }
    const filename = state.originalFile.name.replace(/\.[^.]+$/, '') + `_gxa-cutout.${format === 'jpg' ? 'jpg' : format}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (typeof state.onExport === 'function') state.onExport(blob, filename);
  }

  window.GxaAdvancedCutoutStudio = { open, close, _composite: () => studio ? composite(studio) : null };
})();
