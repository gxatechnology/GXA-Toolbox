import { describe, expect, it } from 'vitest';
import { canvasPointToSubjectMask, clientToCanvasPoint } from './coordinateTransform';
import type { SubjectTransform } from '../types/editor';

const subject: SubjectTransform = {
  x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1,
  shadow: false, shadowX: 0, shadowY: 0, shadowBlur: 0, shadowOpacity: 0, shadowColor: '#000000',
  groundShadow: false, outline: false, outlineWidth: 0, outlineColor: '#ffffff', glow: false, glowBlur: 0, glowColor: '#0000ff'
};

describe('canvas coordinate mapping', () => {
  it('maps CSS pixels into canvas coordinates', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 500;
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 500, height: 250, right: 510, bottom: 270, x: 10, y: 20, toJSON: () => ({}) });
    expect(clientToCanvasPoint(canvas, 260, 145)).toEqual({ x: 500, y: 250 });
  });

  it('maps the visual subject center into the mask center after transforms', () => {
    const mask = document.createElement('canvas');
    mask.width = 800;
    mask.height = 600;
    const transformed = { ...subject, x: 40, y: -20, scale: 1.4, rotation: 30 };
    expect(canvasPointToSubjectMask({ x: 540, y: 380 }, { width: 1000, height: 800 }, mask, transformed)).toEqual({ x: 400, y: 300 });
  });
});
