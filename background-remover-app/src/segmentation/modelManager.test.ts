import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
vi.mock('./onnxRuntime', () => ({
  initializeOnnxRuntime: vi.fn(async () => ({ InferenceSession: { create } })),
  providerOrder: vi.fn(() => ['webgpu', 'wasm'])
}));

describe('model manager provider fallback', () => {
  beforeEach(async () => {
    create.mockReset();
    const module = await import('./modelManager');
    module.clearModelCache();
  });

  it('automatically falls back from WebGPU to WASM', async () => {
    create.mockRejectedValueOnce(new Error('WebGPU adapter failed')).mockResolvedValueOnce({ inputNames: ['input.1'] });
    const { getBestSession } = await import('./modelManager');
    const record = await getBestSession();
    expect(record.provider).toBe('wasm');
    expect(create).toHaveBeenNthCalledWith(1, expect.stringContaining('u2netp-web.onnx'), expect.objectContaining({ executionProviders: ['webgpu'] }));
    expect(create).toHaveBeenNthCalledWith(2, expect.stringContaining('u2netp-web.onnx'), expect.objectContaining({ executionProviders: ['wasm'] }));
  });
});
