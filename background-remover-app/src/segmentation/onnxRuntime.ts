import * as ort from 'onnxruntime-web/webgpu';
import { ORT_WASM_PATH, verifyRuntimeAssets } from './assetUrls';
import type { ExecutionProvider } from '../types/editor';

let initialized: Promise<typeof ort> | null = null;

export function hasWebGpu(): boolean {
  return Boolean((navigator as Navigator & { gpu?: unknown }).gpu && window.isSecureContext);
}

export function providerOrder(forceProvider?: ExecutionProvider): ExecutionProvider[] {
  if (forceProvider) return [forceProvider];
  return hasWebGpu() ? ['webgpu', 'wasm'] : ['wasm'];
}

export function initializeOnnxRuntime(signal?: AbortSignal): Promise<typeof ort> {
  if (!initialized) {
    initialized = (async () => {
      await verifyRuntimeAssets(signal);
      ort.env.wasm.wasmPaths = ORT_WASM_PATH;
      ort.env.wasm.numThreads = crossOriginIsolated
        ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1))
        : 1;
      ort.env.wasm.proxy = false;
      console.info('[Background Remover] ONNX Runtime ready', {
        wasmPath: ORT_WASM_PATH,
        webGpuAvailable: hasWebGpu(),
        threads: ort.env.wasm.numThreads
      });
      return ort;
    })().catch((error) => {
      initialized = null;
      throw error;
    });
  }
  return initialized;
}
