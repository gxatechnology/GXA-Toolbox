(function (global) {
  'use strict';

  const MAX_BYTES = 50 * 1024 * 1024;
  const MAX_SVG_BYTES = 2 * 1024 * 1024;
  const MAX_DIMENSION = 8192;
  const MAX_PIXELS = 25_000_000;
  const MIME = Object.freeze({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff', ico: 'image/x-icon', svg: 'image/svg+xml' });
  const LABEL = Object.freeze({ jpeg: 'JPEG', png: 'PNG', webp: 'WebP', avif: 'AVIF', gif: 'GIF', bmp: 'BMP', tiff: 'TIFF', ico: 'ICO', svg: 'SVG', heic: 'HEIC/HEIF', psd: 'PSD/PSB', hdr: 'HDR/EXR', raw: 'Camera RAW', jp2: 'JPEG 2000', jxl: 'JPEG XL', pnm: 'Portable bitmap', tga: 'TGA', legacy: 'Legacy image' });
  const EXTENSIONS = Object.freeze({
    jpg: 'jpeg', jpeg: 'jpeg', jfif: 'jpeg', png: 'png', webp: 'webp', avif: 'avif', gif: 'gif', bmp: 'bmp', dib: 'bmp', tif: 'tiff', tiff: 'tiff', ico: 'ico', cur: 'ico', svg: 'svg', svgz: 'svg',
    heic: 'heic', heif: 'heic', hif: 'heic', psd: 'psd', psb: 'psd', hdr: 'hdr', rgbe: 'hdr', exr: 'hdr', jp2: 'jp2', j2k: 'jp2', jpf: 'jp2', jpx: 'jp2', jpm: 'jp2', mj2: 'jp2', jxl: 'jxl',
    pbm: 'pnm', pgm: 'pnm', ppm: 'pnm', pnm: 'pnm', pam: 'pnm', tga: 'tga', targa: 'tga', pcx: 'legacy', xbm: 'legacy', xpm: 'legacy', wbmp: 'legacy', pcd: 'legacy', dds: 'legacy', fits: 'legacy', fit: 'legacy', sgi: 'legacy', sun: 'legacy', ras: 'legacy',
    cr2: 'raw', cr3: 'raw', nef: 'raw', nrw: 'raw', arw: 'raw', sr2: 'raw', srf: 'raw', raf: 'raw', orf: 'raw', rw2: 'raw', rwl: 'raw', pef: 'raw', dng: 'raw', '3fr': 'raw', iiq: 'raw', mos: 'raw', mrw: 'raw', erf: 'raw', mef: 'raw', kdc: 'raw', dcr: 'raw', srw: 'raw'
  });
  const SUPPORTED_INPUTS = Object.freeze(['jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'svg', 'avif']);
  const OUTPUTS = Object.freeze({
    jpeg: { label: 'JPEG', extension: 'jpg', mime: 'image/jpeg', alpha: false, lossy: true },
    png: { label: 'PNG', extension: 'png', mime: 'image/png', alpha: true, lossy: false },
    webp: { label: 'WebP', extension: 'webp', mime: 'image/webp', alpha: true, lossy: true },
    gif: { label: 'GIF', extension: 'gif', mime: 'image/gif', alpha: false, lossy: false, singleFrame: true },
    bmp: { label: 'BMP', extension: 'bmp', mime: 'image/bmp', alpha: false, lossy: false },
    tiff: { label: 'TIFF', extension: 'tiff', mime: 'image/tiff', alpha: true, lossy: false },
    ico: { label: 'ICO', extension: 'ico', mime: 'image/x-icon', alpha: true, lossy: false, icon: true }
  });

  function bytesOf(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    throw new TypeError('Expected image bytes.');
  }

  function extensionOf(name = '') {
    const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }

  function starts(bytes, values, offset = 0) {
    return values.every((value, index) => bytes[offset + index] === value);
  }

  function ascii(bytes, start, length) {
    return String.fromCharCode(...bytes.slice(start, start + length));
  }

  function detectSignature(bytes) {
    if (starts(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
    if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
    if (bytes.length >= 6 && /GIF8[79]a/.test(ascii(bytes, 0, 6))) return 'gif';
    if (starts(bytes, [0x42, 0x4d])) return 'bmp';
    if (starts(bytes, [0x49, 0x49, 0x2a, 0x00]) || starts(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff';
    if (starts(bytes, [0x00, 0x00, 0x01, 0x00]) || starts(bytes, [0x00, 0x00, 0x02, 0x00])) return 'ico';
    if (starts(bytes, [0x38, 0x42, 0x50, 0x53])) return 'psd';
    if (starts(bytes, [0x76, 0x2f, 0x31, 0x01])) return 'hdr';
    if (ascii(bytes, 0, Math.min(bytes.length, 11)) === '#?RADIANCE\n') return 'hdr';
    if (starts(bytes, [0xff, 0x0a]) || (bytes.length >= 12 && ascii(bytes, 4, 4) === 'JXL ')) return 'jxl';
    if (bytes.length >= 12 && starts(bytes, [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a])) return 'jp2';
    if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
      const brandBytes = ascii(bytes, 8, Math.min(bytes.length - 8, 40));
      if (/(avif|avis)/.test(brandBytes)) return 'avif';
      if (/(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(brandBytes)) return 'heic';
    }
    const prefix = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 1024))).replace(/^\uFEFF/, '').trimStart();
    if (/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(prefix)) return 'svg';
    if (/^P[1-7]\s/.test(prefix)) return 'pnm';
    return '';
  }

  function detect(input, details = {}) {
    const bytes = bytesOf(input);
    if (!bytes.length) throw new Error('The selected file is empty.');
    if (bytes.length > MAX_BYTES) throw new Error('The selected file exceeds the 50 MB browser limit.');
    const detected = detectSignature(bytes);
    const extension = extensionOf(details.name);
    const extensionFormat = EXTENSIONS[extension] || '';
    if (!detected) {
      if (extensionFormat) return { format: extensionFormat, label: LABEL[extensionFormat] || extension.toUpperCase(), support: 'unsupported', reason: 'The extension is recognized, but the file signature is not handled by this browser converter.', extension, mismatch: false };
      return { format: '', label: 'Unknown', support: 'unsupported', reason: 'The image signature is not recognized.', extension, mismatch: false };
    }
    const mismatch = Boolean(extensionFormat && extensionFormat !== detected && !(extensionFormat === 'svg' && extension === 'svgz'));
    const mimeFormat = Object.entries(MIME).find(([, mime]) => mime === String(details.mime || '').toLowerCase())?.[0] || '';
    const mimeMismatch = Boolean(mimeFormat && mimeFormat !== detected);
    const support = SUPPORTED_INPUTS.includes(detected) ? (detected === 'avif' ? 'partial' : 'supported') : 'unsupported';
    const reason = detected === 'avif'
      ? 'AVIF is supported only when the current browser validates and decodes this file.'
      : support === 'unsupported'
        ? `${LABEL[detected] || detected.toUpperCase()} is recognized but has no verified decoder in this build.`
        : '';
    return { format: detected, label: LABEL[detected] || detected.toUpperCase(), support, reason, extension, mismatch, mimeMismatch };
  }

  function detectAnimation(input, format) {
    const bytes = bytesOf(input);
    if (format === 'gif') return true;
    if (format === 'webp') {
      for (let offset = 12; offset + 8 <= bytes.length;) {
        const type = ascii(bytes, offset, 4); const length = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
        if (length < 0 || offset + 8 + length > bytes.length) return false;
        if (type === 'ANIM' || type === 'ANMF') return true;
        offset += 8 + length + (length & 1);
      }
    }
    if (format === 'png') {
      for (let offset = 8; offset + 12 <= bytes.length;) {
        const length = (bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
        if (length > bytes.length - offset - 12) return false;
        if (ascii(bytes, offset + 4, 4) === 'acTL') return true;
        offset += 12 + length;
      }
    }
    return false;
  }

  function assertDimensions(width, height, context = 'Image') {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
      throw new Error(`${context} dimensions exceed the safe 8,192 pixel or 25 megapixel limit.`);
    }
  }

  function rgbaBytes(value, width, height) {
    const rgba = value instanceof Uint8ClampedArray ? value : new Uint8ClampedArray(value);
    assertDimensions(width, height);
    if (rgba.length !== width * height * 4) throw new Error('The decoded pixel buffer has an invalid length.');
    return rgba;
  }

  function decodeBmp(input) {
    const bytes = bytesOf(input);
    if (!starts(bytes, [0x42, 0x4d]) || bytes.length < 54) throw new Error('The selected file is not a valid BMP image.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const pixelOffset = view.getUint32(10, true);
    const headerSize = view.getUint32(14, true);
    if (headerSize < 40) throw new Error('Only Windows BMP headers of 40 bytes or newer are supported.');
    const width = view.getInt32(18, true);
    const signedHeight = view.getInt32(22, true);
    const height = Math.abs(signedHeight);
    const planes = view.getUint16(26, true);
    const bitDepth = view.getUint16(28, true);
    const compression = view.getUint32(30, true);
    assertDimensions(width, height, 'BMP');
    if (planes !== 1 || compression !== 0 || ![24, 32].includes(bitDepth)) throw new Error('This BMP uses an unsupported compression or bit depth. Only uncompressed 24-bit and 32-bit BMP files are supported.');
    const stride = Math.ceil(width * bitDepth / 32) * 4;
    if (pixelOffset + stride * height > bytes.length) throw new Error('The BMP pixel data is truncated.');
    const rgba = new Uint8ClampedArray(width * height * 4);
    let hasVisibleAlpha = false;
    for (let y = 0; y < height; y += 1) {
      const sourceY = signedHeight > 0 ? height - 1 - y : y;
      for (let x = 0; x < width; x += 1) {
        const source = pixelOffset + sourceY * stride + x * (bitDepth / 8);
        const target = (y * width + x) * 4;
        rgba[target] = bytes[source + 2]; rgba[target + 1] = bytes[source + 1]; rgba[target + 2] = bytes[source];
        rgba[target + 3] = bitDepth === 32 ? bytes[source + 3] : 255;
        if (rgba[target + 3]) hasVisibleAlpha = true;
      }
    }
    if (bitDepth === 32 && !hasVisibleAlpha) for (let index = 3; index < rgba.length; index += 4) rgba[index] = 255;
    return { width, height, rgba, bitDepth, pages: 1, animated: false };
  }

  function parseColor(hex) {
    const match = String(hex || '#ffffff').match(/^#([0-9a-f]{6})$/i);
    if (!match) return [255, 255, 255];
    return [0, 2, 4].map(offset => parseInt(match[1].slice(offset, offset + 2), 16));
  }

  function encodeBmp(pixelData) {
    const { width, height } = pixelData;
    const rgba = rgbaBytes(pixelData.rgba, width, height);
    const background = parseColor(pixelData.background);
    const stride = Math.ceil(width * 3 / 4) * 4;
    const output = new Uint8Array(54 + stride * height);
    const view = new DataView(output.buffer);
    output.set([0x42, 0x4d]); view.setUint32(2, output.length, true); view.setUint32(10, 54, true); view.setUint32(14, 40, true); view.setInt32(18, width, true); view.setInt32(22, height, true); view.setUint16(26, 1, true); view.setUint16(28, 24, true); view.setUint32(34, stride * height, true);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4; const alpha = rgba[source + 3] / 255; const target = 54 + (height - 1 - y) * stride + x * 3;
      output[target] = Math.round(rgba[source + 2] * alpha + background[2] * (1 - alpha)); output[target + 1] = Math.round(rgba[source + 1] * alpha + background[1] * (1 - alpha)); output[target + 2] = Math.round(rgba[source] * alpha + background[0] * (1 - alpha));
    }
    return output;
  }

  function decodeTiff(input) {
    const bytes = bytesOf(input);
    if (bytes.length < 8) throw new Error('The TIFF header is truncated.');
    const little = starts(bytes, [0x49, 0x49]);
    if (!little && !starts(bytes, [0x4d, 0x4d])) throw new Error('The selected file is not a TIFF image.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = offset => { if (offset < 0 || offset + 2 > bytes.length) throw new Error('The TIFF directory is truncated.'); return view.getUint16(offset, little); };
    const u32 = offset => { if (offset < 0 || offset + 4 > bytes.length) throw new Error('The TIFF directory is truncated.'); return view.getUint32(offset, little); };
    if (u16(2) !== 42) throw new Error('BigTIFF and non-baseline TIFF signatures are not supported.');
    const directories = []; let ifdOffset = u32(4);
    for (let page = 0; ifdOffset && page < 16; page += 1) {
      const count = u16(ifdOffset); if (ifdOffset + 2 + count * 12 + 4 > bytes.length || count > 128) throw new Error('The TIFF image directory is malformed.');
      const tags = new Map();
      for (let index = 0; index < count; index += 1) {
        const offset = ifdOffset + 2 + index * 12; const tag = u16(offset); const type = u16(offset + 2); const length = u32(offset + 4); const valueOffset = offset + 8;
        const size = type === 3 ? 2 : type === 4 ? 4 : 0; if (!size || length > MAX_DIMENSION) continue;
        const valueStart = size * length <= 4 ? valueOffset : u32(valueOffset); const values = [];
        for (let item = 0; item < length; item += 1) values.push(type === 3 ? u16(valueStart + item * 2) : u32(valueStart + item * 4));
        tags.set(tag, values);
      }
      directories.push(tags); ifdOffset = u32(ifdOffset + 2 + count * 12);
    }
    if (ifdOffset) throw new Error('TIFF files with more than 16 pages are outside this converter limit.');
    if (!directories.length) throw new Error('The TIFF contains no image directory.');
    const tags = directories[0]; const width = tags.get(256)?.[0]; const height = tags.get(257)?.[0]; assertDimensions(width, height, 'TIFF');
    const bits = tags.get(258) || []; const compression = tags.get(259)?.[0] || 1; const photometric = tags.get(262)?.[0]; const offsets = tags.get(273) || []; const samples = tags.get(277)?.[0] || 1; const rowsPerStrip = tags.get(278)?.[0] || height; const counts = tags.get(279) || []; const planar = tags.get(284)?.[0] || 1; const orientation = tags.get(274)?.[0] || 1;
    if (compression !== 1 || photometric !== 2 || planar !== 1 || ![3, 4].includes(samples) || bits.length !== samples || bits.some(bit => bit !== 8)) throw new Error('Only uncompressed, interleaved 8-bit RGB or RGBA baseline TIFF images are supported.');
    if (!offsets.length || counts.length !== offsets.length) throw new Error('The TIFF strip table is incomplete.');
    const source = new Uint8Array(width * height * samples); let row = 0;
    offsets.forEach((offset, strip) => { const count = counts[strip]; const rows = Math.min(rowsPerStrip, height - row); const needed = rows * width * samples; if (count < needed || offset + needed > bytes.length) throw new Error('The TIFF pixel strip is truncated.'); source.set(bytes.slice(offset, offset + needed), row * width * samples); row += rows; });
    if (row !== height) throw new Error('The TIFF does not contain all declared rows.');
    const rgba = new Uint8ClampedArray(width * height * 4); for (let pixel = 0; pixel < width * height; pixel += 1) { rgba[pixel * 4] = source[pixel * samples]; rgba[pixel * 4 + 1] = source[pixel * samples + 1]; rgba[pixel * 4 + 2] = source[pixel * samples + 2]; rgba[pixel * 4 + 3] = samples === 4 ? source[pixel * samples + 3] : 255; }
    return { ...applyOrientation(rgba, width, height, orientation), bitDepth: 8, pages: directories.length, animated: false, orientation };
  }

  function applyOrientation(source, width, height, orientation) {
    if (orientation < 2 || orientation > 8) return { rgba: source, width, height };
    const swap = orientation >= 5; const outputWidth = swap ? height : width; const outputHeight = swap ? width : height; const output = new Uint8ClampedArray(outputWidth * outputHeight * 4);
    for (let y = 0; y < outputHeight; y += 1) for (let x = 0; x < outputWidth; x += 1) {
      let sx = x; let sy = y;
      if (orientation === 2) { sx = width - 1 - x; sy = y; }
      if (orientation === 3) { sx = width - 1 - x; sy = height - 1 - y; }
      if (orientation === 4) { sx = x; sy = height - 1 - y; }
      if (orientation === 5) { sx = y; sy = x; }
      if (orientation === 6) { sx = y; sy = height - 1 - x; }
      if (orientation === 7) { sx = width - 1 - y; sy = height - 1 - x; }
      if (orientation === 8) { sx = width - 1 - y; sy = x; }
      output.set(source.slice((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (y * outputWidth + x) * 4);
    }
    return { rgba: output, width: outputWidth, height: outputHeight };
  }

  function encodeTiff(pixelData) {
    const { width, height } = pixelData; const rgba = rgbaBytes(pixelData.rgba, width, height); const entries = 12; const ifdSize = 2 + entries * 12 + 4; const bitsOffset = 8 + ifdSize; const pixelOffset = bitsOffset + 8; const output = new Uint8Array(pixelOffset + rgba.length); const view = new DataView(output.buffer);
    output.set([0x49, 0x49, 0x2a, 0x00]); view.setUint32(4, 8, true); view.setUint16(8, entries, true); let cursor = 10;
    const entry = (tag, type, count, value) => { view.setUint16(cursor, tag, true); view.setUint16(cursor + 2, type, true); view.setUint32(cursor + 4, count, true); if (type === 3 && count === 1) view.setUint16(cursor + 8, value, true); else view.setUint32(cursor + 8, value, true); cursor += 12; };
    entry(256, 4, 1, width); entry(257, 4, 1, height); entry(258, 3, 4, bitsOffset); entry(259, 3, 1, 1); entry(262, 3, 1, 2); entry(273, 4, 1, pixelOffset); entry(274, 3, 1, 1); entry(277, 3, 1, 4); entry(278, 4, 1, height); entry(279, 4, 1, rgba.length); entry(284, 3, 1, 1); entry(338, 3, 1, 2); view.setUint32(cursor, 0, true); [8, 8, 8, 8].forEach((bit, index) => view.setUint16(bitsOffset + index * 2, bit, true)); output.set(rgba, pixelOffset); return output;
  }

  function parseIco(input) {
    const bytes = bytesOf(input); if (bytes.length < 22 || bytes[0] || bytes[1] || ![1, 2].includes(bytes[2]) || bytes[3]) throw new Error('The selected file is not a valid ICO or CUR container.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const count = view.getUint16(4, true); if (!count || count > 64 || 6 + count * 16 > bytes.length) throw new Error('The icon directory is malformed or contains too many entries.');
    const entries = [];
    for (let index = 0; index < count; index += 1) { const offset = 6 + index * 16; const width = bytes[offset] || 256; const height = bytes[offset + 1] || 256; const size = view.getUint32(offset + 8, true); const start = view.getUint32(offset + 12, true); assertDimensions(width, height, 'Icon'); if (!size || start + size > bytes.length) throw new Error('An icon image entry is truncated.'); const image = bytes.slice(start, start + size); entries.push({ width, height, bitDepth: view.getUint16(offset + 6, true), bytes: image, png: starts(image, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }); }
    const supported = entries.filter(entry => entry.png).sort((a, b) => b.width * b.height - a.width * a.height); if (!supported.length) throw new Error('This icon uses a legacy DIB entry. This build decodes only PNG-compressed ICO/CUR entries.');
    return { entries, supported, pages: entries.length, animated: false };
  }

  function encodeIco(pngInput, width, height = width) {
    const png = bytesOf(pngInput); assertDimensions(width, height, 'Icon'); if (width > 256 || height > 256 || !starts(png, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) throw new Error('ICO output requires a valid PNG image no larger than 256 × 256.');
    const output = new Uint8Array(22 + png.length); const view = new DataView(output.buffer); view.setUint16(2, 1, true); view.setUint16(4, 1, true); output[6] = width === 256 ? 0 : width; output[7] = height === 256 ? 0 : height; view.setUint16(10, 1, true); view.setUint16(12, 32, true); view.setUint32(14, png.length, true); view.setUint32(18, 22, true); output.set(png, 22); return output;
  }

  function sanitizeSvg(text, DOMParserCtor, XMLSerializerCtor) {
    const source = String(text || ''); const size = new TextEncoder().encode(source).length;
    if (!source.trim()) throw new Error('The SVG is empty.'); if (size > MAX_SVG_BYTES) throw new Error('SVG input is limited to 2 MB.'); if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG document types and entities are not allowed.');
    const parser = new DOMParserCtor(); const document = parser.parseFromString(source, 'image/svg+xml'); if (document.querySelector('parsererror') || document.documentElement?.localName !== 'svg') throw new Error('The SVG markup is malformed.');
    const allowedElements = new Set(['svg', 'g', 'defs', 'linearGradient', 'radialGradient', 'stop', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'title', 'desc']);
    const allowedAttributes = new Set(['xmlns', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'transform', 'id', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dx', 'dy', 'offset', 'stop-color', 'stop-opacity']);
    for (const element of document.querySelectorAll('*')) { if (!allowedElements.has(element.localName)) throw new Error(`SVG element <${element.localName}> is not allowed in the secure rasterizer.`); for (const attribute of [...element.attributes]) { const value = attribute.value; const namespaceDeclaration = attribute.name === 'xmlns' && value === 'http://www.w3.org/2000/svg'; if (!allowedAttributes.has(attribute.name) || /^on/i.test(attribute.name) || (!namespaceDeclaration && /(?:javascript:|data:|https?:|url\s*\()/i.test(value))) throw new Error(`SVG attribute ${attribute.name} is not allowed in the secure rasterizer.`); } }
    const root = document.documentElement; const numeric = value => { const match = String(value || '').trim().match(/^([0-9]+(?:\.[0-9]+)?)(?:px)?$/); return match ? Number(match[1]) : 0; }; const viewBox = String(root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number); let width = numeric(root.getAttribute('width')); let height = numeric(root.getAttribute('height')); if ((!width || !height) && viewBox.length === 4 && viewBox.every(Number.isFinite)) { width ||= Math.abs(viewBox[2]); height ||= Math.abs(viewBox[3]); } assertDimensions(Math.round(width), Math.round(height), 'SVG'); root.setAttribute('width', String(Math.round(width))); root.setAttribute('height', String(Math.round(height))); return { text: new XMLSerializerCtor().serializeToString(document), width: Math.round(width), height: Math.round(height), pages: 1, animated: false };
  }

  function hasAlpha(rgbaInput) { const rgba = bytesOf(rgbaInput); for (let index = 3; index < rgba.length; index += 4) if (rgba[index] < 255) return true; return false; }
  function outputOptions(inputFormat, capabilities = {}) { return Object.entries(OUTPUTS).filter(([format]) => format !== inputFormat && (format !== 'webp' || capabilities.webp !== false) && (format !== 'gif' || capabilities.gif !== false)).map(([format, value]) => ({ format, ...value })); }
  function verifyOutput(input, format) { const bytes = bytesOf(input); if (format === 'jpeg') return starts(bytes, [0xff, 0xd8, 0xff]); if (format === 'png') return starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); if (format === 'webp') return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP'; if (format === 'gif') return bytes.length >= 6 && /GIF8[79]a/.test(ascii(bytes, 0, 6)); if (format === 'bmp') return starts(bytes, [0x42, 0x4d]); if (format === 'tiff') return starts(bytes, [0x49, 0x49, 0x2a, 0x00]) || starts(bytes, [0x4d, 0x4d, 0x00, 0x2a]); if (format === 'ico') return starts(bytes, [0x00, 0x00, 0x01, 0x00]); return false; }

  global.GxaImageConverterCore = Object.freeze({ MAX_BYTES, MAX_SVG_BYTES, MAX_DIMENSION, MAX_PIXELS, MIME, LABEL, EXTENSIONS, SUPPORTED_INPUTS, OUTPUTS, detect, detectSignature, detectAnimation, assertDimensions, decodeBmp, encodeBmp, decodeTiff, encodeTiff, parseIco, encodeIco, sanitizeSvg, hasAlpha, outputOptions, verifyOutput, applyOrientation });
})(typeof window !== 'undefined' ? window : globalThis);
