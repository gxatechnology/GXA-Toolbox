import type * as ort from 'onnxruntime-web';
import type { ExecutionProvider, SegmentationMetrics } from '../types/editor';

export interface LetterboxTransform {
  sourceWidth: number;
  sourceHeight: number;
  inputSize: number;
  drawWidth: number;
  drawHeight: number;
  padX: number;
  padY: number;
}

export interface PreprocessResult {
  tensor: ort.Tensor;
  transform: LetterboxTransform;
}

export interface SegmentationResult {
  mask: HTMLCanvasElement;
  provider: ExecutionProvider;
  metrics: SegmentationMetrics;
  stats: {
    minimum: number;
    maximum: number;
    mean: number;
    transparentPercent: number;
    opaquePercent: number;
    partialPercent: number;
  };
}

export interface SegmentationStatus {
  message: string;
  detail: string;
}
