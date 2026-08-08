import type { CanvasSize, Point, SubjectTransform } from '../types/editor';

export function clientToCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (clientX - rect.left) * canvas.width / Math.max(1, rect.width))),
    y: Math.max(0, Math.min(canvas.height, (clientY - rect.top) * canvas.height / Math.max(1, rect.height)))
  };
}

export function canvasToMaskPoint(point: Point, canvas: HTMLCanvasElement, mask: HTMLCanvasElement): Point {
  return {
    x: point.x * mask.width / canvas.width,
    y: point.y * mask.height / canvas.height
  };
}

export function clampPoint(point: Point, width: number, height: number): Point {
  return { x: Math.max(0, Math.min(width, point.x)), y: Math.max(0, Math.min(height, point.y)) };
}

export function canvasPointToSubjectMask(point: Point, canvasSize: CanvasSize, mask: HTMLCanvasElement, subject: SubjectTransform): Point {
  const centerX = canvasSize.width / 2 + subject.x;
  const centerY = canvasSize.height / 2 + subject.y;
  const radians = -subject.rotation * Math.PI / 180;
  const translatedX = point.x - centerX;
  const translatedY = point.y - centerY;
  const rotatedX = translatedX * Math.cos(radians) - translatedY * Math.sin(radians);
  const rotatedY = translatedX * Math.sin(radians) + translatedY * Math.cos(radians);
  const fit = Math.min(canvasSize.width / mask.width, canvasSize.height / mask.height);
  const scale = Math.max(0.0001, fit * subject.scale);
  return clampPoint({
    x: (subject.flipX ? -rotatedX : rotatedX) / scale + mask.width / 2,
    y: (subject.flipY ? -rotatedY : rotatedY) / scale + mask.height / 2
  }, mask.width, mask.height);
}
