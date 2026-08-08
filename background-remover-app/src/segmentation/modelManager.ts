import type * as ort from 'onnxruntime-web';
import { MODEL_URL } from './assetUrls';
import { initializeOnnxRuntime, providerOrder } from './onnxRuntime';
import type { ExecutionProvider } from '../types/editor';

interface SessionRecord {
  session: ort.InferenceSession;
  provider: ExecutionProvider;
  coldLoadMs: number;
}

const sessions = new Map<ExecutionProvider, Promise<SessionRecord>>();

async function createSession(provider: ExecutionProvider, signal?: AbortSignal): Promise<SessionRecord> {
  signal?.throwIfAborted();
  const runtime = await initializeOnnxRuntime(signal);
  const started = performance.now();
  console.info(`[Background Remover] Trying ${provider.toUpperCase()}`);
  const session = await runtime.InferenceSession.create(MODEL_URL, {
    executionProviders: [provider],
    graphOptimizationLevel: 'all',
    executionMode: 'sequential'
  });
  signal?.throwIfAborted();
  const record = { session, provider, coldLoadMs: performance.now() - started };
  console.info(`[Background Remover] ${provider.toUpperCase()} session ready`, { modelUrl: MODEL_URL, coldLoadMs: record.coldLoadMs });
  return record;
}

async function getSession(provider: ExecutionProvider, signal?: AbortSignal): Promise<SessionRecord> {
  let pending = sessions.get(provider);
  if (!pending) {
    pending = createSession(provider, signal).catch((error) => {
      sessions.delete(provider);
      throw error;
    });
    sessions.set(provider, pending);
  }
  return pending;
}

export async function getBestSession(forceProvider?: ExecutionProvider, signal?: AbortSignal): Promise<SessionRecord> {
  const errors: string[] = [];
  for (const provider of providerOrder(forceProvider)) {
    try {
      return await getSession(provider, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
      console.warn(`[Background Remover] ${provider.toUpperCase()} failed`, error);
    }
  }
  throw new Error(`ONNX Runtime could not create a segmentation session. ${errors.join(' | ')}`);
}

export function clearModelCache(): void {
  sessions.clear();
}
