export type EditorTool =
  | 'auto'
  | 'erase'
  | 'restore'
  | 'refine'
  | 'background'
  | 'crop'
  | 'adjust'
  | 'effects'
  | 'design'
  | 'layers';

export type ProcessingStage =
  | 'reading'
  | 'loading'
  | 'segmenting'
  | 'masking'
  | 'opening';

export type ExecutionProvider = 'webgpu' | 'wasm';
export type AdjustmentTarget = 'subject' | 'background' | 'entire';
export type CompareMode = 'final' | 'original' | 'cutout' | 'side-by-side' | 'slider';

export interface Point {
  x: number;
  y: number;
}

export interface CropRect extends Point {
  width: number;
  height: number;
  ratio?: number;
}

export interface BrushSettings {
  size: number;
  hardness: number;
  feather: number;
  opacity: number;
  flow: number;
}

export interface GradientStop {
  id: string;
  offset: number;
  color: string;
}

export interface BackgroundSettings {
  mode: 'transparent' | 'solid' | 'gradient' | 'image' | 'original-blur';
  color: string;
  gradientType: 'linear' | 'radial';
  gradientAngle: number;
  gradientStops: GradientStop[];
  image: HTMLImageElement | null;
  imageUrl: string;
  imageX: number;
  imageY: number;
  imageScale: number;
  imageRotation: number;
  imageFlipX: boolean;
  imageFlipY: boolean;
  imageFit: 'fill' | 'fit';
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
  overlayColor: string;
  overlayOpacity: number;
}

export interface Adjustments {
  brightness: number;
  contrast: number;
  exposure: number;
  saturation: number;
  vibrance: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  gamma: number;
  sharpness: number;
  blur: number;
  fade: number;
}

export interface EffectSettings {
  preset: string;
  sepia: number;
  invert: number;
  grayscale: number;
  duotoneA: string;
  duotoneB: string;
}

export interface SubjectTransform extends Point {
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  opacity: number;
  shadow: boolean;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowOpacity: number;
  shadowColor: string;
  groundShadow: boolean;
  outline: boolean;
  outlineWidth: number;
  outlineColor: string;
  glow: boolean;
  glowBlur: number;
  glowColor: string;
}

export interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  rotation: number;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  font: string;
  size: number;
  weight: number;
  color: string;
  align: CanvasTextAlign;
  shadow: boolean;
  outline: boolean;
  outlineColor: string;
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shape: 'rectangle' | 'rounded-rectangle' | 'circle' | 'line' | 'arrow';
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  image: HTMLImageElement;
  imageUrl: string;
  width: number;
  height: number;
}

export type DesignLayer = TextLayer | ShapeLayer | ImageLayer;

export interface ExportSettings {
  format: 'png' | 'jpg' | 'webp';
  size: 1 | 0.75 | 0.5 | 'custom';
  customWidth: number;
  customHeight: number;
  quality: number;
  filename: string;
  preserveTransparency: boolean;
  stripMetadata: boolean;
}

export interface SegmentationMetrics {
  modelBytes: number;
  coldLoadMs: number;
  preprocessMs: number;
  inferenceMs: number;
  postprocessMs: number;
  totalMs: number;
  inputSize: string;
  maskSize: string;
}

export interface ProcessingState {
  stage: ProcessingStage;
  message: string;
  detail: string;
}

export interface CanvasSize {
  width: number;
  height: number;
}
