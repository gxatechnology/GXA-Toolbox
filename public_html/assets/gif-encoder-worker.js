import { GIFEncoder, applyPalette, quantize } from './vendor/gifenc/gifenc.esm.js';

let encoder = null;
let width = 0;
let height = 0;
let delay = 500;

self.addEventListener('message', event => {
  const { id, type } = event.data || {};
  try {
    if (type === 'initialize') {
      width = Number(event.data.width);
      height = Number(event.data.height);
      delay = Math.max(20, Math.min(60_000, Number(event.data.delay) || 500));
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 4_000_000) throw new Error('Unsafe GIF output dimensions.');
      encoder = GIFEncoder();
      self.postMessage({ id, ok: true });
      return;
    }
    if (!encoder) throw new Error('The GIF encoder worker has not been initialized.');
    if (type === 'frame') {
      const rgba = new Uint8ClampedArray(event.data.rgba);
      if (rgba.length !== width * height * 4) throw new Error('The GIF frame buffer has an invalid size.');
      const palette = quantize(rgba, 256);
      encoder.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay, repeat: 0 });
      self.postMessage({ id, ok: true });
      return;
    }
    if (type === 'finish') {
      encoder.finish();
      const output = encoder.bytes();
      encoder = null;
      self.postMessage({ id, ok: true, output: output.buffer }, [output.buffer]);
      return;
    }
    throw new Error('Unknown GIF worker operation.');
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
