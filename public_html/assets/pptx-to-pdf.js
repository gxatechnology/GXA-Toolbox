/* Browser-local PPTX to PDF renderer. Supports basic text, solid shapes, images and backgrounds. */
(function (global) {
  'use strict';

  const MAX_BYTES = 25 * 1024 * 1024;
  const MAX_SLIDES = 30;
  const EMU_PER_INCH = 914400;
  const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  function error(message) { throw new Error(message); }
  function attr(xml, name) {
    const match = new RegExp(`\\b${name.replace(':', '\\:')}\\s*=\\s*["']([^"']*)["']`, 'i').exec(xml);
    return match ? decode(match[1]) : '';
  }
  function decode(value) {
    return String(value || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)));
  }
  function elements(xml, localName) {
    const escaped = localName.replace(':', '\\:');
    return [...xml.matchAll(new RegExp(`<${escaped}\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${escaped}>)`, 'gi'))].map(match => match[0]);
  }
  function relationshipMap(xml) {
    const result = new Map();
    for (const node of elements(xml, 'Relationship')) result.set(attr(node, 'Id'), attr(node, 'Target'));
    return result;
  }
  function resolvePart(base, target) {
    const parts = base.split('/').slice(0, -1);
    for (const bit of target.replace(/\\/g, '/').split('/')) {
      if (!bit || bit === '.') continue;
      if (bit === '..') parts.pop(); else parts.push(bit);
    }
    return parts.join('/');
  }
  function colour(xml, fallback) {
    const hex = /<(?:a:)?srgbClr\b[^>]*\bval=["']([0-9a-f]{6})["']/i.exec(xml || '')?.[1];
    return hex ? `#${hex}` : fallback;
  }
  function num(value, fallback) { const parsed = Number(value); return value !== '' && Number.isFinite(parsed) ? parsed : fallback; }
  function textSafe(value) {
    const text = decode(value).replace(/[\r\n\t]+/g, ' ').trim();
    if (/[^\x20-\x7e\xa0-\xff]/.test(text)) error('This presentation contains characters unsupported by the built-in PDF font. No text was replaced or incomplete PDF exported.');
    return text;
  }
  function extractText(shape) { return elements(shape, 'a:t').map(node => textSafe(node.replace(/<[^>]+>/g, ''))).filter(Boolean).join(' '); }
  function dimensions(node, width, height) {
    const xfrm = elements(node, 'a:xfrm')[0] || '';
    const off = elements(xfrm, 'a:off')[0] || '';
    const ext = elements(xfrm, 'a:ext')[0] || '';
    return {
      x: num(attr(off, 'x'), 0) / EMU_PER_INCH * 72,
      y: height - (num(attr(off, 'y'), 0) + num(attr(ext, 'cy'), 0)) / EMU_PER_INCH * 72,
      width: Math.max(0, num(attr(ext, 'cx'), 0) / EMU_PER_INCH * 72),
      height: Math.max(0, num(attr(ext, 'cy'), 0) / EMU_PER_INCH * 72)
    };
  }
  function extension(path) { return path.split('.').pop().toLowerCase(); }

  async function convert(file, options) {
    if (!file || !file.name) error('Please choose a valid .pptx file.');
    if (/\.ppt$/i.test(file.name)) error('Legacy .ppt files are not supported. Please save the presentation as .pptx first.');
    if (!/\.pptx$/i.test(file.name)) error('Please choose a valid .pptx file.');
    if (file.type && !['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed'].includes(file.type)) error('Please choose a valid .pptx file.');
    if (!file.size) error('This presentation file is empty.');
    if (file.size > MAX_BYTES) error('This presentation is too large to process in your browser. The limit is 25 MB.');
    if (!global.JSZip || !global.PDFLib) error('The local presentation renderer is still loading. Please try again.');

    let archive;
    try { archive = await global.JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: true }); }
    catch (_) { error('This .pptx file is corrupt or cannot be opened.'); }
    const getText = async (path) => archive.file(path) ? archive.file(path).async('string') : '';
    const presentation = await getText('ppt/presentation.xml');
    const presentationRels = await getText('ppt/_rels/presentation.xml.rels');
    if (!presentation || !presentationRels || archive.file('EncryptedPackage')) error('This presentation is encrypted, incomplete, or not a valid .pptx file.');

    const slideSize = elements(presentation, 'p:sldSz')[0] || '';
    const requestedWidth = num(attr(slideSize, 'cx'), 12192000) / EMU_PER_INCH * 72;
    const requestedHeight = num(attr(slideSize, 'cy'), 6858000) / EMU_PER_INCH * 72;
    const pageWidth = Number.isFinite(requestedWidth) && requestedWidth > 0 ? requestedWidth : 960;
    const pageHeight = Number.isFinite(requestedHeight) && requestedHeight > 0 ? requestedHeight : 540;
    const ids = elements(presentation, 'p:sldId').map(node => attr(node, 'r:id') || attr(node, 'id')).filter(Boolean);
    if (!ids.length) error('This presentation has no slides to convert.');
    if (ids.length > MAX_SLIDES) error(`This presentation has ${ids.length} slides. The browser limit is ${MAX_SLIDES} slides.`);
    const presentationMap = relationshipMap(presentationRels);
    const slidePaths = ids.map(id => resolvePart('ppt/presentation.xml', presentationMap.get(id) || '')).filter(path => archive.file(path));
    if (slidePaths.length !== ids.length) error('This presentation is missing one or more slide files.');

    const { PDFDocument, rgb, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    pdf.setProducer('GXA Toolbox browser-local PPTX renderer');
    const warnings = new Set();
    for (const slidePath of slidePaths) {
      const slide = await getText(slidePath);
      const relPath = `${slidePath.slice(0, slidePath.lastIndexOf('/') + 1)}_rels/${slidePath.slice(slidePath.lastIndexOf('/') + 1)}.rels`;
      const rels = relationshipMap(await getText(relPath));
      const page = pdf.addPage([pageWidth, pageHeight]);
      const background = colour(elements(slide, 'p:bg')[0], '#ffffff');
      page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(...hex(background)) });

      for (const picture of elements(slide, 'p:pic')) {
        const embed = /<(?:a:)?blip\b[^>]*\br:embed=["']([^"']+)["']/i.exec(picture)?.[1];
        const target = embed && rels.get(embed) ? resolvePart(slidePath, rels.get(embed)) : '';
        const imageFile = target && archive.file(target);
        if (!imageFile) { warnings.add('Some linked images could not be found.'); continue; }
        try {
          const bytes = await imageFile.async('uint8array');
          const image = ['jpg', 'jpeg'].includes(extension(target)) ? await pdf.embedJpg(bytes) : extension(target) === 'png' ? await pdf.embedPng(bytes) : null;
          if (!image) { warnings.add('Some image formats are not supported by the browser renderer.'); continue; }
          const box = dimensions(picture, pageWidth, pageHeight);
          page.drawImage(image, box);
        } catch (_) { warnings.add('Some images could not be rendered.'); }
      }

      for (const shape of elements(slide, 'p:sp')) {
        const box = dimensions(shape, pageWidth, pageHeight);
        if (!box.width || !box.height) continue;
        const geom = /<(?:a:)?prstGeom\b[^>]*\bprst=["']([^"']+)/i.exec(shape)?.[1] || 'rect';
        const fill = colour(elements(shape, 'a:solidFill')[0], null);
        const line = colour(elements(shape, 'a:ln')[0], null);
        const draw = { x: box.x, y: box.y, width: box.width, height: box.height };
        if (geom === 'ellipse') page.drawEllipse({ x: box.x + box.width / 2, y: box.y + box.height / 2, xScale: box.width / 2, yScale: box.height / 2, ...(fill ? { color: rgb(...hex(fill)) } : {}), ...(line ? { borderColor: rgb(...hex(line)), borderWidth: 0.75 } : {}) });
        else page.drawRectangle({ ...draw, ...(fill ? { color: rgb(...hex(fill)) } : {}), ...(line ? { borderColor: rgb(...hex(line)), borderWidth: 0.75 } : {}) });
        const text = extractText(shape);
        if (!text) continue;
        const run = elements(shape, 'a:rPr')[0] || '';
        const size = Math.max(6, Math.min(72, num(attr(run, 'sz'), 1800) / 100));
        const font = /\bb=["']1/i.test(run) ? await pdf.embedFont(StandardFonts.HelveticaBold) : await pdf.embedFont(StandardFonts.Helvetica);
        const fontColour = colour(run, '#111827');
        const fit = Math.max(1, Math.floor(box.width / Math.max(1, size * 0.55)));
        const lines = text.match(new RegExp(`.{1,${fit}}(?:\\s|$)|\\S+?(?=\\s|$)`, 'g')) || [text];
        if (lines.length > Math.max(1, Math.floor(box.height / (size * 1.25)))) error('Slide text exceeds its supported text box. Simplify the slide; no truncated PDF was exported.');
        lines.forEach((line, index) => page.drawText(line.trim(), { x: box.x + 2, y: box.y + box.height - size - 2 - index * size * 1.25, size, font, color: rgb(...hex(fontColour)), maxWidth: Math.max(1, box.width - 4) }));
        if (!['rect', 'ellipse', 'roundRect'].includes(geom)) warnings.add('Some advanced PowerPoint shapes were simplified.');
      }
      if (/<(?:p:)?graphicFrame\b|<(?:p:)?grpSp\b|<(?:p:)?transition\b|<(?:p:)?timing\b/i.test(slide)) warnings.add('Charts, grouped content, animations, transitions, and embedded media are not reproduced.');
    }
    const bytes = await pdf.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), warnings: [...warnings], slideCount: slidePaths.length };
  }
  function hex(value) { const normalized = String(value || '#000000').replace('#', ''); return [0, 2, 4].map(offset => parseInt(normalized.slice(offset, offset + 2), 16) / 255); }
  global.GxaPptxToPdf = Object.freeze({ convert, MAX_BYTES, MAX_SLIDES, REL_NS });
})(window);
