import type * as ort from 'onnxruntime-web';
import type { LetterboxTransform, SegmentationResult } from './types';
import { createCanvas, getContext } from '../utils/canvas';

type MaskStats = SegmentationResult['stats'];

export function postprocessMask(tensor: ort.Tensor, transform: LetterboxTransform, targetWidth: number, targetHeight: number): { mask: HTMLCanvasElement; stats: MaskStats } {
  const values = tensor.data as Float32Array;
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of values) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const range = Math.max(1e-8, maximum - minimum);
  const source = createCanvas(transform.inputSize, transform.inputSize);
  const sourceContext = getContext(source, true);
  const sourceData = sourceContext.createImageData(source.width, source.height);
  for (let index = 0; index < source.width * source.height; index += 1) {
    const alpha = Math.max(0, Math.min(255, Math.round(((values[index] - minimum) / range) * 255)));
    const offset = index * 4;
    sourceData.data[offset] = 255;
    sourceData.data[offset + 1] = 255;
    sourceData.data[offset + 2] = 255;
    sourceData.data[offset + 3] = alpha < 3 ? 0 : alpha > 252 ? 255 : alpha;
  }
  sourceContext.putImageData(sourceData, 0, 0);

  const cropped = createCanvas(transform.drawWidth, transform.drawHeight);
  getContext(cropped).drawImage(
    source,
    transform.padX,
    transform.padY,
    transform.drawWidth,
    transform.drawHeight,
    0,
    0,
    cropped.width,
    cropped.height
  );

  const mask = createCanvas(targetWidth, targetHeight);
  const context = getContext(mask, true);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(cropped, 0, 0, mask.width, mask.height);
  const pixels = context.getImageData(0, 0, mask.width, mask.height);
  let alphaMinimum = 255;
  let alphaMaximum = 0;
  let alphaSum = 0;
  let transparent = 0;
  let opaque = 0;
  let partial = 0;
  for (let offset = 3; offset < pixels.data.length; offset += 4) {
    const alpha = pixels.data[offset];
    alphaMinimum = Math.min(alphaMinimum, alpha);
    alphaMaximum = Math.max(alphaMaximum, alpha);
    alphaSum += alpha;
    if (alpha <= 4) transparent += 1;
    else if (alpha >= 251) opaque += 1;
    else partial += 1;
  }
  const total = mask.width * mask.height;
  if (alphaMaximum - alphaMinimum < 8 || Math.max(transparent, opaque) / total > 0.999) {
    throw new Error('The model produced a uniform mask. Try a clearer image with a visible foreground subject.');
  }
  return {
    mask,
    stats: {
      minimum: alphaMinimum,
      maximum: alphaMaximum,
      mean: alphaSum / total,
      transparentPercent: transparent / total * 100,
      opaquePercent: opaque / total * 100,
      partialPercent: partial / total * 100
    }
  };
}
