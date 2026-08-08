import type { BrushSettings, Point } from '../types/editor';
import { getContext } from '../utils/canvas';

function dab(canvas: HTMLCanvasElement, point: Point, mode: 'erase' | 'restore', brush: BrushSettings): void {
  const context = getContext(canvas);
  const radius = Math.max(1, brush.size / 2);
  const hardRadius = radius * Math.max(0.02, Math.min(1, (brush.hardness - brush.feather * 0.35) / 100));
  const strength = Math.max(0.01, Math.min(1, brush.opacity / 100 * brush.flow / 100));
  const gradient = context.createRadialGradient(point.x, point.y, hardRadius, point.x, point.y, radius);
  if (mode === 'erase') {
    context.save();
    context.globalCompositeOperation = 'destination-out';
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    context.save();
    context.globalCompositeOperation = 'source-over';
    gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
  }
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function paintMaskStroke(canvas: HTMLCanvasElement, from: Point, to: Point, mode: 'erase' | 'restore', brush: BrushSettings): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const spacing = Math.max(1, brush.size * 0.12);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    dab(canvas, {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    }, mode, brush);
  }
}
