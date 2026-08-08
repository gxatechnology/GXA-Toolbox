import type { CropRect, Point } from '../types/editor';

export type CropHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export function cropHandles(crop: CropRect): Record<Exclude<CropHandle, 'move'>, Point> {
  const left = crop.x;
  const right = crop.x + crop.width;
  const top = crop.y;
  const bottom = crop.y + crop.height;
  const centerX = left + crop.width / 2;
  const centerY = top + crop.height / 2;
  return {
    nw: { x: left, y: top }, n: { x: centerX, y: top }, ne: { x: right, y: top },
    e: { x: right, y: centerY }, se: { x: right, y: bottom }, s: { x: centerX, y: bottom },
    sw: { x: left, y: bottom }, w: { x: left, y: centerY }
  };
}

export function hitTestCrop(crop: CropRect, point: Point, tolerance: number): CropHandle | null {
  for (const [handle, position] of Object.entries(cropHandles(crop))) {
    if (Math.hypot(point.x - position.x, point.y - position.y) <= tolerance) return handle as CropHandle;
  }
  if (point.x >= crop.x && point.x <= crop.x + crop.width && point.y >= crop.y && point.y <= crop.y + crop.height) return 'move';
  return null;
}

export function moveCrop(crop: CropRect, handle: CropHandle, delta: Point, bounds: { width: number; height: number }): CropRect {
  const minimum = Math.max(24, Math.min(bounds.width, bounds.height) * 0.04);
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;
  if (handle === 'move') {
    const width = crop.width;
    const height = crop.height;
    left = Math.max(0, Math.min(bounds.width - width, left + delta.x));
    top = Math.max(0, Math.min(bounds.height - height, top + delta.y));
    return { ...crop, x: left, y: top };
  }
  if (handle.includes('w')) left += delta.x;
  if (handle.includes('e')) right += delta.x;
  if (handle.includes('n')) top += delta.y;
  if (handle.includes('s')) bottom += delta.y;
  left = Math.max(0, Math.min(right - minimum, left));
  right = Math.min(bounds.width, Math.max(left + minimum, right));
  top = Math.max(0, Math.min(bottom - minimum, top));
  bottom = Math.min(bounds.height, Math.max(top + minimum, bottom));
  let width = right - left;
  let height = bottom - top;
  if (crop.ratio) {
    if (handle === 'n' || handle === 's') width = height * crop.ratio;
    else height = width / crop.ratio;
    right = Math.min(bounds.width, left + width);
    bottom = Math.min(bounds.height, top + height);
    width = right - left;
    height = bottom - top;
  }
  return { ...crop, x: left, y: top, width, height };
}

export function cropForRatio(bounds: { width: number; height: number }, ratio?: number): CropRect {
  if (!ratio) return { x: 0, y: 0, width: bounds.width, height: bounds.height };
  let width = bounds.width;
  let height = width / ratio;
  if (height > bounds.height) {
    height = bounds.height;
    width = height * ratio;
  }
  return { x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height, ratio };
}
