import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

function createBmp(width = 16, height = 16) {
  const stride = Math.ceil(width * 3 / 4) * 4;
  const bytes = Buffer.alloc(54 + stride * height);
  bytes.write('BM'); bytes.writeUInt32LE(bytes.length, 2); bytes.writeUInt32LE(54, 10); bytes.writeUInt32LE(40, 14); bytes.writeInt32LE(width, 18); bytes.writeInt32LE(height, 22); bytes.writeUInt16LE(1, 26); bytes.writeUInt16LE(24, 28); bytes.writeUInt32LE(stride * height, 34);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = 54 + (height - 1 - y) * stride + x * 3;
    bytes[offset] = 180; bytes[offset + 1] = Math.round(255 * y / Math.max(1, height - 1)); bytes[offset + 2] = Math.round(255 * x / Math.max(1, width - 1));
  }
  return bytes;
}

function createTiff(width = 16, height = 16) {
  const entries = 12; const ifdSize = 2 + entries * 12 + 4; const bitsOffset = 8 + ifdSize; const pixelsOffset = bitsOffset + 8; const pixelLength = width * height * 4; const bytes = Buffer.alloc(pixelsOffset + pixelLength);
  bytes.write('II'); bytes.writeUInt16LE(42, 2); bytes.writeUInt32LE(8, 4); bytes.writeUInt16LE(entries, 8); let cursor = 10;
  const entry = (tag, type, count, value) => { bytes.writeUInt16LE(tag, cursor); bytes.writeUInt16LE(type, cursor + 2); bytes.writeUInt32LE(count, cursor + 4); if (type === 3 && count === 1) bytes.writeUInt16LE(value, cursor + 8); else bytes.writeUInt32LE(value, cursor + 8); cursor += 12; };
  entry(256, 4, 1, width); entry(257, 4, 1, height); entry(258, 3, 4, bitsOffset); entry(259, 3, 1, 1); entry(262, 3, 1, 2); entry(273, 4, 1, pixelsOffset); entry(274, 3, 1, 1); entry(277, 3, 1, 4); entry(278, 4, 1, height); entry(279, 4, 1, pixelLength); entry(284, 3, 1, 1); entry(338, 3, 1, 2); bytes.writeUInt32LE(0, cursor); [8, 8, 8, 8].forEach((value, index) => bytes.writeUInt16LE(value, bitsOffset + index * 2));
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const offset = pixelsOffset + (y * width + x) * 4; bytes[offset] = Math.round(255 * x / Math.max(1, width - 1)); bytes[offset + 1] = Math.round(255 * y / Math.max(1, height - 1)); bytes[offset + 2] = 180; bytes[offset + 3] = (x + y) % 5 ? 255 : 80; }
  return bytes;
}

function createIco(png) {
  const bytes = Buffer.alloc(22 + png.length); bytes.writeUInt16LE(1, 2); bytes.writeUInt16LE(1, 4); bytes[6] = 16; bytes[7] = 16; bytes.writeUInt16LE(1, 10); bytes.writeUInt16LE(32, 12); bytes.writeUInt32LE(png.length, 14); bytes.writeUInt32LE(22, 18); png.copy(bytes, 22); return bytes;
}

function createCur(png) {
  const bytes = createIco(png); bytes.writeUInt16LE(2, 2); return bytes;
}

const avif = Buffer.from('AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAOwAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAABAAAAAMAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAQ21kYXQSAAoIGAR5ogIaDQgyLRPHh4ZlAYYYfhVVAAD2by4cc25N3+t7Mt8Um1dHRYsFZ8IdzPPbasNZcG8rgA==', 'base64');

export async function createImageConverterFixtures() {
  const [jpeg, png, transparentPng, webp, gif, svgText] = await Promise.all(['sample.jpg', 'small.png', 'transparent.png', 'sample.webp', 'sample.gif', 'sample.svg'].map(name => readFile(join(directory, name))));
  return {
    'fixture.jpg': { mime: 'image/jpeg', bytes: jpeg, width: 1, height: 1 },
    'fixture.png': { mime: 'image/png', bytes: png, width: 16, height: 16 },
    'transparent.png': { mime: 'image/png', bytes: transparentPng, width: 512, height: 512 },
    'fixture.webp': { mime: 'image/webp', bytes: webp, width: 1, height: 1 },
    'animated.gif': { mime: 'image/gif', bytes: gif, width: 16, height: 16 },
    'fixture.bmp': { mime: 'image/bmp', bytes: createBmp(), width: 16, height: 16 },
    'fixture.tiff': { mime: 'image/tiff', bytes: createTiff(), width: 16, height: 16 },
    'fixture.svg': { mime: 'image/svg+xml', bytes: svgText, width: 320, height: 180 },
    'fixture.avif': { mime: 'image/avif', bytes: avif, width: 4, height: 3 },
    'fixture.ico': { mime: 'image/x-icon', bytes: createIco(png), width: 16, height: 16 },
    'fixture.cur': { mime: 'image/x-icon', bytes: createCur(png), width: 16, height: 16 },
    'renamed.jpg': { mime: 'image/jpeg', bytes: png, width: 16, height: 16 },
    'unsupported.heic': { mime: 'image/heic', bytes: Buffer.from('00000018667479706865696300000000686569636d696631', 'hex') }
  };
}
