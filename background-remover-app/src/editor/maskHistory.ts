import { getContext } from '../utils/canvas';

export interface MaskDelta {
  x: number;
  y: number;
  width: number;
  height: number;
  before: Uint8ClampedArray;
  after: Uint8ClampedArray;
}

export function captureAlpha(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const rgba = getContext(canvas, true).getImageData(0, 0, canvas.width, canvas.height).data;
  const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let source = 3, target = 0; source < rgba.length; source += 4, target += 1) alpha[target] = rgba[source];
  return alpha;
}

export function createMaskDelta(canvas: HTMLCanvasElement, beforeAlpha: Uint8ClampedArray): MaskDelta | null {
  const afterAlpha = captureAlpha(canvas);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < afterAlpha.length; index += 1) {
    if (beforeAlpha[index] === afterAlpha[index]) continue;
    const x = index % canvas.width;
    const y = Math.floor(index / canvas.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY) return null;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const before = new Uint8ClampedArray(width * height);
  const after = new Uint8ClampedArray(width * height);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = (minY + row) * canvas.width + minX;
    before.set(beforeAlpha.subarray(sourceStart, sourceStart + width), row * width);
    after.set(afterAlpha.subarray(sourceStart, sourceStart + width), row * width);
  }
  return { x: minX, y: minY, width, height, before, after };
}

export function applyMaskDelta(canvas: HTMLCanvasElement, delta: MaskDelta, direction: 'before' | 'after'): void {
  const context = getContext(canvas, true);
  const imageData = context.getImageData(delta.x, delta.y, delta.width, delta.height);
  const alpha = delta[direction];
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    imageData.data[offset] = 255;
    imageData.data[offset + 1] = 255;
    imageData.data[offset + 2] = 255;
    imageData.data[offset + 3] = alpha[index];
  }
  context.putImageData(imageData, delta.x, delta.y);
}
