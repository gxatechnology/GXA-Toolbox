import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public_html/assets/gps-photo-core.js', import.meta.url), 'utf8');
const context = vm.createContext({ Uint8Array, ArrayBuffer, DataView, Date, Math, Number, String, Map, Object, TypeError, Error });
context.globalThis = context;
vm.runInContext(source, context);
const core = context.GxaGpsPhotoCore;
const jpeg = new Uint8Array(await readFile(new URL('./fixtures/sample.jpg', import.meta.url)));

function segment(bytes, markerWanted) {
  let offset = 2;
  while (offset < bytes.length) {
    const start = offset;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === markerWanted) return { start, data: offset };
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    const length = bytes[offset] * 256 + bytes[offset + 1]; offset += length;
  }
  return null;
}

function jpegDimensions(bytes) {
  let offset = 2;
  while (offset < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [bytes[offset + 5] * 256 + bytes[offset + 6], bytes[offset + 3] * 256 + bytes[offset + 4]];
    offset += length;
  }
  throw new Error('No JPEG frame dimensions.');
}

function independentGps(bytes) {
  let offset = 2;
  while (offset < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    const payload = offset + 2;
    if (marker === 0xe1 && String.fromCharCode(...bytes.slice(payload, payload + 6)) === 'Exif\0\0') {
      const tiff = payload + 6; const view = new DataView(bytes.buffer, bytes.byteOffset + tiff, length - 8); const little = bytes[tiff] === 0x49; const u16 = at => view.getUint16(at, little); const u32 = at => view.getUint32(at, little); const root = u32(4); const rootCount = u16(root); let gpsOffset = 0;
      for (let index = 0; index < rootCount; index += 1) { const entry = root + 2 + index * 12; if (u16(entry) === 0x8825) gpsOffset = u32(entry + 8); }
      if (!gpsOffset) return null; const gpsCount = u16(gpsOffset); const entries = new Map();
      for (let index = 0; index < gpsCount; index += 1) { const entry = gpsOffset + 2 + index * 12; entries.set(u16(entry), { type: u16(entry + 2), count: u32(entry + 4), offset: entry + 8, pointer: u32(entry + 8) }); }
      const ascii = tag => { const item = entries.get(tag); const start = item.count <= 4 ? item.offset : item.pointer; return String.fromCharCode(...bytes.slice(tiff + start, tiff + start + item.count)).replace(/\0/g, ''); };
      const rationals = tag => { const item = entries.get(tag); return Array.from({ length: item.count }, (_, index) => { const at = item.pointer + index * 8; return u32(at) / u32(at + 4); }); };
      const decimal = (tag, reference) => { const values = rationals(tag); const value = values[0] + values[1] / 60 + values[2] / 3600; return /[SW]/.test(reference) ? -value : value; };
      return { latitudeRef: ascii(1), latitude: decimal(2, ascii(1)), longitudeRef: ascii(3), longitude: decimal(4, ascii(3)), time: rationals(7), date: ascii(29) };
    }
    offset += length;
  }
  return null;
}

assert.equal(core.isJpeg(jpeg), true);
assert.equal(core.inspectJpeg(jpeg).hasGps, false);
const originalDimensions = jpegDimensions(jpeg);
assert.deepEqual(originalDimensions, [1, 1]);
assert.deepEqual({ ...core.validateCoordinates(90, -180) }, { latitude: 90, longitude: -180 });
assert.throws(() => core.validateCoordinates(90.0001, 0), /Latitude/);
assert.throws(() => core.validateCoordinates(0, -180.0001), /Longitude/);
assert.throws(() => core.validateCoordinates('not-a-number', 0), /Latitude/);

const northEast = core.insertGps(jpeg, { latitude: 28.613939, longitude: 77.209021, altitude: 216.5 }, new Date('2026-09-06T10:12:14.500Z'));
const independentlyParsed = independentGps(northEast);
assert.equal(independentlyParsed.latitudeRef, 'N');
assert.equal(independentlyParsed.longitudeRef, 'E');
assert.ok(Math.abs(independentlyParsed.latitude - 28.613939) < 1e-7);
assert.ok(Math.abs(independentlyParsed.longitude - 77.209021) < 1e-7);
assert.deepEqual(independentlyParsed.time, [10, 12, 14.5]);
assert.equal(independentlyParsed.date, '2026:09:06');
assert.deepEqual(jpegDimensions(northEast), originalDimensions);
assert.deepEqual(northEast.slice(segment(northEast, 0xda).start), jpeg.slice(segment(jpeg, 0xda).start), 'Metadata-only insertion must preserve the compressed JPEG scan bytes.');

const southWest = core.insertGps(northEast, { latitude: -33.86882, longitude: -151.209296 }, '2025-12-31T23:59:58.000Z');
const replacement = core.inspectJpeg(southWest);
assert.equal(replacement.hasGps, true);
assert.ok(Math.abs(replacement.gps.latitude + 33.86882) < 1e-7);
assert.ok(Math.abs(replacement.gps.longitude + 151.209296) < 1e-7);
const independentlyReplaced = independentGps(southWest);
assert.equal(independentlyReplaced.latitudeRef, 'S');
assert.equal(independentlyReplaced.longitudeRef, 'W');
assert.equal((Buffer.from(southWest).toString('binary').match(/Exif\0\0/g) || []).length, 1, 'Replacement must leave one EXIF block.');

const removed = core.removeGps(southWest);
assert.equal(core.inspectJpeg(removed).hasGps, false);
assert.equal(core.inspectJpeg(removed).hasExif, false);
assert.deepEqual(removed.slice(segment(removed, 0xda).start), jpeg.slice(segment(jpeg, 0xda).start), 'GPS removal must not recompress pixel scan data.');
assert.throws(() => core.inspectJpeg(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0xff, 0xd9])), /complete scan|malformed/i);
assert.throws(() => core.assertImageLimits(31 * 1024 * 1024, 10, 10), /30 MB/);
assert.throws(() => core.assertImageLimits(100, 9000, 10), /8,192/);
assert.match(core.formatDms(-28.5, 'N', 'S'), /28°30'0\.00"S/);

console.log('GPS photo core passed: valid JPEG, no/existing/replaced/removed GPS, independent EXIF parse, signed references, UTC date/time, coordinate limits, dimensions, and unchanged JPEG scan data.');
