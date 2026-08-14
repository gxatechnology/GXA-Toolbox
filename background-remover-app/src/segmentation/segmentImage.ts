import type { ExecutionProvider } from '../types/editor';
import { fitWithin } from '../utils/canvas';
import { MASK_MAX_SIDE } from '../app/defaults';
import { MODEL_BYTES } from './assetUrls';
import { getBestSession } from './modelManager';
import { initializeOnnxRuntime } from './onnxRuntime';
import { postprocessMask } from './postprocess';
import { MODEL_INPUT_SIZE, preprocessImage } from './preprocess';
import type { SegmentationResult, SegmentationStatus } from './types';

interface SegmentOptions {
  forceProvider?: ExecutionProvider;
  signal?: AbortSignal;
  onStatus?: (status: SegmentationStatus) => void;
}

function outputTensor(outputs: Record<string, import('onnxruntime-web').Tensor>): import('onnxruntime-web').Tensor {
  const first = Object.values(outputs)[0];
  if (!first) throw new Error('The segmentation model returned no output tensor.');
  return first;
}

export async function segmentImage(image: HTMLImageElement, options: SegmentOptions = {}): Promise<SegmentationResult> {
  const started = performance.now();
  const status = options.onStatus || (() => undefined);
  status({ message: 'Loading GXA Vision Model', detail: 'Preparing the GXA Vision Model for private browser processing.' });
  const runtime = await initializeOnnxRuntime(options.signal);
  const sessionRecord = await getBestSession(options.forceProvider, options.signal);
  options.signal?.throwIfAborted();
  status({ message: 'Detecting subject', detail: 'Detecting the foreground subject with the GXA Vision Model.' });
  const preprocessStarted = performance.now();
  const preprocessing = preprocessImage(runtime, image, image.naturalWidth, image.naturalHeight);
  const preprocessMs = performance.now() - preprocessStarted;
  const feeds: Record<string, import('onnxruntime-web').Tensor> = {
    [sessionRecord.session.inputNames[0] || 'input.1']: preprocessing.tensor
  };
  const inferenceStarted = performance.now();
  const outputs = await sessionRecord.session.run(feeds);
  const inferenceMs = performance.now() - inferenceStarted;
  preprocessing.tensor.dispose();
  options.signal?.throwIfAborted();
  status({ message: 'Creating background mask', detail: 'Creating a clean, editable background mask.' });
  const target = fitWithin(image.naturalWidth, image.naturalHeight, MASK_MAX_SIDE);
  const primary = outputTensor(outputs);
  const postprocessStarted = performance.now();
  const processed = postprocessMask(primary, preprocessing.transform, target.width, target.height);
  const postprocessMs = performance.now() - postprocessStarted;
  Object.values(outputs).forEach((tensor) => tensor.dispose());
  const totalMs = performance.now() - started;
  performance.measure('gxa-segmentation-preprocess', { start: preprocessStarted, duration: preprocessMs });
  performance.measure('gxa-segmentation-inference', { start: inferenceStarted, duration: inferenceMs });
  performance.measure('gxa-segmentation-postprocess', { start: postprocessStarted, duration: postprocessMs });
  performance.measure('gxa-segmentation-total', { start: started, duration: totalMs });
  return {
    mask: processed.mask,
    provider: sessionRecord.provider,
    stats: processed.stats,
    metrics: {
      modelBytes: MODEL_BYTES,
      coldLoadMs: sessionRecord.coldLoadMs,
      preprocessMs,
      inferenceMs,
      postprocessMs,
      totalMs,
      inputSize: `${MODEL_INPUT_SIZE}×${MODEL_INPUT_SIZE}`,
      maskSize: `${target.width}×${target.height}`
    }
  };
}
