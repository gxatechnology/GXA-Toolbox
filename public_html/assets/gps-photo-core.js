(function (global) {
  'use strict';

  const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
  const MAX_LOGO_BYTES = 5 * 1024 * 1024;
  const MAX_DIMENSION = 8192;
  const MAX_PIXELS = 24_000_000;

  function bytesOf(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    throw new TypeError('Expected binary image data.');
  }

  function validateCoordinates(latitude, longitude) {
    if ([latitude, longitude].some(value => value === null || value === undefined || String(value).trim() === '')) throw new Error('Choose both latitude and longitude.');
    const lat = Number(latitude); const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('Latitude must be a number from -90 to 90.');
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('Longitude must be a number from -180 to 180.');
    return { latitude: lat, longitude: lon };
  }

  function decimalToDms(value, positive, negative) {
    const absolute = Math.abs(Number(value)); const degrees = Math.floor(absolute); const minutesValue = (absolute - degrees) * 60; const minutes = Math.floor(minutesValue); const seconds = (minutesValue - minutes) * 60;
    return { degrees, minutes, seconds, reference: Number(value) < 0 ? negative : positive };
  }

  function formatDecimal(value, positive, negative) { return `${Math.abs(Number(value)).toFixed(6)}° ${Number(value) < 0 ? negative : positive}`; }
  function formatDms(value, positive, negative) { const dms = decimalToDms(value, positive, negative); return `${dms.degrees}°${dms.minutes}'${dms.seconds.toFixed(2)}\"${dms.reference}`; }

  function isJpeg(input) { const bytes = bytesOf(input); return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9; }

  function jpegSegments(input) {
    const bytes = bytesOf(input); if (!isJpeg(bytes)) throw new Error('GPS metadata operations require a valid JPEG image.');
    const segments = []; let offset = 2;
    while (offset < bytes.length) {
      const start = offset; if (bytes[offset] !== 0xff) throw new Error('The JPEG marker stream is malformed.');
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xda) { segments.push({ marker, start, end: bytes.length, dataStart: offset, scan: true }); return segments; }
      if (marker === 0xd9) { segments.push({ marker, start, end: offset, dataStart: offset }); return segments; }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { segments.push({ marker, start, end: offset, dataStart: offset }); continue; }
      if (offset + 2 > bytes.length) throw new Error('The JPEG segment length is truncated.');
      const length = bytes[offset] * 256 + bytes[offset + 1]; if (length < 2 || offset + length > bytes.length) throw new Error('The JPEG segment is truncated.');
      segments.push({ marker, start, end: offset + length, dataStart: offset + 2 }); offset += length;
    }
    throw new Error('The JPEG does not contain a complete scan or end marker.');
  }

  function isExifSegment(bytes, segment) { return segment.marker === 0xe1 && segment.dataStart + 6 <= segment.end && String.fromCharCode(...bytes.slice(segment.dataStart, segment.dataStart + 6)) === 'Exif\0\0'; }

  function parseExifSegment(bytes, segment) {
    const tiffStart = segment.dataStart + 6; const tiffLength = segment.end - tiffStart; if (tiffLength < 8) throw new Error('The EXIF TIFF header is truncated.');
    const little = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49; const big = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d; if (!little && !big) throw new Error('The EXIF byte order is invalid.');
    const view = new DataView(bytes.buffer, bytes.byteOffset + tiffStart, tiffLength);
    const u16 = offset => { if (offset < 0 || offset + 2 > tiffLength) throw new Error('The EXIF directory is truncated.'); return view.getUint16(offset, little); };
    const u32 = offset => { if (offset < 0 || offset + 4 > tiffLength) throw new Error('The EXIF directory is truncated.'); return view.getUint32(offset, little); };
    if (u16(2) !== 42) throw new Error('The EXIF TIFF signature is invalid.');
    const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    function readIfd(ifdOffset) {
      const count = u16(ifdOffset); if (count > 256 || ifdOffset + 2 + count * 12 + 4 > tiffLength) throw new Error('The EXIF directory is unsafe or truncated.'); const entries = new Map();
      for (let index = 0; index < count; index += 1) { const offset = ifdOffset + 2 + index * 12; const tag = u16(offset); const type = u16(offset + 2); const length = u32(offset + 4); const unit = typeSize[type]; if (!unit || length > 4096) continue; const total = unit * length; const dataOffset = total <= 4 ? offset + 8 : u32(offset + 8); if (dataOffset < 0 || dataOffset + total > tiffLength) continue; entries.set(tag, { type, count: length, dataOffset, total }); }
      return entries;
    }
    const ascii = entry => entry ? String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + entry.dataOffset, entry.total)).replace(/\0.*$/, '').trim() : '';
    const number = entry => { if (!entry) return null; if (entry.type === 1) return view.getUint8(entry.dataOffset); if (entry.type === 3) return u16(entry.dataOffset); if (entry.type === 4) return u32(entry.dataOffset); return null; };
    const rationals = entry => { if (!entry || entry.type !== 5) return []; const values = []; for (let index = 0; index < entry.count; index += 1) { const numerator = u32(entry.dataOffset + index * 8); const denominator = u32(entry.dataOffset + index * 8 + 4); values.push(denominator ? numerator / denominator : 0); } return values; };
    const coordinate = (values, reference) => { if (values.length !== 3 || !reference) return null; const decimal = values[0] + values[1] / 60 + values[2] / 3600; return /[SW]/i.test(reference) ? -decimal : decimal; };
    const root = readIfd(u32(4)); const gpsPointer = number(root.get(0x8825)); const exifPointer = number(root.get(0x8769)); let gps = null; let dateTimeOriginal = '';
    if (exifPointer) { const exif = readIfd(exifPointer); dateTimeOriginal = ascii(exif.get(0x9003)) || ascii(exif.get(0x9004)); }
    if (gpsPointer) {
      const directory = readIfd(gpsPointer); const latitude = coordinate(rationals(directory.get(2)), ascii(directory.get(1))); const longitude = coordinate(rationals(directory.get(4)), ascii(directory.get(3)));
      if (latitude !== null && longitude !== null) { const altitudeValues = rationals(directory.get(6)); const altitudeRef = number(directory.get(5)) || 0; const time = rationals(directory.get(7)); gps = { latitude, longitude, altitude: altitudeValues.length ? altitudeValues[0] * (altitudeRef ? -1 : 1) : null, dateStamp: ascii(directory.get(29)), timeStamp: time.length === 3 ? time : null }; }
    }
    return { gps, dateTimeOriginal };
  }

  function inspectJpeg(input) {
    const bytes = bytesOf(input); const segments = jpegSegments(bytes); let foundExif = false; let gps = null; let dateTimeOriginal = '';
    for (const segment of segments) {
      if (!isExifSegment(bytes, segment)) continue; foundExif = true;
      try { const parsed = parseExifSegment(bytes, segment); gps ||= parsed.gps; dateTimeOriginal ||= parsed.dateTimeOriginal; } catch (_) { /* A malformed optional EXIF block must not expose unsafe data. */ }
    }
    return { isJpeg: true, hasExif: foundExif, hasGps: Boolean(gps), gps, dateTimeOriginal };
  }

  function withoutExif(input) {
    const bytes = bytesOf(input); const segments = jpegSegments(bytes); const chunks = [bytes.slice(0, 2)];
    for (const segment of segments) if (!isExifSegment(bytes, segment)) chunks.push(bytes.slice(segment.start, segment.end));
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0); const output = new Uint8Array(total); let offset = 0; chunks.forEach(chunk => { output.set(chunk, offset); offset += chunk.length; }); return output;
  }

  function buildGpsExif(location, dateValue = new Date()) {
    const { latitude, longitude } = validateCoordinates(location.latitude, location.longitude); const altitude = location.altitude === '' || location.altitude === null || location.altitude === undefined ? null : Number(location.altitude); if (altitude !== null && (!Number.isFinite(altitude) || Math.abs(altitude) > 20_000)) throw new Error('Altitude must be between -20,000 and 20,000 metres.');
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue); if (Number.isNaN(date.getTime())) throw new Error('Choose a valid stamp date and time.');
    const latDms = decimalToDms(latitude, 'N', 'S'); const lonDms = decimalToDms(longitude, 'E', 'W'); const entryCount = altitude === null ? 7 : 9; const gpsOffset = 26; const dataStart = gpsOffset + 2 + entryCount * 12 + 4; const tiff = new Uint8Array(dataStart + 96); const view = new DataView(tiff.buffer); tiff.set([0x49, 0x49, 0x2a, 0x00]); view.setUint32(4, 8, true); view.setUint16(8, 1, true); view.setUint16(10, 0x8825, true); view.setUint16(12, 4, true); view.setUint32(14, 1, true); view.setUint32(18, gpsOffset, true); view.setUint32(22, 0, true); view.setUint16(gpsOffset, entryCount, true);
    let entryOffset = gpsOffset + 2; let dataOffset = dataStart;
    const entry = (tag, type, count, inline, dataWriter) => { view.setUint16(entryOffset, tag, true); view.setUint16(entryOffset + 2, type, true); view.setUint32(entryOffset + 4, count, true); if (inline) tiff.set(inline, entryOffset + 8); else { view.setUint32(entryOffset + 8, dataOffset, true); const length = dataWriter(dataOffset); dataOffset += length; } entryOffset += 12; };
    const rationalWriter = values => offset => { values.forEach(([numerator, denominator], index) => { view.setUint32(offset + index * 8, numerator, true); view.setUint32(offset + index * 8 + 4, denominator, true); }); return values.length * 8; };
    const dmsRationals = dms => [[dms.degrees, 1], [dms.minutes, 1], [Math.round(dms.seconds * 1_000_000), 1_000_000]];
    entry(0, 1, 4, new Uint8Array([2, 3, 0, 0])); entry(1, 2, 2, new Uint8Array([latDms.reference.charCodeAt(0), 0])); entry(2, 5, 3, null, rationalWriter(dmsRationals(latDms))); entry(3, 2, 2, new Uint8Array([lonDms.reference.charCodeAt(0), 0])); entry(4, 5, 3, null, rationalWriter(dmsRationals(lonDms)));
    if (altitude !== null) { entry(5, 1, 1, new Uint8Array([altitude < 0 ? 1 : 0])); entry(6, 5, 1, null, rationalWriter([[Math.round(Math.abs(altitude) * 100), 100]])); }
    entry(7, 5, 3, null, rationalWriter([[date.getUTCHours(), 1], [date.getUTCMinutes(), 1], [date.getUTCSeconds() * 1000 + date.getUTCMilliseconds(), 1000]])); const dateStamp = `${date.getUTCFullYear()}:${String(date.getUTCMonth() + 1).padStart(2, '0')}:${String(date.getUTCDate()).padStart(2, '0')}\0`; entry(29, 2, dateStamp.length, null, offset => { for (let index = 0; index < dateStamp.length; index += 1) tiff[offset + index] = dateStamp.charCodeAt(index); return dateStamp.length; }); view.setUint32(entryOffset, 0, true);
    const payload = new Uint8Array(6 + dataOffset); payload.set([0x45, 0x78, 0x69, 0x66, 0, 0]); payload.set(tiff.slice(0, dataOffset), 6); return payload;
  }

  function insertGps(input, location, dateValue) {
    const source = withoutExif(input); const exif = buildGpsExif(location, dateValue); const segmentLength = exif.length + 2; if (segmentLength > 0xffff) throw new Error('The generated EXIF block is too large.'); const output = new Uint8Array(source.length + exif.length + 4); output.set(source.slice(0, 2)); output.set([0xff, 0xe1, segmentLength >> 8, segmentLength & 255], 2); output.set(exif, 6); output.set(source.slice(2), 6 + exif.length); if (!isJpeg(output)) throw new Error('The GPS-tagged JPEG is invalid.'); return output;
  }

  function removeGps(input) { const output = withoutExif(input); if (!isJpeg(output)) throw new Error('The cleaned JPEG is invalid.'); return output; }
  function assertImageLimits(size, width, height) { if (!Number.isFinite(size) || size < 1 || size > MAX_IMAGE_BYTES) throw new Error('Photo size must be between 1 byte and 30 MB.'); if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) throw new Error('Photo dimensions exceed the safe 8,192 pixel or 24 megapixel limit.'); }

  global.GxaGpsPhotoCore = Object.freeze({ MAX_IMAGE_BYTES, MAX_LOGO_BYTES, MAX_DIMENSION, MAX_PIXELS, validateCoordinates, decimalToDms, formatDecimal, formatDms, isJpeg, inspectJpeg, insertGps, removeGps, buildGpsExif, assertImageLimits });
})(typeof window !== 'undefined' ? window : globalThis);
