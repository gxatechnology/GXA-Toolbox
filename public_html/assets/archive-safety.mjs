// Check declared directory limits before decompression/CRC. Dishonest ZIP metadata
// still requires a bounded streaming inflater; this is defense in depth only.
export function inspectZipDirectory(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length > 100 * 1024 * 1024 || bytes.length < 22) throw new Error('ZIP is empty, truncated, or exceeds 100 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('ZIP central directory is missing.');
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count === 65535 || start === 0xffffffff || size === 0xffffffff) throw new Error('Split and ZIP64 archives are outside the browser safety limits.');
  if (count > 2000 || count !== view.getUint16(end + 8, true) || start + size !== end) throw new Error('ZIP directory exceeds limits or is inconsistent.');
  let offset = start, expanded = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ZIP directory entry.');
    const compressed = view.getUint32(offset + 20, true), uncompressed = view.getUint32(offset + 24, true);
    const length = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true);
    const next = offset + 46 + length + extra + comment;
    if (next > end || (view.getUint16(offset + 8, true) & 1)) throw new Error('Encrypted or malformed ZIP entries are unsupported.');
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + length)).replace(/\\/g, '/');
    if (!name || name.includes('\0') || name.startsWith('/') || /^[a-z]:/i.test(name) || name.split('/').includes('..')) throw new Error('ZIP contains an unsafe entry path.');
    expanded += uncompressed;
    if (uncompressed > 64 * 1024 * 1024 || expanded > 128 * 1024 * 1024 || uncompressed / Math.max(1, compressed) > 200) throw new Error('ZIP expansion exceeds safe entry, total-size, or compression-ratio limits.');
    offset = next;
  }
  if (offset !== end) throw new Error('ZIP entry count does not match its directory.');
  return { entries: count, expandedBytes: expanded };
}
