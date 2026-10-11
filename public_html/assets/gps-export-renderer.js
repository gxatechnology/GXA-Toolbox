/* Original GXA canvas templates. Preview and JPG/PNG export use this exact renderer. */
(function (root) {
  'use strict';
  const fonts = 'system-ui, -apple-system, sans-serif';
  const themes = {
    classic: { background: '#0f2036', text: '#ffffff', muted: '#d5e2f1', accent: '#80b6ff', line: '#40536b' },
    field: { background: '#17212b', text: '#ffffff', muted: '#d2dce7', accent: '#9cc7f5', line: '#526170' },
    travel: { background: '#123c42', text: '#fffaf0', muted: '#d4e8e3', accent: '#efd094', line: '#4d7070' }
  };
  function rounded(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  }
  function wrap(ctx, value, width) {
    // Break oversized tokens as well as words. Never discard the tail of an address.
    const lines = []; let current = '';
    for (const word of String(value).split(/\s+/).filter(Boolean)) {
      if (current && ctx.measureText(current + ' ' + word).width > width) { lines.push(current); current = ''; }
      for (const char of Array.from((current ? ' ' : '') + word)) {
        if (ctx.measureText(current + char).width > width && current) { lines.push(current); current = ''; }
        current += char;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
  function pin(ctx, x, y, size) {
    ctx.save(); ctx.translate(x - size / 2, y - size); ctx.scale(size / 24, size / 24);
    ctx.fillStyle = '#2563eb'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    const shape = new Path2D('M12 24S3 16 3 9a9 9 0 0 1 18 0c0 7-9 15-9 15Z'); ctx.fill(shape); ctx.stroke(shape);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12, 9, 3, 0, 2 * Math.PI); ctx.fill(); ctx.restore();
  }
  function drawMap(ctx, box, model, mapImage, theme) {
    const { x, y, w, h } = box;
    rounded(ctx, x, y, w, h, 12, '#e9f0f5');
    if (mapImage) {
      // Contain the entire provider image, including its attribution. Never crop it.
      const ratio = Math.min(w / mapImage.width, h / mapImage.height);
      const width = mapImage.width * ratio, height = mapImage.height * ratio;
      ctx.drawImage(mapImage, x + (w - width) / 2, y + (h - height) / 2, width, height);
    } else {
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.clip();
      ctx.strokeStyle = '#bdcdda'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 6, y); ctx.lineTo(x + w * i / 6, y + h); ctx.stroke(); }
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x, y + h * i / 5); ctx.lineTo(x + w, y + h * i / 5); ctx.stroke(); }
      ctx.fillStyle = '#28485c'; ctx.font = `600 12px ${fonts}`;
      ctx.fillText('N ↑', x + 10, y + 18);
      ctx.font = `500 10px ${fonts}`;
      ctx.fillText(model.latitude.toFixed(5) + '°', x + 8, y + h - 20);
      ctx.fillText(model.longitude.toFixed(5) + '°', x + 8, y + h - 7);
      ctx.restore();
    }
    pin(ctx, x + w / 2, y + h / 2, 32);
    ctx.fillStyle = theme.muted;
    const caption = mapImage ? 'STREET MAP' : 'COORDINATE LOCATOR';
    let captionSize = 12; ctx.font = `600 ${captionSize}px ${fonts}`;
    while (ctx.measureText(caption).width > w && captionSize > 8) { captionSize -= .5; ctx.font = `600 ${captionSize}px ${fonts}`; }
    ctx.fillText(caption, x, y + h + 14);
    if (!mapImage) { ctx.font = `400 ${captionSize}px ${fonts}`; ctx.fillText('Not a street map', x, y + h + 29); }
  }
  function render(target, photo, model, { mapImage = null, logo = null } = {}) {
    if (model.latitude === null || model.longitude === null) throw new Error('Choose valid coordinates before stamping.');
    const ctx = target.getContext('2d'); ctx.clearRect(0, 0, target.width, target.height); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, target.width, target.height); ctx.drawImage(photo, 0, 0, target.width, target.height);
    // Size everything in source-image units, never CSS/viewport pixels. The mini map
    // uses 18/23/28% of the shorter photo edge in every preset and orientation.
    const sourceUnit = Math.min(photo.width, photo.height) / 1080;
    const W = photo.width / sourceUnit, H = photo.height / sourceUnit, pad = 16;
    // Preview dimensions are rounded to whole pixels; source dimensions keep text
    // wrapping identical even for odd-sized photos at a reduced preview resolution.
    const scale = target.width / W, scaleY = target.height / H;
    const theme = themes[model.template] || themes.classic;
    const titleFont = model.template === 'travel' ? 'Georgia, serif' : fonts;
    const mapW = model.showMap ? 1080 * ({ small: .18, medium: .23, large: .28 }[model.mapSize] || .18) : 0;
    const gap = mapW ? 18 : 0, textX = pad + mapW + gap, textW = W - textX - pad;
    const mapH = mapW ? mapW * .75 + 30 : 0;
    let density = 1, layout;
    function measure(d) {
      const blocks = [];
      const add = (text, size, lineHeight, weight, color, family = fonts, width = textW, spacing = 0) => {
        if (!text) return;
        ctx.font = `${weight} ${size * d}px ${family}`;
        const lines = wrap(ctx, text, width);
        blocks.push({ lines, size: size * d, lineHeight: lineHeight * d, weight, color, family, spacing: spacing * d });
      };
      add(model.title, 28, 34, 750, theme.text, titleFont, textW - (logo ? 48 : 0), 2);
      if (logo) blocks[0].spacing = Math.max(blocks[0].spacing, 32 - blocks[0].lines.length * blocks[0].lineHeight);
      add(model.address, 18, 23, 450, theme.muted, fonts, textW, 5);
      add(model.captureLabel + ': ' + model.date + ' · ' + model.time, 19, 25, 600, theme.text);
      add('Latitude: ' + model.latitudeText + ' · Longitude: ' + model.longitudeText, 18, 24, 550, theme.text);
      add(model.metadata.map(item => item.label + ': ' + item.value).join(' · '), 16, 21, 450, theme.muted, fonts, textW, 2);
      for (const item of model.professional) {
        add(({company:'Company',project:'Project',job:'Work order',employee:'Inspector',remarks:'Notes'})[item.key] + ': ' + item.value, 16, 21, 450, theme.muted);
      }
      add('GXA Toolbox · Device zone: ' + model.browserZone + ' · ' + model.disclaimer, 13, 18, 450, theme.muted);
      if (mapImage && model.showMap) add('© OpenStreetMap contributors · © OpenMapTiles · Powered by Geoapify', 14, 19, 500, theme.muted);
      const textH = blocks.reduce((height, block) => height + block.lines.length * block.lineHeight + block.spacing, 0);
      return { blocks, height: pad * 2 + Math.max(mapH, textH) };
    }
    layout = measure(density);
    // Only unusually long optional content needs denser type. Map Size stays exact.
    while (layout.height > H * .4 && density > .7) { density = Math.max(.7, density - .05); layout = measure(density); }
    if (layout.height > H) throw new Error('This photo is too short for the selected details. Hide optional fields, shorten the address, or choose a taller photo.');
    const top = model.position === 'top' ? 0 : H - layout.height;
    ctx.save(); ctx.scale(scale, scaleY);
    ctx.save(); ctx.globalAlpha = model.opacity; ctx.fillStyle = theme.background; ctx.fillRect(0, top, W, layout.height); ctx.restore();
    ctx.fillStyle = theme.accent; ctx.fillRect(0, top, W, 2);
    const mapBox = mapW ? { x: pad, y: top + layout.height - pad - mapH, w: mapW, h: mapW * .75 } : null;
    if (mapBox) drawMap(ctx, mapBox, model, mapImage, theme);
    if (logo) {
      const ratio = Math.min(36 / logo.width, 30 / logo.height);
      ctx.drawImage(logo, W - pad - logo.width * ratio, top + pad, logo.width * ratio, logo.height * ratio);
    }
    let textY = top + pad;
    for (const block of layout.blocks) {
      ctx.font = `${block.weight} ${block.size}px ${block.family}`; ctx.fillStyle = block.color;
      for (const line of block.lines) { ctx.fillText(line, textX, textY + block.size); textY += block.lineHeight; }
      textY += block.spacing;
    }
    if (model.template === 'field') {
      ctx.strokeStyle = theme.line; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(textX - gap / 2, top + pad); ctx.lineTo(textX - gap / 2, top + layout.height - pad); ctx.stroke();
    }
    ctx.restore();
    return { x: 0, y: top * scaleY, width: target.width, height: layout.height * scaleY, density, template: model.template,
      map: mapBox && { x: mapBox.x * scale, y: mapBox.y * scaleY, width: mapBox.w * scale, height: mapBox.h * scaleY },
      text: { x: textX * scale, width: textW * scale } };
  }
  root.GxaGpsExport = Object.freeze({ render, wrap });
})(window);
