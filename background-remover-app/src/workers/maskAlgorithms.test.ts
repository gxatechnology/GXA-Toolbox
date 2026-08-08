import { describe, expect, it } from 'vitest';
import { refineAlpha } from './maskAlgorithms';

describe('mask refinement worker algorithm', () => {
  it('expands and contracts a foreground region', () => {
    const alpha = new Uint8ClampedArray(25);
    alpha[12] = 255;
    const expanded = refineAlpha(alpha, 5, 5, { smooth: 0, feather: 0, expand: 1, shiftEdge: 0, defringe: 0, edgeContrast: 0 });
    expect([...expanded].filter(Boolean).length).toBeGreaterThan(1);
    const contracted = refineAlpha(expanded, 5, 5, { smooth: 0, feather: 0, expand: -1, shiftEdge: 0, defringe: 0, edgeContrast: 0 });
    expect([...contracted].filter(Boolean).length).toBeLessThan([...expanded].filter(Boolean).length);
  });

  it('feathers a hard edge into partial alpha values', () => {
    const alpha = new Uint8ClampedArray([0, 0, 255, 255, 255]);
    const feathered = refineAlpha(alpha, 5, 1, { smooth: 0, feather: 16, expand: 0, shiftEdge: 0, defringe: 0, edgeContrast: 0 });
    expect([...feathered].some((value) => value > 0 && value < 255)).toBe(true);
  });
});
