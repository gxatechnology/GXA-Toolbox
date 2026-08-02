(function () {
  'use strict';

  const HISTORY_LIMIT = 50;
  let session = null;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function bounds(object) {
    if (object.type === 'path') {
      const xs = object.points.map(point => point.x);
      const ys = object.points.map(point => point.y);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(.01, Math.max(...xs) - Math.min(...xs)), h: Math.max(.01, Math.max(...ys) - Math.min(...ys)) };
    }
    return { x: Math.min(object.x, object.x + object.w), y: Math.min(object.y, object.y + object.h), w: Math.abs(object.w), h: Math.abs(object.h) };
  }

  function drawArrowHead(context, x1, y1, x2, y2, size) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    context.beginPath();
    context.moveTo(x2, y2);
    context.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
    context.moveTo(x2, y2);
    context.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
    context.stroke();
  }

  function drawObject(context, object, width, height) {
    context.save();
    context.globalAlpha = clamp(Number(object.opacity ?? 1), 0, 1);
    context.strokeStyle = object.stroke || '#2563eb';
    context.fillStyle = object.fill || 'transparent';
    context.lineWidth = Math.max(1, Number(object.size || 4) * Math.max(width, height) / 1000);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (object.type === 'text') {
      const centerX = (object.x + object.w / 2) * width;
      const centerY = (object.y + object.h / 2) * height;
      context.translate(centerX, centerY);
      context.rotate((object.rotation || 0) * Math.PI / 180);
      const fontSize = Math.max(8, object.fontSize * height);
      context.font = `${object.weight || 400} ${fontSize}px sans-serif`;
      context.textAlign = object.align || 'center';
      context.textBaseline = 'middle';
      const anchor = object.align === 'left' ? -object.w * width / 2 : object.align === 'right' ? object.w * width / 2 : 0;
      context.fillStyle = object.stroke || '#111827';
      context.fillText(object.text, anchor, 0, Math.max(1, object.w * width));
    } else if (object.type === 'path') {
      if (object.points.length > 1) {
        context.beginPath();
        context.moveTo(object.points[0].x * width, object.points[0].y * height);
        object.points.slice(1).forEach(point => context.lineTo(point.x * width, point.y * height));
        context.stroke();
      }
    } else {
      const x = object.x * width;
      const y = object.y * height;
      const w = object.w * width;
      const h = object.h * height;
      if (object.type === 'rectangle') {
        if (object.fillEnabled) context.fillRect(x, y, w, h);
        context.strokeRect(x, y, w, h);
      } else if (object.type === 'ellipse') {
        context.beginPath();
        context.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        if (object.fillEnabled) context.fill();
        context.stroke();
      } else {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + w, y + h);
        context.stroke();
        if (object.type === 'arrow') drawArrowHead(context, x, y, x + w, y + h, Math.max(8, context.lineWidth * 3));
      }
    }
    context.restore();
  }

  function drawSelection(context, object, width, height) {
    const box = bounds(object);
    const x = box.x * width;
    const y = box.y * height;
    const w = box.w * width;
    const h = box.h * height;
    context.save();
    context.strokeStyle = '#0ea5e9';
    context.fillStyle = '#fff';
    context.lineWidth = 1.5;
    context.setLineDash([5, 4]);
    context.strokeRect(x, y, w, h);
    context.setLineDash([]);
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([handleX, handleY]) => {
      context.fillRect(handleX - 5, handleY - 5, 10, 10);
      context.strokeRect(handleX - 5, handleY - 5, 10, 10);
    });
    if (object.type === 'text') {
      context.beginPath();
      context.moveTo(x + w / 2, y);
      context.lineTo(x + w / 2, y - 24);
      context.stroke();
      context.beginPath();
      context.arc(x + w / 2, y - 28, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  function redraw() {
    if (!session?.canvas) return;
    const { canvas, context, objects, selected } = session;
    context.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach(object => drawObject(context, object, canvas.width, canvas.height));
    if (selected >= 0 && objects[selected]) drawSelection(context, objects[selected], canvas.width, canvas.height);
    const status = session.controls.querySelector('.annotation-selection-status');
    if (status) status.textContent = selected >= 0 ? `${objects[selected].type} selected` : `${objects.length} object${objects.length === 1 ? '' : 's'}`;
  }

  function checkpoint() {
    session.history.push(clone(session.objects));
    if (session.history.length > HISTORY_LIMIT) session.history.shift();
    session.future = [];
  }

  function setSelected(index) {
    session.selected = index;
    const object = session.objects[index];
    if (object?.type === 'text') {
      session.controls.querySelector('#studio-annotation-text').value = object.text;
      session.controls.querySelector('#studio-annotation-font-size').value = Math.round(object.fontSize * 1000);
      session.controls.querySelector('#studio-annotation-weight').value = object.weight;
      session.controls.querySelector('#studio-annotation-align').value = object.align;
      session.controls.querySelector('#studio-annotation-rotation').value = object.rotation || 0;
    }
    redraw();
  }

  function hitTest(point) {
    for (let index = session.objects.length - 1; index >= 0; index -= 1) {
      const box = bounds(session.objects[index]);
      const pad = .018;
      if (point.x >= box.x - pad && point.x <= box.x + box.w + pad && point.y >= box.y - pad && point.y <= box.y + box.h + pad) return index;
    }
    return -1;
  }

  function pointFromEvent(event) {
    const rect = session.canvas.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
  }

  function objectDefaults(type, start) {
    const controls = session.controls;
    return {
      type,
      x: start.x,
      y: start.y,
      w: 0,
      h: 0,
      stroke: controls.querySelector('#studio-annotation-stroke').value,
      fill: controls.querySelector('#studio-annotation-fill').value,
      fillEnabled: controls.querySelector('#studio-annotation-fill-enabled').checked,
      size: Number(controls.querySelector('#studio-annotation-size').value),
      opacity: Number(controls.querySelector('#studio-annotation-opacity').value) / 100
    };
  }

  function pointerDown(event) {
    if (!session?.image) return;
    const point = pointFromEvent(event);
    const tool = session.tool;
    session.canvas.setPointerCapture(event.pointerId);
    if (tool === 'select') {
      const selected = hitTest(point);
      setSelected(selected);
      if (selected >= 0) {
        checkpoint();
        const object = session.objects[selected];
        const box = bounds(object);
        const resize = Math.abs(point.x - (box.x + box.w)) < .035 && Math.abs(point.y - (box.y + box.h)) < .035;
        const rotate = object.type === 'text' && Math.abs(point.x - (box.x + box.w / 2)) < .04 && point.y < box.y && point.y > box.y - .1;
        session.action = { kind: rotate ? 'rotate' : resize ? 'resize' : 'move', start: point, original: clone(object), center: { x: box.x + box.w / 2, y: box.y + box.h / 2 } };
      }
      return;
    }
    if (tool === 'eraser') {
      const index = hitTest(point);
      if (index >= 0) {
        checkpoint();
        session.objects.splice(index, 1);
        setSelected(-1);
      }
      return;
    }
    checkpoint();
    if (['pen', 'brush', 'highlighter'].includes(tool)) {
      const object = objectDefaults('path', point);
      object.points = [point];
      if (tool === 'brush') object.size = Math.max(object.size, 8);
      if (tool === 'highlighter') {
        object.size = Math.max(object.size, 18);
        object.opacity = Math.min(object.opacity, .35);
      }
      session.objects.push(object);
      session.selected = session.objects.length - 1;
      session.action = { kind: 'draw', index: session.selected };
    } else if (['rectangle', 'ellipse', 'line', 'arrow'].includes(tool)) {
      session.objects.push(objectDefaults(tool, point));
      session.selected = session.objects.length - 1;
      session.action = { kind: 'shape', index: session.selected, start: point };
    }
    redraw();
  }

  function pointerMove(event) {
    if (!session?.action) return;
    const point = pointFromEvent(event);
    const action = session.action;
    const object = session.objects[action.index ?? session.selected];
    if (!object) return;
    if (action.kind === 'draw') object.points.push(point);
    if (action.kind === 'shape') {
      object.w = point.x - action.start.x;
      object.h = point.y - action.start.y;
    }
    if (action.kind === 'move') {
      const dx = point.x - action.start.x;
      const dy = point.y - action.start.y;
      if (object.type === 'path') object.points = action.original.points.map(item => ({ x: clamp(item.x + dx, 0, 1), y: clamp(item.y + dy, 0, 1) }));
      else {
        object.x = clamp(action.original.x + dx, 0, 1 - Math.abs(object.w));
        object.y = clamp(action.original.y + dy, 0, 1 - Math.abs(object.h));
      }
    }
    if (action.kind === 'resize') {
      object.w = Math.max(.02, point.x - action.original.x);
      object.h = Math.max(.02, point.y - action.original.y);
    }
    if (action.kind === 'rotate') object.rotation = Math.atan2(point.y - action.center.y, point.x - action.center.x) * 180 / Math.PI + 90;
    redraw();
  }

  function pointerUp(event) {
    if (!session) return;
    if (session.canvas.hasPointerCapture(event.pointerId)) session.canvas.releasePointerCapture(event.pointerId);
    session.action = null;
    redraw();
  }

  function syncCanvas() {
    if (!session?.image || !session.canvas) return;
    const imageRect = session.image.getBoundingClientRect();
    const surfaceRect = session.image.parentElement.getBoundingClientRect();
    const scale = Math.max(1, window.devicePixelRatio || 1);
    session.canvas.style.left = `${imageRect.left - surfaceRect.left}px`;
    session.canvas.style.top = `${imageRect.top - surfaceRect.top}px`;
    session.canvas.style.width = `${imageRect.width}px`;
    session.canvas.style.height = `${imageRect.height}px`;
    session.canvas.width = Math.max(1, Math.round(imageRect.width * scale));
    session.canvas.height = Math.max(1, Math.round(imageRect.height * scale));
    redraw();
  }

  function mountCanvas(image) {
    if (!session || session.image === image) return;
    session.canvas?.remove();
    session.resizeObserver?.disconnect();
    session.image = image;
    const surface = image.parentElement;
    surface.classList.add('studio-annotation-surface');
    const canvas = document.createElement('canvas');
    canvas.className = 'studio-annotation-canvas';
    canvas.setAttribute('aria-label', 'Image drawing, shapes, and text annotation canvas');
    canvas.tabIndex = 0;
    surface.appendChild(canvas);
    session.canvas = canvas;
    session.context = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', pointerDown, { signal: session.abort.signal });
    canvas.addEventListener('pointermove', pointerMove, { signal: session.abort.signal });
    canvas.addEventListener('pointerup', pointerUp, { signal: session.abort.signal });
    canvas.addEventListener('pointercancel', pointerUp, { signal: session.abort.signal });
    image.addEventListener('gxa:studio-image-view', syncCanvas, { signal: session.abort.signal });
    session.resizeObserver = new ResizeObserver(syncCanvas);
    session.resizeObserver.observe(surface);
    session.resizeObserver.observe(image);
    requestAnimationFrame(syncCanvas);
  }

  function setTool(tool) {
    session.tool = tool;
    session.controls.querySelectorAll('[data-annotation-tool]').forEach(button => button.classList.toggle('active', button.dataset.annotationTool === tool));
    if (session.canvas) session.canvas.dataset.tool = tool;
  }

  function updateSelectedFromControls() {
    const object = session.objects[session.selected];
    if (!object) return;
    checkpoint();
    const controls = session.controls;
    object.stroke = controls.querySelector('#studio-annotation-stroke').value;
    object.fill = controls.querySelector('#studio-annotation-fill').value;
    object.fillEnabled = controls.querySelector('#studio-annotation-fill-enabled').checked;
    object.size = Number(controls.querySelector('#studio-annotation-size').value);
    object.opacity = Number(controls.querySelector('#studio-annotation-opacity').value) / 100;
    if (object.type === 'text') {
      object.text = controls.querySelector('#studio-annotation-text').value || object.text;
      object.fontSize = Number(controls.querySelector('#studio-annotation-font-size').value) / 1000;
      object.weight = controls.querySelector('#studio-annotation-weight').value;
      object.align = controls.querySelector('#studio-annotation-align').value;
      object.rotation = Number(controls.querySelector('#studio-annotation-rotation').value);
    }
    redraw();
  }

  function attach(container) {
    dispose();
    const panel = container.querySelector('.tool-options-panel');
    if (!panel) return;
    const controls = document.createElement('fieldset');
    controls.className = 'studio-annotation-controls';
    controls.innerHTML = `
      <legend>Drawing, shapes & text</legend>
      <div class="annotation-tool-grid" role="toolbar" aria-label="Annotation tools">
        <button type="button" class="active" data-annotation-tool="select">Select</button>
        <button type="button" data-annotation-tool="pen">Pen</button>
        <button type="button" data-annotation-tool="brush">Brush</button>
        <button type="button" data-annotation-tool="highlighter">Highlighter</button>
        <button type="button" data-annotation-tool="eraser">Eraser</button>
        <button type="button" data-annotation-tool="rectangle">Rectangle</button>
        <button type="button" data-annotation-tool="ellipse">Ellipse</button>
        <button type="button" data-annotation-tool="line">Line</button>
        <button type="button" data-annotation-tool="arrow">Arrow</button>
      </div>
      <div class="annotation-property-grid">
        <label>Stroke/color<input id="studio-annotation-stroke" type="color" value="#2563eb"></label>
        <label>Fill<input id="studio-annotation-fill" type="color" value="#93c5fd"></label>
        <label class="checkbox-label"><input id="studio-annotation-fill-enabled" type="checkbox"><span class="custom-checkbox"></span>Use fill</label>
        <label>Size<input id="studio-annotation-size" type="range" min="1" max="40" value="4"></label>
        <label>Opacity<input id="studio-annotation-opacity" type="range" min="5" max="100" value="100"></label>
      </div>
      <div class="annotation-text-controls">
        <label>Text<input id="studio-annotation-text" class="form-input-text" type="text" maxlength="160" value="Sample text"></label>
        <div class="annotation-property-grid">
          <label>Font size<input id="studio-annotation-font-size" class="form-input-text" type="number" min="10" max="240" value="48"></label>
          <label>Weight<select id="studio-annotation-weight" class="form-input-text"><option value="400">Regular</option><option value="700">Bold</option></select></label>
          <label>Align<select id="studio-annotation-align" class="form-input-text"><option value="left">Left</option><option value="center" selected>Center</option><option value="right">Right</option></select></label>
          <label>Rotation<input id="studio-annotation-rotation" class="form-input-text" type="number" min="-180" max="180" value="0"></label>
        </div>
        <button type="button" data-annotation-action="add-text">Add text</button>
      </div>
      <div class="annotation-action-grid" role="toolbar" aria-label="Selected annotation actions">
        <button type="button" data-annotation-action="undo">Undo</button><button type="button" data-annotation-action="redo">Redo</button>
        <button type="button" data-annotation-action="duplicate">Duplicate</button><button type="button" data-annotation-action="delete">Delete</button>
        <button type="button" data-annotation-action="forward">Forward</button><button type="button" data-annotation-action="backward">Backward</button>
        <button type="button" data-annotation-action="clear">Clear drawing</button>
      </div>
      <small class="annotation-selection-status" aria-live="polite">0 objects</small>
      <small>Annotations are flattened into the exported image. Select an object to move, resize, duplicate, layer, or delete it; text also supports rotation.</small>
    `;
    panel.appendChild(controls);
    session = { container, controls, objects: [], history: [], future: [], selected: -1, tool: 'select', action: null, abort: new AbortController(), observer: null, resizeObserver: null, canvas: null, context: null, image: null };
    controls.addEventListener('click', (event) => {
      const tool = event.target.closest('[data-annotation-tool]')?.dataset.annotationTool;
      if (tool) return setTool(tool);
      const action = event.target.closest('[data-annotation-action]')?.dataset.annotationAction;
      if (!action) return;
      if (action === 'add-text') {
        checkpoint();
        const text = controls.querySelector('#studio-annotation-text').value.trim() || 'Text';
        session.objects.push({ type: 'text', x: .3, y: .42, w: .4, h: .12, text, fontSize: Number(controls.querySelector('#studio-annotation-font-size').value) / 1000, weight: controls.querySelector('#studio-annotation-weight').value, align: controls.querySelector('#studio-annotation-align').value, rotation: Number(controls.querySelector('#studio-annotation-rotation').value), stroke: controls.querySelector('#studio-annotation-stroke').value, opacity: Number(controls.querySelector('#studio-annotation-opacity').value) / 100 });
        setTool('select');
        setSelected(session.objects.length - 1);
      } else if (action === 'undo' && session.history.length) {
        session.future.push(clone(session.objects));
        session.objects = session.history.pop();
        setSelected(-1);
      } else if (action === 'redo' && session.future.length) {
        session.history.push(clone(session.objects));
        session.objects = session.future.pop();
        setSelected(-1);
      } else if (action === 'clear' && session.objects.length) {
        checkpoint(); session.objects = []; setSelected(-1);
      } else if (session.selected >= 0) {
        checkpoint();
        if (action === 'delete') session.objects.splice(session.selected, 1);
        if (action === 'duplicate') {
          const copy = clone(session.objects[session.selected]);
          if (copy.type === 'path') copy.points = copy.points.map(point => ({ x: clamp(point.x + .03, 0, 1), y: clamp(point.y + .03, 0, 1) }));
          else { copy.x = clamp(copy.x + .03, 0, .95); copy.y = clamp(copy.y + .03, 0, .95); }
          session.objects.splice(session.selected + 1, 0, copy); session.selected += 1;
        }
        if (action === 'forward' && session.selected < session.objects.length - 1) {
          [session.objects[session.selected], session.objects[session.selected + 1]] = [session.objects[session.selected + 1], session.objects[session.selected]]; session.selected += 1;
        }
        if (action === 'backward' && session.selected > 0) {
          [session.objects[session.selected], session.objects[session.selected - 1]] = [session.objects[session.selected - 1], session.objects[session.selected]]; session.selected -= 1;
        }
        if (action === 'delete') session.selected = -1;
        redraw();
      }
    }, { signal: session.abort.signal });
    controls.addEventListener('change', updateSelectedFromControls, { signal: session.abort.signal });
    const observer = new MutationObserver(() => {
      const image = container.querySelector('.uploaded-image-preview');
      if (image) mountCanvas(image);
    });
    observer.observe(container, { childList: true, subtree: true });
    session.observer = observer;
    const existingImage = container.querySelector('.uploaded-image-preview');
    if (existingImage) mountCanvas(existingImage);
  }

  function render(context, width, height) {
    if (!session) return 0;
    session.objects.forEach(object => drawObject(context, object, width, height));
    return session.objects.length;
  }

  function dispose() {
    if (!session) return;
    session.abort.abort();
    session.observer?.disconnect();
    session.resizeObserver?.disconnect();
    session.canvas?.remove();
    session.controls?.remove();
    session = null;
  }

  window.GxaImageAnnotations = Object.freeze({ attach, dispose, render, getObjects: () => clone(session?.objects || []) });
})();
