import { captureAlpha } from './maskHistory';
import { getContext } from '../utils/canvas';
import { refineAlpha, type RefineSettings } from '../workers/maskAlgorithms';

let worker: Worker | null = null;

function writeAlpha(canvas: HTMLCanvasElement, alpha: Uint8ClampedArray): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const context = getContext(output, true);
  const image = context.createImageData(output.width, output.height);
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    image.data[offset] = 255;
    image.data[offset + 1] = 255;
    image.data[offset + 2] = 255;
    image.data[offset + 3] = alpha[index];
  }
  context.putImageData(image, 0, 0);
  return output;
}

export async function refineMask(canvas: HTMLCanvasElement, settings: RefineSettings): Promise<HTMLCanvasElement> {
  const alpha = captureAlpha(canvas);
  if (typeof Worker === 'undefined') return writeAlpha(canvas, refineAlpha(alpha, canvas.width, canvas.height, settings));
  worker ||= new Worker(new URL('../workers/mask.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID();
  const result = await new Promise<Uint8ClampedArray>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Mask refinement timed out.')), 30_000);
    const listener = (event: MessageEvent<{ id: string; alpha: Uint8ClampedArray }>) => {
      if (event.data.id !== id) return;
      window.clearTimeout(timeout);
      worker?.removeEventListener('message', listener);
      resolve(event.data.alpha);
    };
    worker?.addEventListener('message', listener);
    worker?.postMessage({ id, alpha, width: canvas.width, height: canvas.height, settings }, [alpha.buffer]);
  });
  return writeAlpha(canvas, result);
}
