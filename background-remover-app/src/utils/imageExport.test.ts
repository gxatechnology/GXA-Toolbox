import { beforeEach, describe, expect, it, vi } from 'vitest';

const canvas = document.createElement('canvas');
const renderExport = vi.fn(() => canvas);
const canvasToBlob = vi.fn(async () => new Blob(['image'], { type: 'image/webp' }));
vi.mock('../editor/exportRenderer', () => ({ renderExport }));
vi.mock('./canvas', () => ({ canvasToBlob }));

describe('image export', () => {
  beforeEach(() => { renderExport.mockClear(); canvasToBlob.mockClear(); });

  it('uses the selected WebP format, quality, and a safe filename', async () => {
    const { exportImage } = await import('./imageExport');
    const state = { exportSettings: { format: 'webp', quality: 87, filename: 'My final cutout!' } } as Parameters<typeof exportImage>[0];
    const output = await exportImage(state);
    expect(canvasToBlob).toHaveBeenCalledWith(canvas, 'image/webp', .87);
    expect(output.filename).toBe('My-final-cutout-.webp');
  });
});
