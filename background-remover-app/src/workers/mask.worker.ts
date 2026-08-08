/// <reference lib="webworker" />
import { refineAlpha, type RefineSettings } from './maskAlgorithms';

interface Request {
  id: string;
  alpha: Uint8ClampedArray;
  width: number;
  height: number;
  settings: RefineSettings;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, alpha, width, height, settings } = event.data;
  const result = refineAlpha(alpha, width, height, settings);
  self.postMessage({ id, alpha: result }, { transfer: [result.buffer] });
};

export {};
