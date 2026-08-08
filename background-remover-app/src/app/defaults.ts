import type { Adjustments, BackgroundSettings, BrushSettings, EffectSettings, ExportSettings, SubjectTransform } from '../types/editor';

export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 48_000_000;
export const MASK_MAX_SIDE = 2048;

export const DEFAULT_BRUSH: BrushSettings = {
  size: 72,
  hardness: 75,
  feather: 25,
  opacity: 100,
  flow: 70
};

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  mode: 'transparent',
  color: '#ffffff',
  gradientType: 'linear',
  gradientAngle: 135,
  gradientStops: [
    { id: 'gradient-start', offset: 0, color: '#2563eb' },
    { id: 'gradient-end', offset: 1, color: '#f59e0b' }
  ],
  image: null,
  imageUrl: '',
  imageX: 0,
  imageY: 0,
  imageScale: 1,
  imageRotation: 0,
  imageFlipX: false,
  imageFlipY: false,
  imageFit: 'fill',
  blur: 18,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  overlayColor: '#000000',
  overlayOpacity: 0
};

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  exposure: 0,
  saturation: 100,
  vibrance: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  gamma: 100,
  sharpness: 0,
  blur: 0,
  fade: 0
};

export const DEFAULT_EFFECT: EffectSettings = {
  preset: 'original',
  sepia: 0,
  invert: 0,
  grayscale: 0,
  duotoneA: '#172554',
  duotoneB: '#f59e0b'
};

export const DEFAULT_SUBJECT: SubjectTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  opacity: 1,
  shadow: false,
  shadowX: 18,
  shadowY: 24,
  shadowBlur: 28,
  shadowOpacity: 35,
  shadowColor: '#000000',
  groundShadow: false,
  outline: false,
  outlineWidth: 10,
  outlineColor: '#ffffff',
  glow: false,
  glowBlur: 24,
  glowColor: '#2563eb'
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: 'png',
  size: 1,
  customWidth: 1920,
  customHeight: 1080,
  quality: 92,
  filename: 'gxa-cutout',
  preserveTransparency: true,
  stripMetadata: true
};

export const EFFECT_PRESETS: Record<string, Partial<Adjustments> & Partial<EffectSettings>> = {
  original: {},
  'b&w': { saturation: 0, grayscale: 100 },
  warm: { temperature: 22, saturation: 108 },
  cool: { temperature: -22, saturation: 106 },
  vivid: { saturation: 135, vibrance: 30, contrast: 112 },
  sepia: { sepia: 68, saturation: 82 },
  vintage: { sepia: 36, saturation: 82, contrast: 92, fade: 12 },
  matte: { contrast: 88, fade: 20, brightness: 104 },
  'high contrast': { contrast: 138, saturation: 108 },
  soft: { contrast: 88, brightness: 104, blur: 0.5 },
  fade: { contrast: 82, saturation: 84, fade: 30 },
  duotone: { saturation: 0, grayscale: 100, preset: 'duotone' },
  invert: { invert: 100 }
};
