export interface RefineSettings {
  smooth: number;
  feather: number;
  expand: number;
  shiftEdge: number;
  defringe: number;
  edgeContrast: number;
}

function morphology(source: Uint8ClampedArray<ArrayBufferLike>, width: number, height: number, radius: number, expand: boolean): Uint8ClampedArray<ArrayBuffer> {
  if (radius <= 0) return new Uint8ClampedArray(source);
  const output = new Uint8ClampedArray(source.length);
  const capped = Math.min(12, Math.max(1, Math.round(radius)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = expand ? 0 : 255;
      for (let yy = Math.max(0, y - capped); yy <= Math.min(height - 1, y + capped); yy += 1) {
        for (let xx = Math.max(0, x - capped); xx <= Math.min(width - 1, x + capped); xx += 1) {
          const sample = source[yy * width + xx];
          value = expand ? Math.max(value, sample) : Math.min(value, sample);
        }
      }
      output[y * width + x] = value;
    }
  }
  return output;
}

function blur(source: Uint8ClampedArray<ArrayBufferLike>, width: number, height: number, radius: number): Uint8ClampedArray<ArrayBuffer> {
  if (radius <= 0) return new Uint8ClampedArray(source);
  const output = new Uint8ClampedArray(source.length);
  const capped = Math.min(10, Math.max(1, Math.round(radius)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let yy = Math.max(0, y - capped); yy <= Math.min(height - 1, y + capped); yy += 1) {
        for (let xx = Math.max(0, x - capped); xx <= Math.min(width - 1, x + capped); xx += 1) {
          sum += source[yy * width + xx];
          count += 1;
        }
      }
      output[y * width + x] = sum / count;
    }
  }
  return output;
}

export function refineAlpha(source: Uint8ClampedArray<ArrayBufferLike>, width: number, height: number, settings: RefineSettings): Uint8ClampedArray<ArrayBuffer> {
  let output = new Uint8ClampedArray(source.length);
  output.set(source);
  if (settings.expand) output = morphology(output, width, height, Math.abs(settings.expand), settings.expand > 0);
  if (settings.shiftEdge) output = morphology(output, width, height, Math.abs(settings.shiftEdge), settings.shiftEdge > 0);
  if (settings.smooth) output = blur(output, width, height, settings.smooth / 12);
  if (settings.feather) output = blur(output, width, height, settings.feather / 8);
  const contrast = 1 + settings.edgeContrast / 60 + settings.defringe / 90;
  if (contrast !== 1) {
    for (let index = 0; index < output.length; index += 1) {
      output[index] = Math.max(0, Math.min(255, (output[index] - 128) * contrast + 128));
    }
  }
  return output;
}
