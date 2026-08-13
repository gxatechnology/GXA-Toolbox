/*
 * Small route-local GIF87a/GIF89a decoder. It validates bounded input,
 * composites disposal-aware RGBA frames, and never allocates before limits run.
 */
(function () {
  'use strict';

  function decode(bytes, options = {}) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const limits = {
      maximumBytes: Math.max(1, Number(options.maximumBytes) || 50 * 1024 * 1024),
      maximumDimension: Math.max(1, Number(options.maximumDimension) || 4096),
      maximumFramePixels: Math.max(1, Number(options.maximumFramePixels) || 12_000_000),
      maximumTotalPixels: Math.max(1, Number(options.maximumTotalPixels) || 24_000_000),
      maximumFrames: Math.max(1, Number(options.maximumFrames) || 120)
    };
    if (data.length > limits.maximumBytes) throw new Error('This GIF exceeds the safe browser file-size limit.');
    let offset = 0;
    const byte = () => {
      if (offset >= data.length) throw new Error('The GIF ended unexpectedly.');
      return data[offset++];
    };
    const word = () => byte() | (byte() << 8);
    const string = length => {
      if (offset + length > data.length) throw new Error('The GIF ended unexpectedly.');
      const value = String.fromCharCode(...data.slice(offset, offset + length));
      offset += length;
      return value;
    };
    const signature = string(6);
    if (signature !== 'GIF87a' && signature !== 'GIF89a') throw new Error('The selected file is not a valid GIF image.');
    const width = word();
    const height = word();
    if (!width || !height || width > limits.maximumDimension || height > limits.maximumDimension) throw new Error(`GIF dimensions must be between 1 and ${limits.maximumDimension} pixels.`);
    const logicalPixels = width * height;
    if (logicalPixels > limits.maximumFramePixels) throw new Error('The GIF logical screen exceeds the safe browser pixel limit.');
    const packed = byte();
    const backgroundIndex = byte();
    byte();
    const readPalette = size => {
      if (offset + size * 3 > data.length) throw new Error('The GIF color table is truncated.');
      const colors = [];
      for (let index = 0; index < size; index += 1) colors.push([byte(), byte(), byte()]);
      return colors;
    };
    const globalPalette = packed & 0x80 ? readPalette(1 << ((packed & 7) + 1)) : [];
    const background = globalPalette[backgroundIndex] || [0, 0, 0];
    const readBlocks = () => {
      const chunks = [];
      let total = 0;
      for (let size = byte(); size > 0; size = byte()) {
        if (offset + size > data.length) throw new Error('The GIF data blocks are truncated.');
        const chunk = data.slice(offset, offset + size);
        offset += size;
        chunks.push(chunk);
        total += size;
      }
      const joined = new Uint8Array(total);
      let cursor = 0;
      chunks.forEach(chunk => { joined.set(chunk, cursor); cursor += chunk.length; });
      return joined;
    };
    const lzw = (minimumCodeSize, compressed, expectedSize) => {
      if (minimumCodeSize < 2 || minimumCodeSize > 8) throw new Error('The GIF uses an invalid LZW code size.');
      const clear = 1 << minimumCodeSize;
      const end = clear + 1;
      let codeSize = minimumCodeSize + 1;
      let dictionary = [];
      let bit = 0;
      const reset = () => {
        dictionary = Array.from({ length: clear }, (_, index) => [index]);
        dictionary[clear] = [];
        dictionary[end] = null;
        codeSize = minimumCodeSize + 1;
      };
      const readCode = () => {
        let code = 0;
        for (let index = 0; index < codeSize; index += 1) {
          const source = bit + index;
          code |= ((compressed[source >> 3] >> (source & 7)) & 1) << index;
        }
        bit += codeSize;
        return code;
      };
      const output = [];
      let previous = null;
      reset();
      while (bit + codeSize <= compressed.length * 8 && output.length < expectedSize) {
        const code = readCode();
        if (code === clear) { reset(); previous = null; continue; }
        if (code === end) break;
        let entry = dictionary[code];
        if (!entry && code === dictionary.length && previous) entry = previous.concat(previous[0]);
        if (!entry) throw new Error('The GIF frame contains invalid LZW data.');
        for (const value of entry) {
          if (output.length >= expectedSize) throw new Error('The GIF frame expands beyond its declared dimensions.');
          output.push(value);
        }
        if (previous && dictionary.length < 4096) {
          dictionary.push(previous.concat(entry[0]));
          if (dictionary.length === (1 << codeSize) && codeSize < 12) codeSize += 1;
        }
        previous = entry;
      }
      if (output.length !== expectedSize) throw new Error('The GIF frame contains incomplete LZW pixel data.');
      return output;
    };
    const deinterlace = (pixels, rowWidth, rowCount) => {
      const output = new Array(pixels.length);
      let sourceRow = 0;
      [[0, 8], [4, 8], [2, 4], [1, 2]].forEach(([start, step]) => {
        for (let targetRow = start; targetRow < rowCount; targetRow += step) {
          const sourceOffset = sourceRow * rowWidth;
          const targetOffset = targetRow * rowWidth;
          for (let column = 0; column < rowWidth; column += 1) output[targetOffset + column] = pixels[sourceOffset + column];
          sourceRow += 1;
        }
      });
      return output;
    };
    const canvas = new Uint8ClampedArray(logicalPixels * 4);
    const initialAlpha = globalPalette.length ? 255 : 0;
    for (let index = 0; index < logicalPixels; index += 1) canvas.set([background[0], background[1], background[2], initialAlpha], index * 4);
    const frames = [];
    let control = { delay: 100, disposal: 0, transparent: false, transparentIndex: 0 };
    let previousRestore = null;
    let previousRect = null;
    let previousDisposal = 0;
    let previousBackgroundAlpha = initialAlpha;
    let terminated = false;
    while (offset < data.length) {
      const marker = byte();
      if (marker === 0x3b) { terminated = true; break; }
      if (marker === 0x21) {
        const label = byte();
        if (label === 0xf9) {
          if (byte() !== 4) throw new Error('The GIF graphic-control block is malformed.');
          const flags = byte();
          control = { delay: word() * 10 || 100, disposal: (flags >> 2) & 7, transparent: !!(flags & 1), transparentIndex: byte() };
          if (byte() !== 0) throw new Error('The GIF graphic-control block is malformed.');
        } else {
          readBlocks();
        }
        continue;
      }
      if (marker !== 0x2c) throw new Error('The GIF contains an unsupported block.');
      if (previousDisposal === 2 && previousRect) {
        for (let y = previousRect.top; y < previousRect.top + previousRect.height; y += 1) {
          for (let x = previousRect.left; x < previousRect.left + previousRect.width; x += 1) {
            const position = (y * width + x) * 4;
            canvas.set([background[0], background[1], background[2], previousBackgroundAlpha], position);
          }
        }
      } else if (previousDisposal === 3 && previousRestore) {
        canvas.set(previousRestore);
      }
      const left = word();
      const top = word();
      const frameWidth = word();
      const frameHeight = word();
      if (!frameWidth || !frameHeight || left + frameWidth > width || top + frameHeight > height) throw new Error('A GIF frame lies outside the logical screen.');
      if (frameWidth * frameHeight > limits.maximumFramePixels) throw new Error('A GIF frame exceeds the safe browser pixel limit.');
      if ((frames.length + 1) * logicalPixels > limits.maximumTotalPixels) throw new Error('This animation exceeds the safe browser frame pixel budget.');
      if (frames.length >= limits.maximumFrames) throw new Error(`This GIF contains more than ${limits.maximumFrames} frames.`);
      const framePacked = byte();
      const palette = framePacked & 0x80 ? readPalette(1 << ((framePacked & 7) + 1)) : globalPalette;
      if (!palette.length) throw new Error('The GIF frame has no usable color table.');
      const restore = control.disposal === 3 ? canvas.slice() : null;
      const minimumCodeSize = byte();
      let indices = lzw(minimumCodeSize, readBlocks(), frameWidth * frameHeight);
      if (framePacked & 0x40) indices = deinterlace(indices, frameWidth, frameHeight);
      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          const paletteIndex = indices[y * frameWidth + x];
          if (control.transparent && paletteIndex === control.transparentIndex) continue;
          const color = palette[paletteIndex];
          if (!color) throw new Error('The GIF frame references a missing palette color.');
          const position = ((top + y) * width + left + x) * 4;
          canvas.set([color[0], color[1], color[2], 255], position);
        }
      }
      frames.push({ rgba: canvas.slice(), delay: control.delay });
      previousRestore = restore;
      previousRect = { left, top, width: frameWidth, height: frameHeight };
      previousDisposal = control.disposal;
      previousBackgroundAlpha = control.transparent && control.transparentIndex === backgroundIndex ? 0 : initialAlpha;
      control = { delay: 100, disposal: 0, transparent: false, transparentIndex: 0 };
    }
    if (!terminated) throw new Error('The GIF is missing its trailer marker.');
    if (!frames.length) throw new Error('No image frames were found in this GIF.');
    return { width, height, frames };
  }

  window.GxaGifDecoder = Object.freeze({ decode });
})();
