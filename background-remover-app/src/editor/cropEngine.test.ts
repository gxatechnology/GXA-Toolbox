import { describe, expect, it } from 'vitest';
import { cropForRatio, hitTestCrop, moveCrop } from './cropEngine';

describe('crop engine', () => {
  it('creates a centered aspect-ratio crop', () => {
    expect(cropForRatio({ width: 1000, height: 800 }, 1)).toEqual({ x: 100, y: 0, width: 800, height: 800, ratio: 1 });
  });

  it('supports all edge and corner handles', () => {
    const crop = { x: 100, y: 100, width: 400, height: 300 };
    expect(hitTestCrop(crop, { x: 100, y: 100 }, 8)).toBe('nw');
    expect(hitTestCrop(crop, { x: 500, y: 400 }, 8)).toBe('se');
    expect(hitTestCrop(crop, { x: 300, y: 100 }, 8)).toBe('n');
    expect(hitTestCrop(crop, { x: 300, y: 250 }, 8)).toBe('move');
  });

  it('keeps resized crops inside the canvas', () => {
    const moved = moveCrop({ x: 100, y: 100, width: 400, height: 300 }, 'se', { x: 800, y: 800 }, { width: 900, height: 700 });
    expect(moved.x + moved.width).toBeLessThanOrEqual(900);
    expect(moved.y + moved.height).toBeLessThanOrEqual(700);
  });
});
