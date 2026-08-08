import type * as ort from 'onnxruntime-web';
import type { PreprocessResult } from './types';
import { createCanvas, getContext } from '../utils/canvas';

export const MODEL_INPUT_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export function preprocessImage(runtime: typeof ort, image: CanvasImageSource, sourceWidth: number, sourceHeight: number): PreprocessResult {
  const scale = Math.min(MODEL_INPUT_SIZE / sourceWidth, MODEL_INPUT_SIZE / sourceHeight);
  const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
  const padX = Math.floor((MODEL_INPUT_SIZE - drawWidth) / 2);
  const padY = Math.floor((MODEL_INPUT_SIZE - drawHeight) / 2);
  const canvas = createCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const context = getContext(canvas, true);
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, padX, padY, drawWidth, drawHeight);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const plane = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  const values = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    values[index] = (pixels[index * 4] / 255 - MEAN[0]) / STD[0];
    values[plane + index] = (pixels[index * 4 + 1] / 255 - MEAN[1]) / STD[1];
    values[plane * 2 + index] = (pixels[index * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }
  return {
    tensor: new runtime.Tensor('float32', values, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]),
    transform: { sourceWidth, sourceHeight, inputSize: MODEL_INPUT_SIZE, drawWidth, drawHeight, padX, padY }
  };
}
